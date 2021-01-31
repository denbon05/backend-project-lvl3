#!/usr/bin/env node
import pkg from 'commander';
import pageLoader from '../index.js';

const { program } = pkg;

program
	.version('1.0.0')
	.description('Download page and put it to the specified directory.')
	.option('-o, --output [dir]', 'output dir (default: "./")')
	.arguments('<url>')
	.action((url) => {
		const { output } = program.opts();
		pageLoader(url, output)
			.then((pathname) => {
				console.log(`Page was successfully downloaded into '${pathname}'`);
			})
			.catch((err) => {
				console.error(`${err.message} with url ${url}`);
				process.exit(1);
			});
	})
	.parse(process.argv);
