// @ts-check

import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import os from 'os';
import nock from 'nock';
import { fileURLToPath } from 'url';
import cheerio from 'cheerio';
import pageLoader, { makeName } from '../src/app.js';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// const hexletUrl = 'https://ru.hexlet.io';
const wikiUrl = 'https://en.wikipedia.org';
const wikiFileName = 'wiki-home.html';

const getPath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);
const mockFuncDownloadImages = (links, pathToImagesDir) => {
	fs.mkdir(pathToImagesDir);
	links.forEach(async (link) => {
		const ext = path.extname(link);
		const imgName = makeName(link, ext);
		const pathToImg = path.join(pathToImagesDir, imgName);
		await fs.writeFile(pathToImg, '');
	});
};

nock.disableNetConnect();

test('transform name to kebabCase', () => {
	expect(makeName('en.wikipedia.org', '.html')).toEqual('en-wikipedia-org.html');
	expect(makeName('en.wikipedia.org')).toEqual('en-wikipedia-org_files');
});

describe('download page and src', () => {
	let tempDir;
	let data;
	let fileOutputPath;

	beforeAll(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
		data = await fs.readFile(getPath(wikiFileName), 'utf-8');
		nock(wikiUrl).get('/wiki/Home_page').reply(200, data);
		fileOutputPath = await pageLoader(
			`${wikiUrl}/wiki/Home_page`,
			tempDir,
			mockFuncDownloadImages
		);
	});

	test('download images', async () => {
		const downloadDir = path.dirname(fileOutputPath);
		const pathToImagesDir = path.join(
			downloadDir,
			'en-wikipedia-org-wiki-home-page_files'
		);
		const images = await fs.readdir(pathToImagesDir);
		// console.log('images->', images);
		expect(images).toHaveLength(5);
	});

	test('update src in page', async () => {
		const loadedHtml = await fs.readFile(fileOutputPath, 'utf-8');
		const $ = cheerio.load(loadedHtml);
		$('img')
			.filter(
				(_i, el) =>
					path.extname($(el).attr('src')) === '.png' ||
					path.extname($(el).attr('src')) === '.img'
			)
			.each((_i, imgEl) => expect($(imgEl).attr('src').includes('/tmp/')).toBeTruthy());
	});
});
