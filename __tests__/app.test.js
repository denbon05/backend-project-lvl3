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
const wikiUrl = 'https://en.wikipedia.org/wiki/Home_page';
const wikiFileName = 'wiki-home.html';

const getPath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);
const mockFuncDownloadSrc = (links, pathToImagesDir) => {
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
	expect(makeName('en.wikipedia.org/path', '.html')).toEqual('en-wikipedia-org-path.html');
	expect(makeName('en.wikipedia.org/home/page')).toEqual('en-wikipedia-org-home-page_files');
});

describe('download page and src', () => {
	let tempDir;
	let fileOutputPath;

	const { href, origin, pathname } = new URL(wikiUrl);

	beforeAll(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
		const data = await fs.readFile(getPath(wikiFileName), 'utf-8');
		nock(origin).get(pathname).reply(200, data);
		fileOutputPath = await pageLoader(href, tempDir, mockFuncDownloadSrc);
	});

	test('update src in html', async () => {
		// console.log('tempDir=>	', tempDir);
		const loadedHtml = await fs.readFile(fileOutputPath, 'utf-8');
		const $ = cheerio.load(loadedHtml);
		$('img')
			.filter(
				(_i, el) =>
					path.extname($(el).attr('src')) === '.png' || path.extname($(el).attr('src')) === '.img'
			)
			.each((_i, imgEl) => expect($(imgEl).attr('src').includes(tempDir)).toBeTruthy());
	});

	test('download src', async () => {
		const downloadDir = path.dirname(fileOutputPath);
		const pathToImagesDir = path.join(downloadDir, 'en-wikipedia-org-wiki-home-page_files');
		const filesSrc = await fs.readdir(pathToImagesDir);
		// console.log('images->', images);
		expect(filesSrc).toHaveLength(8);
	});
});
