// @ts-check

import axios from 'axios';
import _ from 'lodash';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import prettier from 'prettier';

export const makeName = (name, extension = null) => {
	if (extension) return [_.kebabCase(`${name}`), extension].join('');
	return [_.kebabCase(`${name}`), 'files'].join('_');
};

const downloadImages = (links, pathToImagesDir) => {
	fsPromises.mkdir(pathToImagesDir);
	links.forEach((link) =>
		axios
			.get(link, { responseType: 'stream' })
			.then(({ data }) => {
				const ext = path.extname(link);
				const imgName = makeName(link, ext);
				const filepath = path.join(pathToImagesDir, imgName);
				data.pipe(fs.createWriteStream(filepath));
				return filepath;
			})
			.catch((err) => {
				console.log('downloadImages_err=>', err);
				throw Error(err.message);
			})
	);
};

const changeImagesSrc = (data, pathToImagesDir, host) => {
	const $ = cheerio.load(data);
	const linkElements = $('img').map((_i, imgEl) => {
		const oldSrc = $(imgEl).attr('src');
		const newSrc = path.resolve(
			pathToImagesDir,
			oldSrc.slice(oldSrc.lastIndexOf('/') + 1)
		);
		$(imgEl).attr('src', newSrc);
		if (_.startsWith('/static/', oldSrc) || _.startsWith('/library/', oldSrc))
			return `https://${host}${oldSrc}`;
		return `https:${oldSrc}`;
	});
	const imgLinks = linkElements.toArray().filter((link) => {
		// @ts-ignore
		const ext = path.extname(link);
		return ext === '.png' || ext === '.jpg';
	});
	return { imgLinks, updatedHTML: $.html() };
};

export default (uri, outputDir, downloadSrcFunc = downloadImages) => {
	const url = new URL(uri.trim());
	return axios
		.get(uri)
		.then(
			({ data }) => {
				const absolutePath = path.resolve(outputDir);
				const pathToImagesDir = path.join(
					absolutePath,
					makeName(`${url.host}${url.pathname}`)
				);
				const { imgLinks, updatedHTML } = changeImagesSrc(
					data,
					pathToImagesDir,
					url.host
				);
				// console.log('imgLinks=>', imgLinks);
				const formatedHTML = prettier.format(updatedHTML, { parser: 'html' });
				const filename = makeName(`${url.host}${url.pathname}`, '.html');
				const filePath = path.join(absolutePath, filename);
				fsPromises.writeFile(filePath, formatedHTML, 'utf-8');
				if (imgLinks.length > 0) downloadSrcFunc(imgLinks, pathToImagesDir);
				return filePath;
			},
			(err) => Promise.reject(err)
		)
		.catch((err) => {
			console.log('err in app.js', err);
			return Promise.reject(err);
		});
};
