const fs = require('node:fs')
const path = require('node:path')
const { renderHtml } = require('./lib/render-layout')

const projectRoot = __dirname
const outputRoot = path.join(projectRoot, 'dist')
const pages = [
  'index.html',
  'agreement.html',
  'blog-new.html',
  'blog.html',
  'feed.html',
  'ai.html',
  'login.html',
  'manage.html',
  'notice.html',
  'post.html',
  'signup.html',
  'skin.html',
  'write.html',
]

fs.rmSync(outputRoot, { recursive: true, force: true })
fs.mkdirSync(path.join(outputRoot, 'src'), { recursive: true })

for (const page of pages) {
  const source = fs.readFileSync(path.join(projectRoot, page), 'utf8')
  fs.writeFileSync(path.join(outputRoot, page), renderHtml(source))
}

for (const asset of ['app.js', 'layout-client.js', 'static-pages.css']) {
  fs.copyFileSync(path.join(projectRoot, asset), path.join(outputRoot, asset))
}

fs.copyFileSync(path.join(projectRoot, 'src', 'styles.css'), path.join(outputRoot, 'src', 'styles.css'))
fs.cpSync(path.join(projectRoot, 'public'), outputRoot, { recursive: true })

console.log(`Static output: ${path.relative(projectRoot, outputRoot)}`)
