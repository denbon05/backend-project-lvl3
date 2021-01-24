// @ts-check

import axios from 'axios';
import _ from 'lodash';
import { promises as fs } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import prettier from 'prettier';

const makeName = (name, extension = null) => {
	if (extension) return [_.kebabCase(`${name}`), extension].join('');
	return [_.kebabCase(`${name}`), 'files'].join('_');
};

const downloadImages = (links, pathToImagesDir, mock) => {
	if (!mock) {
		return links.map(
			(link) => axios.get(link, { responseType: 'stream' }).then(({ data }) => {
				const ext = path.extname(link);
				const imgName = makeName(link, ext);
				const filepath = path.join(pathToImagesDir, imgName);
				data.pipe(filepath);
				return filepath;
			}),
			(err) => Promise.reject(err)
		);
	}
	return [Promise.resolve(mock())];
};

const changeImagesSrc = (data, pathToImagesDir) => {
	const $ = cheerio.load(data);
	const linkElements = $('img').map((_i, imgEl) => {
		const oldSrc = $(imgEl).attr('src');
		const newSrc = path.resolve(pathToImagesDir, oldSrc.slice(oldSrc.lastIndexOf('/') + 1));
		$(imgEl).attr('src', newSrc);
		return `https:${oldSrc}`;
	});
	return linkElements.toArray().filter((link) => {
		// @ts-ignore
		const ext = path.extname(link);
		return ext === '.png' || ext === '.png';
	});
};

export default (uri, outputDir, mock) => {
	const url = new URL(uri.trim());
	return axios
		.get(uri)
		.then(
			({ data }) => {
				const filename = makeName(`${url.host}${url.pathname}`, '.html');
				const absolutePath = path.resolve(outputDir);
				const filePath = path.join(absolutePath, filename);
				fs.writeFile(filePath, data, 'utf-8');
				return { data, absolutePath, filePath };
			},
			(err) => Promise.reject(err)
		)
		.then(
			({ data: beforeFormatData, absolutePath, filePath }) => {
				const data = prettier.format(beforeFormatData, { parser: 'html' });
				return { data, absolutePath, filePath };
			},
			(err) => Promise.reject(err)
		)
		.then(
			({ data, absolutePath, filePath }) => {
				const pathToImagesDir = path.join(absolutePath, makeName(`${url.host}${url.pathname}`));
				const links = changeImagesSrc(data, pathToImagesDir);
				// console.log('links=>', links);
				Promise.all(downloadImages(links, pathToImagesDir, mock));
				return filePath;
			},
			(err) => Promise.reject(err)
		)
		.catch((err) => {
			console.log('err in app.js', err);
			return Promise.reject(err);
		});
};
