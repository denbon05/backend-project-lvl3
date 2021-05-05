// @ts-check

import axios from 'axios';
import _ from 'lodash';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import prettier from 'prettier';
import debug from 'debug';
import axiosDebug from 'axios-debug-log';
import Listr from 'listr';
import { isLocalSrc, makeFileName, makeSrcDirName } from './utils.js';

axiosDebug({
  request: (logAxios, config) => {
    logAxios(`Request with ${config.headers['content-type']}`);
  },
  response: (logAxios, response) => {
    logAxios(`Response with ${response.headers['content-type']}`, `from ${response.config.url}`);
  },
  error: (logAxios, error) => {
    logAxios('error is', error);
  },
});

const logPageLoader = debug('page-loader');

const downloadSrc = (links, pathToDirSrcFiles) => {
  const coll = links.map(({ link, filename }) => {
    logPageLoader('link in downloadSrc %o', link);
    logPageLoader('filename in downloadSrc %o', filename);
    const listrTask = { title: `Download into '${filename}'` };
    listrTask.task = () => axios
      .get(link, { responseType: 'arraybuffer' })
      .then(({ data }) => fsPromises.writeFile(path.join(pathToDirSrcFiles, filename), data));
    return listrTask;
  });
  const tasks = new Listr(coll, { concurrent: true });
  return Promise.resolve(tasks);
};

// prettier-ignore
const changeSrc = (data, dirSrcName, { href, origin }) => {
  const $ = cheerio.load(data);
  const tagsWithSrc = [
    { tag: 'img', attr: 'src' },
    { tag: 'script', attr: 'src' },
    { tag: 'link', attr: 'href' },
  ];
  const links = tagsWithSrc.map(({ tag, attr }) => {
    const tagsWithLocalSrc = $(tag)
      .filter((_i, el) => !!$(el).attr(attr) && isLocalSrc($(el).attr(attr), origin));
    return tagsWithLocalSrc.map((_i, el) => {
      const oldAttrValue = $(el).attr(attr);
      logPageLoader('oldAttrValue %O', oldAttrValue);
      const link = oldAttrValue.match(href) ? new URL(oldAttrValue)
        : new URL(oldAttrValue, origin);
      logPageLoader('link %O', link);
      const filename = makeFileName(link);
      const newSrc = path.join(dirSrcName, filename);
      logPageLoader('newSrc %O', newSrc);
      $(el).attr(attr, newSrc);
      return { link: link.href, filename };
    }).toArray();
  });
  return { links: _.flatten(links), updatedHTML: $.html() };
};

export default (uri, outputDir = process.cwd()) => {
  let filePath;
  let links;
  let pathToDirSrcFiles;

  const absolutePath = path.resolve(outputDir);

  logPageLoader('start downloading page with url %o', uri);
  return axios.get(uri)
    .then(({ data }) => {
      const url = new URL(uri.trim());
      logPageLoader('fetched data %O', data);
      logPageLoader('parsed url %O', url);
      const dirSrcName = makeSrcDirName(`${url.host}${url.pathname}`);
      pathToDirSrcFiles = path.join(absolutePath, dirSrcName);
      const filename = makeFileName(url);
      filePath = path.join(absolutePath, filename);
      const srcData = changeSrc(data, dirSrcName, url);
      links = srcData.links;
      logPageLoader(`local src links on ${uri} %O`, links);
      logPageLoader('updatedHTML %O', srcData.updatedHTML);
      const formatedHTML = prettier.format(srcData.updatedHTML, {
        parser: 'html',
        printWidth: 120,
        tabWidth: 4,
      });
      logPageLoader('path to dir with src is %o', pathToDirSrcFiles);
      return fsPromises.writeFile(filePath, formatedHTML, 'utf-8');
    })
    .then(() => {
      if (links.length > 0 && !fs.existsSync(pathToDirSrcFiles)) {
        fsPromises.mkdir(pathToDirSrcFiles);
      }
    })
    .then(() => downloadSrc(links, pathToDirSrcFiles))
    .then((tasks) => tasks.run())
    .then(() => filePath);
};
