#!/usr/bin/env node
import pkg from 'commander';
import pageLoader from '../index.js';

const { program } = pkg;

program
  .version('1.0.0')
  .description('Download page and put it to the specified directory.')
  .option('-o, --output [dir]', 'output dir (default: "./app")')
  .arguments('<url>')
  .action(async (url) => {
    const pathname = await pageLoader(url, program.output = process.cwd());
    console.log(pathname);
  })
  .parse(process.argv);
