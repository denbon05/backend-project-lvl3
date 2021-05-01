// @ts-check

import _ from 'lodash';
import path from 'path';

export const makeSrcDirName = (value) => [_.kebabCase(value), 'files'].join('_');

export const makeFileName = (value, host) => {
  const { ext, name, dir } = path.parse(value.replace(/\//g, '-'));
  if (!ext) return [_.kebabCase(`${host}-${dir}-${name}`), '.html'].join('');
  return !host ? [_.kebabCase(name), ext].join('')
    : [_.kebabCase(`${host}-${dir}-${name}`), ext].join('');
};

export const isLocalSrc = (link, origin) => (!_.startsWith(link, '//')
  && _.startsWith(link, '/')) || _.startsWith(link, origin);
