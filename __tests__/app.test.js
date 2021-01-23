// @ts-check

import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import os from 'os';
import nock from 'nock';
import { fileURLToPath } from 'url';
import pageLoader from '../index.js';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const hexletUrl = 'https://ru.hexlet.io';

const getPath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);
// eslint-disable-next-line
const readFile = async (filename) => await fs.readFile(getPath(filename), 'utf-8');

let tempDir;

nock.disableNetConnect();

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('download page', async () => {
  const data = await readFile('hexlet-curses.html');
  nock(hexletUrl).get('/courses').reply(200, data);
  const outputPath = await pageLoader(`${hexletUrl}/courses`, tempDir);
  console.log('outputPath->', outputPath);
  const loadedHtml = await fs.readFile(outputPath, 'utf-8');
  expect(loadedHtml).toEqual(data);
});
