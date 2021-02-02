// @ts-check

import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import os from 'os';
import nock from 'nock';
import prettier from 'prettier';
import { fileURLToPath } from 'url';
import pageLoader, { makeName } from '../src/app.js';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const wikiUrl = 'https://en.wikipedia.org';

const wikiFileName = 'wiki.html';
const changedHtmlFileName = 'en-wikipedia-org.html';
const srcFolderName = 'en-wikipedia-org_files';
const wikiLogoPngName = 'en-wikipedia-org-static-apple-touch-wikipedia.png';
const fileJsName = 'en-wikipedia-org-some.js';
const phpFileName = 'en-wikipedia-org-w-opensearch-desc.php';
const homeFileName = 'en-wikipedia-org-home.html';

const simplePage = '<html><head></head><body><h1>Very simple page</h1></body></html>';
const formatHtml = (html) =>
	prettier.format(html, { parser: 'html', printWidth: 120, tabWidth: 4 });

let tempDir;
let fileOutputPath;

const getFixturePath = (filename, dir = '') =>
	path.join(__dirname, '..', '__fixtures__', dir, filename);
const getSrcPath = (filename) => path.join(tempDir, srcFolderName, filename);

nock.disableNetConnect();

test('transform name to kebabCase', () => {
	expect(makeName('en.wikipedia.org/path', '.html')).toEqual('en-wikipedia-org-path.html');
	expect(makeName('en.wikipedia.org/home/page')).toEqual('en-wikipedia-org-home-page_files');
});

beforeEach(async () => {
	tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('download page and src', async () => {
	const rawHtml = await fs.readFile(getFixturePath(wikiFileName), 'utf-8');
	const expectedLogoPng = await fs.readFile(getFixturePath(wikiLogoPngName, srcFolderName));
	const expectedPhpData = await fs.readFile(getFixturePath(phpFileName, srcFolderName), 'utf-8');
	const expectedJsData = await fs.readFile(getFixturePath(fileJsName, srcFolderName), 'utf-8');
	nock(wikiUrl)
		.get('/')
		.reply(200, rawHtml)
		.get('/static/apple-touch/wikipedia.png')
		.reply(200, expectedLogoPng)
		.get('/w/opensearch_desc.php')
		.reply(200, expectedPhpData)
		.get('/some.js')
		.reply(200, expectedJsData)
		.get('/home')
		.reply(200, rawHtml);
	fileOutputPath = await pageLoader(wikiUrl, tempDir);

	const actualJsData = await fs.readFile(getSrcPath(fileJsName), 'utf-8');
	const actualPhpData = await fs.readFile(getSrcPath(phpFileName), 'utf-8');
	const actualHtmlHome = await fs.readFile(getSrcPath(homeFileName), 'utf-8');
	const loadedHtml = await fs.readFile(fileOutputPath, 'utf-8');
	const expectedHTML = await fs.readFile(getFixturePath(changedHtmlFileName), 'utf-8');
	const actualLogoPng = await fs.readFile(getSrcPath(wikiLogoPngName));

	const downloadDir = path.dirname(fileOutputPath);
	const pathToSrcDir = path.join(downloadDir, srcFolderName);
	const filesSrc = await fs.readdir(pathToSrcDir);
	expect(filesSrc).toHaveLength(4);
	expect(loadedHtml).toEqual(formatHtml(expectedHTML));
	expect(actualHtmlHome).toEqual(rawHtml);
	expect(actualLogoPng).toEqual(expectedLogoPng);
	expect(actualJsData).toEqual(expectedJsData);
	expect(actualPhpData).toEqual(expectedPhpData);
});

test('get wrong path in url', async () => {
	nock(wikiUrl).get('/wrongpath').reply(404);
	const wrongPath = `${wikiUrl}/wrongpath`;
	await expect(pageLoader(wrongPath, tempDir)).rejects.toThrow('404');
});

test('wrong url', async () => {
	nock.enableNetConnect();
	await expect(pageLoader('http;//some.org', tempDir)).rejects.toThrow();
});

describe('check negative cases', () => {
	beforeAll(() => nock(wikiUrl).get('/simplePage').reply(200, simplePage));
	const someUrl = `${wikiUrl}/simplePage`;

	test('save page to not existing dir', async () => {
		const wrongPath = '/bad/way';
		await expect(pageLoader(someUrl, wrongPath)).rejects.toThrow('ENOENT');
	});

	test('will be permission denied', async () => {
		await expect(pageLoader(someUrl, '/sys')).rejects.toThrow('EACCES');
	});

	test('path is not a directory', async () => {
		await fs.writeFile(`${tempDir}/index.html`, '');
		await expect(pageLoader(someUrl, `${tempDir}/index.html`)).rejects.toThrow('ENOTDIR');
	});

	test('page without links', async () => {
		fileOutputPath = await pageLoader(someUrl, tempDir);
		expect(await fs.readFile(fileOutputPath, 'utf-8')).toEqual(formatHtml(simplePage));
	});
});
