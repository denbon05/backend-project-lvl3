# Page-loader

## Description

<p>Page-loader downloads the selected site and its local resources</p>

## Hexlet tests and linter status:

[![Actions Status](https://github.com/denbon05/backend-project-lvl3/workflows/hexlet-check/badge.svg)](https://github.com/denbon05/backend-project-lvl3/actions)
[![Maintainability](https://api.codeclimate.com/v1/badges/35968fad3df339d478a4/maintainability)](https://codeclimate.com/github/denbon05/backend-project-lvl3/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/35968fad3df339d478a4/test_coverage)](https://codeclimate.com/github/denbon05/backend-project-lvl3/test_coverage)

## Usage

### Install

<pre>
git clone https://github.com/denbon05/backend-project-lvl3.git
cd backend-project-lvl3
make install
</pre>

### After commands above:

<pre>
page-loader [options] &lturl>

// Examples:

page-loader https://en.wikipedia.org/wiki/Home_page
// page downloaded in './en-wikipedia-org-wiki-home-page.html'
// all page src downloaded in default dir './en-wikipedia-org-wiki-home-page_files'
</pre>

<dl>
  <dt>options
    <dd>-o, --output [dir] <p><small>output dir (default: "./")</small></p></dd>
  </dt>
</dl>

### Debug page-loader

[![asciicast](https://asciinema.org/a/387835.svg)](https://asciinema.org/a/387835)

### Errors handle

[![asciicast](https://asciinema.org/a/388218.svg)](https://asciinema.org/a/388218)

### Instal page-loader and download page with local resources

[![asciicast](https://asciinema.org/a/388264.svg)](https://asciinema.org/a/388264)
