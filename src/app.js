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
      .filter((_i, el) => !!$(el).attr(attr) && isLocalSrc($(el).attr(attr), href));
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
  logPageLoader('start downloading page with url %o', uri);
  return axios.get(uri)
    .then(({ data }) => fsPromises.access(outputDir, fs.constants.W_OK)
      .then(() => fsPromises.stat(outputDir))
      .then((stat) => {
        if (!stat.isDirectory()) throw Error(`ENOTDIR: not a directory, open ${outputDir}`);
      })
      .then(() => {
        logPageLoader('fetched data %O', data);
        const url = new URL(uri.trim());
        logPageLoader('parsed url %O', url);
        const absolutePath = path.resolve(outputDir);
        const dirSrcName = makeSrcDirName(`${url.host}${url.pathname}`);
        const filename = makeFileName(url);
        filePath = path.join(absolutePath, filename);
        const pathToDirSrcFiles = path.join(absolutePath, dirSrcName);
        const { links, updatedHTML } = changeSrc(data, dirSrcName, url);
        logPageLoader(`local src links on ${uri} %O`, links);
        logPageLoader('updatedHTML %O', updatedHTML);
        const formatedHTML = prettier.format(updatedHTML, {
          parser: 'html',
          printWidth: 120,
          tabWidth: 4,
        });
        fsPromises.writeFile(filePath, formatedHTML, 'utf-8');
        logPageLoader('path to dir with src is %o', pathToDirSrcFiles);
        return Promise.resolve({ links, pathToDirSrcFiles });
      })
      .then(({ links, pathToDirSrcFiles }) => {
        if (links.length > 0) fsPromises.mkdir(pathToDirSrcFiles);
        return downloadSrc(links, pathToDirSrcFiles);
      })
      .then((tasks) => tasks.run())
      .then(() => filePath));
};
