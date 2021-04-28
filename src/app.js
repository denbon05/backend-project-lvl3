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
import { isLocalSrc, makeName, isExtExist } from './utils.js';

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
  const coll = links.map((link) => {
    logPageLoader('link in downloadSrc %o', link);
    const filenameWithoutExt = isExtExist(link) ? link.slice(0, link.lastIndexOf('.')) : link;
    const ext = isExtExist(link) ? path.extname(link) : '.html';
    const filename = makeName(filenameWithoutExt, ext);
    logPageLoader('filename in downloadSrc %o', filename);
    const filepath = path.join(pathToDirSrcFiles, filename);
    const listrTask = { title: `Download into '${filename}'` };
    listrTask.task = () => axios
      .get(link, { responseType: 'arraybuffer' })
      .then(({ data }) => fsPromises.writeFile(filepath, data));
    return listrTask;
  });
  const tasks = new Listr(coll, { concurrent: true });
  return Promise.resolve(tasks);
};

// prettier-ignore
const changeSrc = (data, dirSrcName, { host, origin }) => {
  const $ = cheerio.load(data);
  const tagsWithSrc = [{ img: 'src' }, { script: 'src' }, { link: 'href' }];
  const links = tagsWithSrc.map((tagData) => {
    const [[tag, attr]] = Object.entries(tagData);
    const tagsWithLocalSrc = $(tag)
      .filter((_i, el) => !!$(el).attr(attr) && isLocalSrc($(el).attr(attr), origin));
    return tagsWithLocalSrc.map((_i, el) => {
      const oldAttrValue = $(el).attr(attr);
      const { ext, name, dir } = path.parse(oldAttrValue);
      const filename = ext
        ? makeName(`${host}-${dir}-${name}`, ext)
        : makeName(`${host}-${dir}-${name}`, '.html');
      const newSrc = path.join(dirSrcName, filename);
      $(el).attr(attr, newSrc);
      logPageLoader('filename %O', filename);
      return _.startsWith(oldAttrValue, origin) ? oldAttrValue : `${origin}${oldAttrValue}`;
    }).toArray();
  });
  return { links: _.flatten(links), updatedHTML: $.html() };
};

export default (uri, outputDir = process.cwd()) => {
  let filePath;
  logPageLoader('start downloading page with url %o', uri);
  return fsPromises
    .access(outputDir, fs.constants.W_OK)
    .then(() => fsPromises.stat(outputDir))
    .then((stat) => {
      if (!stat.isDirectory()) throw Error(`ENOTDIR: not a directory, open ${outputDir}`);
      return axios.get(uri);
    })
    .then(({ data }) => {
      logPageLoader('fetched data %O', data);
      const url = new URL(uri.trim());
      logPageLoader('parsed url %O', url);
      const absolutePath = path.resolve(outputDir);
      const dirSrcName = makeName(`${url.host}${url.pathname}`);
      const filename = makeName(`${url.host}${url.pathname}`, '.html');
      filePath = path.join(absolutePath, filename);
      const pathToDirSrcFiles = path.join(absolutePath, dirSrcName);
      const { links, updatedHTML } = changeSrc(data, dirSrcName, url);
      logPageLoader(`local src links on ${uri} %O`, links);
      const formatedHTML = prettier.format(updatedHTML, {
        parser: 'html',
        printWidth: 120,
        tabWidth: 4,
      });
      fsPromises.writeFile(filePath, formatedHTML, 'utf-8');
      fsPromises.mkdir(pathToDirSrcFiles);
      logPageLoader('path to dir with src is %o', pathToDirSrcFiles);
      return Promise.resolve({ links, pathToDirSrcFiles });
    })
    .then(({ links, pathToDirSrcFiles }) => downloadSrc(links, pathToDirSrcFiles))
    .then((tasks) => tasks.run())
    .then(() => filePath);
};
