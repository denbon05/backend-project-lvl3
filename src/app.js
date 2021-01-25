// @ts-check

import axios from 'axios';
import _ from 'lodash';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import prettier from 'prettier';

export const makeName = (fullname, extension = null) => {
	const name = fullname.slice(fullname.indexOf('//') + 1);
	if (extension) return [_.kebabCase(`${name}`), extension].join('');
	return [_.kebabCase(`${name}`), 'files'].join('_');
};

const isImage = (link) => ['.img', '.png', '.ico'].includes(path.extname(link));
const isLocalSrc = (link) => !_.startsWith(link, '//') && path.extname(link).length === 4;

const downloadSrc = (links, pathToDirSrcFiles) => {
	fsPromises.mkdir(pathToDirSrcFiles);
	links.forEach((link) => {
		const filepath = path.join(pathToDirSrcFiles, makeName(link, path.extname(link)));
		if (isImage(link)) {
			axios
				.get(link, { responseType: 'stream' })
				.then(({ data }) => {
					data.pipe(fs.createWriteStream(filepath));
				})
				.catch((err) => {
					throw Error(`download_img_err=>${err.message}`);
				});
		} else {
			axios
				.get(link)
				.then(({ data }) => {
					fsPromises.writeFile(filepath, data, 'utf-8');
				})
				.catch((err) => {
					throw Error(`download_src_err=>${err.message}`);
				});
		}
	});
};

const changeLocalSrcLinks = ($, tagName, srcName, filterFunc, host, pathToDirSrcFiles) => {
	const elements = $(tagName)
		.filter((_i, el) => $(el).attr(srcName))
		.filter((_i, el) => filterFunc($(el).attr(srcName)))
		.map((_i, parsedEl) => {
			const oldAttrValue = $(parsedEl).attr(srcName);
			const ext = path.extname(oldAttrValue);
			const filename = makeName(
				`${host}/${oldAttrValue.slice(0, oldAttrValue.lastIndexOf('.'))}`,
				ext
			);
			const newSrc = path.resolve(pathToDirSrcFiles, filename);
			$(parsedEl).attr(srcName, newSrc);
			if (_.startsWith(oldAttrValue, '//')) return `https:${oldAttrValue}`;
			return `https://${host}${oldAttrValue}`;
		});
	return elements.toArray();
};

const changeSrc = (data, pathToDirSrcFiles, host) => {
	const $ = cheerio.load(data);
	const imgLinks = changeLocalSrcLinks($, 'img', 'src', isImage, host, pathToDirSrcFiles);
	const scriptLinks = changeLocalSrcLinks($, 'script', 'src', isLocalSrc, host, pathToDirSrcFiles);
	const linkLinks = changeLocalSrcLinks($, 'link', 'href', isLocalSrc, host, pathToDirSrcFiles);
	// console.log('linkLinks=>', linkLinks);
	return { links: [...imgLinks, ...scriptLinks, ...linkLinks], updatedHTML: $.html() };
};

export default (uri, outputDir, downloadSrcFunc = downloadSrc) => {
	const url = new URL(uri.trim());
	const absolutePath = path.resolve(outputDir);
	const pathToDirSrcFiles = path.join(absolutePath, makeName(`${url.host}${url.pathname}`));
	return axios
		.get(uri)
		.then(
			({ data }) => {
				const { links, updatedHTML } = changeSrc(data, pathToDirSrcFiles, url.host);
				const formatedHTML = prettier.format(updatedHTML, { parser: 'html' });
				const filename = makeName(`${url.host}${url.pathname}`, '.html');
				const filePath = path.join(absolutePath, filename);
				fsPromises.writeFile(filePath, formatedHTML, 'utf-8');
				return { filePath, links };
			},
			(err) => Promise.reject(err)
		)
		.then(({ filePath, links }) => {
			if (links.length > 0) downloadSrcFunc(links, pathToDirSrcFiles);
			return filePath;
		})
		.catch((err) => {
			console.log('err in app.js', err);
			return Promise.reject(err);
		});
};
