// @ts-check

import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import os from 'os';
import nock from 'nock';
import { fileURLToPath } from 'url';
// import cheerio from 'cheerio';
import pageLoader, { makeName } from '../src/app.js';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// const hexletUrl = 'https://ru.hexlet.io';
const wikiUrl = 'https://en.wikipedia.org';
const wikiFileName = 'wiki-main.html';

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

let tempDir;
let data;

nock.disableNetConnect();

test('name must be in kebabCase', () => {
	expect(makeName('en.wikipedia.org', '.html')).toEqual('en-wikipedia-org.html');
	expect(makeName('en.wikipedia.org')).toEqual('en-wikipedia-org_files');
});

describe('download page and src', () => {
	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
		data = await fs.readFile(getPath(wikiFileName), 'utf-8');
		nock(wikiUrl).get('/wiki/Main_Page').reply(200, data);
	});

	test('download page', async () => {
		const outputPath = await pageLoader(`${wikiUrl}/wiki/Main_Page`, tempDir, () => true);
		const loadedHtml = await fs.readFile(outputPath, 'utf-8');
		expect(loadedHtml).toEqual(data);
	}, 10000);

	test('download images', async () => {
		const outputPath = await pageLoader(
			`${wikiUrl}/wiki/Main_Page`,
			tempDir,
			mockFuncDownloadImages
		);
		const downloadDir = path.dirname(outputPath);
		const pathToImagesDir = path.join(downloadDir, 'en-wikipedia-org-wiki-main-page_files');
		const images = await fs.readdir(pathToImagesDir);
		// console.log('images->', images);
		expect(images).toHaveLength(19);
	}, 10000);
});
