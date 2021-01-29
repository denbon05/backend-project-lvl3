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
const wikiLogoPng = 'en-wikipedia-org-static-apple-touch-wikipedia.png';
const fileJsName = 'en-wikipedia-org-some.js';
const phpFileName = 'en-wikipedia-org-w-opensearch-desc.php';

let tempDir;
let fileOutputPath;
const src = {};

const getFixturePath = (filename, dir = '') =>
	path.join(__dirname, '..', '__fixtures__', dir, filename);
const getSrcPath = (filename) => path.join(tempDir, srcFolderName, filename);

nock.disableNetConnect();

test('transform name to kebabCase', () => {
	expect(makeName('en.wikipedia.org/path', '.html')).toEqual('en-wikipedia-org-path.html');
	expect(makeName('en.wikipedia.org/home/page')).toEqual('en-wikipedia-org-home-page_files');
});

describe('download page and src', () => {
	beforeAll(async () => {
		src.expectedHtml = await fs.readFile(getFixturePath(wikiFileName), 'utf-8');
		src.expectedLogoPng = await fs.readFile(getFixturePath(wikiLogoPng, srcFolderName));
		src.expectedPhpData = await fs.readFile(getFixturePath(phpFileName, srcFolderName), 'utf-8');
		src.expectedJsData = await fs.readFile(getFixturePath(fileJsName, srcFolderName), 'utf-8');
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
		nock(wikiUrl)
			.get('/')
			.reply(200, src.expectedHtml)
			.get('/static/apple-touch/wikipedia.png')
			.reply(200, src.expectedLogoPng)
			.get('/w/opensearch_desc.php')
			.reply(200, src.expectedPhpData)
			.get('/some.js')
			.reply(200, src.expectedJsData);
		fileOutputPath = await pageLoader(wikiUrl, tempDir);
	});

	test('update src in html', async () => {
		const loadedHtml = await fs.readFile(fileOutputPath, 'utf-8');
		const expectedHTML = await fs.readFile(getFixturePath(changedHtmlFileName), 'utf-8');
		expect(loadedHtml).toEqual(prettier.format(expectedHTML, { parser: 'html' }));
	});

	test('compare downloaded src', async () => {
		const actualLogoPng = await fs.readFile(getSrcPath(wikiLogoPng));
		const actualJsData = await fs.readFile(getSrcPath(fileJsName), 'utf-8');
		const actualPhpData = await fs.readFile(getSrcPath(phpFileName), 'utf-8');
		const downloadDir = path.dirname(fileOutputPath);
		const pathToSrcDir = path.join(downloadDir, srcFolderName);
		const filesSrc = await fs.readdir(pathToSrcDir);
		expect(filesSrc).toHaveLength(3);
		expect(actualLogoPng).toEqual(src.expectedLogoPng);
		expect(actualJsData).toEqual(src.expectedJsData);
		expect(actualPhpData).toEqual(src.expectedPhpData);
	});
});
