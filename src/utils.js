// @ts-check

import _ from 'lodash';
import path from 'path';

export const makeName = (fullname, extension = null) => {
  const name = fullname.slice(fullname.indexOf('//') + 1);
  if (extension) return [_.kebabCase(`${name}`), extension].join('');
  return [_.kebabCase(`${name}`), 'files'].join('_');
};

export const isExtExist = (link) => {
  const ext = path.extname(link);
  const slashIdx = link.lastIndexOf('/');
  const dotExtIdx = link.lastIndexOf('.');
  return dotExtIdx > slashIdx && _.inRange(ext.length, 3, 6);
};

export const isLocalSrc = (link, origin) => {
  const isLocal = (!_.startsWith(link, '//') && _.startsWith(link, '/')) || _.startsWith(link, origin);
  return isLocal;
};