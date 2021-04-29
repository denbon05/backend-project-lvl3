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
        : [_.kebabCase(`${host}-${dir}-${name}`), ext].join('');
    },
  };
  return actions[type]();
};

export const isLocalSrc = (link, origin) => (!_.startsWith(link, '//')
  && _.startsWith(link, '/')) || _.startsWith(link, origin);
