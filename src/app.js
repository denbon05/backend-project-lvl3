// @ts-check

import axios from 'axios';
import _ from 'lodash';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import prettier from 'prettier';
import debug from 'debug';
import axiosDebug from 'axios-debug-log';

axiosDebug({
	request: (logAxios, config) => {
		logAxios(`Request with ${config.headers['content-type']}`);
	},
	response: (logAxios, response) => {
		logAxios(`Response with ${response.headers['content-type']}`, `from ${response.config.url}`);
	},
	error: (logAxios, error) => {
		logAxios('error is', error);
	},
});

const logPageLoader = debug('page-loader');
const logErrors = debug('errors');

export const makeName = (fullname, extension = null) => {
	const name = fullname.slice(fullname.indexOf('//') + 1);
	if (extension) return [_.kebabCase(`${name}`), extension].join('');
	return [_.kebabCase(`${name}`), 'files'].join('_');
};

const isLocalSrc = (link) =>
	!_.startsWith(link, '//') && _.startsWith(link, '/') && path.extname(link).length <= 4;

const downloadSrc = (links, pathToDirSrcFiles) => {
	fsPromises
		.mkdir(pathToDirSrcFiles)
		.then(() => {
			links.forEach((link) => {
				const filename = link.slice(0, link.lastIndexOf('.'));
				const filepath = path.join(pathToDirSrcFiles, makeName(filename, path.extname(link)));
				if (['.img', '.png', '.ico'].includes(path.extname(link))) {
					axios
						.get(link, { responseType: 'stream' })
						.then(({ data }) => {
							data.pipe(fs.createWriteStream(filepath));
						})
						.catch((err) => {
							logErrors('error with download images %o', err.message);
							throw Error(`download_img_err=>${err.message}`);
						});
				} else {
					axios
						.get(link)
						.then(({ data }) => {
							fsPromises.writeFile(filepath, data, 'utf-8');
						})
						.catch((err) => {
							logErrors('error with download src %o', err.message);
							throw Error(`download_src_err=>${err.message}`);
						});
				}
			});
		})
		.catch((err) => {
			throw Error(err);
		});
};

// const changeLocalSrcLinks = ($, tagName, srcName, filterFunc, host, dirSrcName) => {
// 	const elements = $(tagName)
// 		.filter((_i, el) => $(el).attr(srcName))
// 		.filter((_i, el) => filterFunc($(el).attr(srcName), host))
// 		.map((_i, parsedEl) => {
// 			const oldAttrValue = $(parsedEl).attr(srcName);
// 			const ext = path.extname(oldAttrValue);
// 			const filename = makeName(
// 				`${host}${oldAttrValue.slice(0, oldAttrValue.lastIndexOf('.'))}`,
// 				ext
// 			);
// 			const newSrc = path.join(dirSrcName, filename);
// 			$(parsedEl).attr(srcName, newSrc);
// 			// if (_.startsWith(oldAttrValue, '//')) return `https:${oldAttrValue}`;
// 			return `https://${host}${oldAttrValue}`;
// 		});
// 	return elements.toArray();
// };

const changeSrc = (data, dirSrcName, host) => {
	const $ = cheerio.load(data);
	const links = [
		['img', 'src'],
		['script', 'src'],
		['link', 'href'],
	].map(([tag, atrrName]) =>
		$(tag)
			.filter((_i, el) => !!$(el).attr(atrrName) && isLocalSrc($(el).attr(atrrName)))
			.map((_i, parsedEl) => {
				const oldAttrValue = $(parsedEl).attr(atrrName);
				const ext = path.extname(oldAttrValue);
				const filename = makeName(
					`${host}${oldAttrValue.slice(0, oldAttrValue.lastIndexOf('.'))}`,
					ext
				);
				const newSrc = path.join(dirSrcName, filename);
				$(parsedEl).attr(atrrName, newSrc);
				return `https://${host}${oldAttrValue}`;
			})
			.toArray()
	);
	return { links: _.flatten(links), updatedHTML: $.html() };
};

export default (uri, outputDir) => {
	const url = new URL(uri.trim());
	const absolutePath = path.resolve(outputDir);
	const dirSrcName = makeName(`${url.host}${url.pathname}`);
	const pathToDirSrcFiles = path.join(absolutePath, dirSrcName);
	logPageLoader('start downloading page with url %o', uri);
	return axios
		.get(uri)
		.then(
			({ data }) => {
				const { links, updatedHTML } = changeSrc(data, dirSrcName, url.host);
				logPageLoader('local src links on the page %O', links);
				// console.log('links=>', links);
				const formatedHTML = prettier.format(updatedHTML, { parser: 'html' });
				const filename = makeName(`${url.host}${url.pathname}`, '.html');
				logPageLoader('file name with changed src is %o', filename);
				const filePath = path.join(absolutePath, filename);
				fsPromises.writeFile(filePath, formatedHTML, 'utf-8');
				return { filePath, links };
			},
			(err) => Promise.reject(err)
		)
		.then(({ filePath, links }) => {
			if (links.length > 0) downloadSrc(links, pathToDirSrcFiles);
			return filePath;
		})
		.catch((err) => {
			logErrors('error app.js in pageLoader %o', err.message);
			console.log('err in app.js', err);
			return Promise.reject(err);
		});
};
