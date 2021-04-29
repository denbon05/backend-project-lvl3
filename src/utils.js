// @ts-check

import _ from 'lodash';
import path from 'path';

export const makeName = (value, type = 'dir', host = '') => {
  const actions = {
    dir: () => _.kebabCase(value),
    srcDir: () => [_.kebabCase(value), 'files'].join('_'),
    file: () => {
      const { ext, name, dir } = path.parse(value.replace(/\//g, '-'));
      if (!ext) return [_.kebabCase(`${host}-${dir}-${name}`), '.html'].join('');
      return !host ? [_.kebabCase(name), ext].join('')
        : [_.kebabCase(`${host}-${dir}-${name}`), ext].join('')
    },
  };
  return actions[type]();
};

export const isExtExist = (link) => {
  const ext = path.extname(link);
  const slashIdx = link.lastIndexOf('/');
  const dotExtIdx = link.lastIndexOf('.');
  return dotExtIdx > slashIdx && _.inRange(ext.length, 3, 6);
};

export const isLocalSrc = (link, origin) => (!_.startsWith(link, '//')
  && _.startsWith(link, '/')) || _.startsWith(link, origin);
