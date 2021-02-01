// @ts-check

import axios from 'axios';
import _ from 'lodash';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import prettier from 'prettier';
import debug from 'debug';
import axiosDebug from 'axios-debug-log';
import Listr from 'listr';

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

export const makeName = (fullname, extension = null) => {
	const name = fullname.slice(fullname.indexOf('//') + 1);
	if (extension) return [_.kebabCase(`${name}`), extension].join('');
	return [_.kebabCase(`${name}`), 'files'].join('_');
};

const isLocalSrc = (link, origin) => {
	const isLocal =
		((!_.startsWith(link, '//') && _.startsWith(link, '/')) || _.startsWith(link, origin)) &&
		_.inRange(path.extname(link).length, 3, 5);
	logPageLoader('checking if link lokal %o', `${link} is local - "${isLocal}"`);
	return isLocal;
};

const downloadSrc = (links, pathToDirSrcFiles) => {
	const coll = links.map((link) => {
		const filenameWithoutExt = link.slice(0, link.lastIndexOf('.'));
		const filename = makeName(filenameWithoutExt, path.extname(link));
		const filepath = path.join(pathToDirSrcFiles, filename);
		const listrTask = { title: `Download into '${filename}'` };
		listrTask.task = () =>
			axios
				.get(link, { responseType: 'arraybuffer' })
				.then(({ data }) => fsPromises.writeFile(filepath, data));
		return listrTask;
	});
	const tasks = new Listr(coll, { concurrent: true, exitOnError: false });
	return tasks;
};

const changeSrc = (data, dirSrcName, { host, origin }) => {
	const $ = cheerio.load(data);
	const links = [
		['img', 'src'],
		['script', 'src'],
		['link', 'href'],
	].map(([tag, atrrName]) =>
		$(tag)
			.filter((_i, el) => !!$(el).attr(atrrName) && isLocalSrc($(el).attr(atrrName), origin))
			.map((_i, parsedEl) => {
				const oldAttrValue = $(parsedEl).attr(atrrName);
				const ext = path.extname(oldAttrValue);
				const filename = makeName(
					`${host}${oldAttrValue.slice(0, oldAttrValue.lastIndexOf('.'))}`,
					ext
				);
				const newSrc = path.join(dirSrcName, filename);
				$(parsedEl).attr(atrrName, newSrc);
				if (_.startsWith(oldAttrValue, origin)) return oldAttrValue;
				return `${origin}${oldAttrValue}`;
			})
			.toArray()
	);
	return { links: _.flatten(links), updatedHTML: $.html() };
};

export default (uri, outputDir = process.cwd()) => {
	let filePath;
	logPageLoader('start downloading page with url %o', uri);
	return fsPromises
		.access(outputDir, fs.constants.F_OK || fs.constants.W_OK)
		.then(
			() => axios.get(uri),
			(err) => Promise.reject(err)
		)
		.then(
			({ data }) => {
				const url = new URL(uri.trim());
				logPageLoader('parsed url %O', url);
				const absolutePath = path.resolve(outputDir);
				const dirSrcName = makeName(`${url.host}${url.pathname}`);
				const filename = makeName(`${url.host}${url.pathname}`, '.html');
				filePath = path.join(absolutePath, filename);
				const pathToDirSrcFiles = path.join(absolutePath, dirSrcName);
				const { links, updatedHTML } = changeSrc(data, dirSrcName, url);
				logPageLoader('local src links on page %O', links);
				// console.log('links=>', links);
				const formatedHTML = prettier.format(updatedHTML, {
					parser: 'html',
					printWidth: 120,
					tabWidth: 4,
				});
				fsPromises.writeFile(filePath, formatedHTML, 'utf-8');
				return { links, pathToDirSrcFiles };
			},
			(err) => Promise.reject(err)
		)
		.then(
			({ links, pathToDirSrcFiles }) => {
				if (links.length > 0) {
					fsPromises.mkdir(pathToDirSrcFiles);
					logPageLoader('path to dir with src is %o', pathToDirSrcFiles);
					return downloadSrc(links, pathToDirSrcFiles);
				}
				return null;
			},
			(err) => Promise.reject(err)
		)
		.then((tasks) => (tasks ? tasks.run() : null))
		.then(() => filePath)
		.catch((err) => Promise.reject(err));
};
