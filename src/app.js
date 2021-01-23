import axios from 'axios';
import _ from 'lodash';
import { promises as fs } from 'fs';
import path from 'path';

export default (uri, outputDir) => axios.get(uri)
  .then(({ data }) => {
    const url = new URL(uri.trim());
    const filename = [_.kebabCase(`${url.host}${url.pathname}`), 'html'].join('.');
    const absolutePath = path.resolve(outputDir, filename);
    fs.writeFile(absolutePath, data, 'utf-8');
    return absolutePath;
  }, (err) => Promise.reject(err))
  .catch((err) => {
    console.log('err in app.js', err);
    return Promise.reject(err);
  });
