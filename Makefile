install: install-deps

start:
	node bin/page-loader.js https://ru.hexlet.io/courses

install-deps:
	npm ci

publish:
	npm publish --dry-run

test:
	npm test

# tw:
# 	npx -n --experimental-vm-modules jest --watch --no-warnings

cover:
	npm test -- --coverage --coverageProvider=v8

lint:
	npx eslint .

fix:
	npx eslint --fix .

.PHONY: test