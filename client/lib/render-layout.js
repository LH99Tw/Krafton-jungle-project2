const fs = require('node:fs')
const path = require('node:path')

const clientRoot = path.resolve(__dirname, '..')
const partialRoot = path.join(clientRoot, 'partials')

function readPartial(name) {
  return fs.readFileSync(path.join(partialRoot, `${name}.html`), 'utf8').trim()
}

function renderHeader(options) {
  const values = new Set(options.trim().split(/\s+/).filter(Boolean))
  const activePage = ['home', 'feed', 'skin', 'forum'].find((page) => values.has(page))
  const account = values.has('signed')
    ? '<a class="profile-trigger" href="./manage.html" aria-label="블로그 관리">정</a>'
    : '<a class="outline-button" href="./login.html">시작하기</a>'

  let header = readPartial('header').replace('{{account}}', account)
  if (activePage) {
    header = header.replace(`data-nav="${activePage}"`, `class="active" data-nav="${activePage}" aria-current="page"`)
  }
  return header
}

function renderHtml(source) {
  return source.replace(
    /<!--\s*include:(header|footer|notice-header|notice-footer)(.*?)-->/g,
    (_marker, name, options = '') => name === 'header' ? renderHeader(options) : readPartial(name),
  )
}

module.exports = { renderHtml }
