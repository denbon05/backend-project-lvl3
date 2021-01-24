// @ts-check

import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import os from 'os';
import nock from 'nock';
import { fileURLToPath } from 'url';
// import cheerio from 'cheerio';
import pageLoader from '../index.js';
// import links from './links.js';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// const hexletUrl = 'https://ru.hexlet.io';
const wikiUrl = 'https://en.wikipedia.org';
const wikiFileName = 'wiki-main.html';

const getPath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);

let tempDir;
let data;
let outputPath;

nock.disableNetConnect();

beforeEach(async () => {
	tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
	data = await fs.readFile(getPath(wikiFileName), 'utf-8');
	nock(wikiUrl).get('/wiki/Main_Page').reply(200, data);
	outputPath = await pageLoader(`${wikiUrl}/wiki/Main_Page`, tempDir, () => true);
});

test('download page', async () => {
	const loadedHtml = await fs.readFile(outputPath, 'utf-8');
	expect(loadedHtml).toEqual(data);
});

// test('download images', async (done) => {
// 	const downloadDir = path.dirname(outputPath);
// 	// console.log('downloadDir->', downloadDir);
// 	const pathToImagesDir = path.join(downloadDir, 'en-wikipedia-org-wiki-main-page_files');
// 	const images = await fs.readdir(pathToImagesDir);
// 	console.log('images->', images);
// 	expect(images).toHaveLength(14);
// });
