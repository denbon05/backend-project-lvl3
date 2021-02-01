install: install-deps

install-deps:
	npm ci

test:
	npm test

nock debug-nock:
	DEBUG=nock.scope:* npm test

format:
	npx prettier --write .

cover:
	npm test -- --coverage --coverageProvider=v8

lint:
	npx eslint .

fix:
	npx eslint --fix .

.PHONY: test