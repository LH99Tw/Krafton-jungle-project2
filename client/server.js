const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { renderHtml } = require('./lib/render-layout')

const root = __dirname
const port = Number(process.env.PORT || 5173)
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  if (pathname.startsWith('/api/')) {
    const proxy = http.request({
      hostname: '127.0.0.1',
      port: 54321,
      path: `/functions/v1${request.url}`,
      method: request.method,
      headers: { ...request.headers, host: '127.0.0.1:54321' },
    }, (upstream) => {
      response.writeHead(upstream.statusCode || 502, upstream.headers)
      upstream.pipe(response)
    })
    proxy.on('error', () => {
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: { message: '로컬 API 서버에 연결할 수 없습니다.' } }))
    })
    request.pipe(proxy)
    return
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const candidate = path.resolve(root, relative)
  const safe = candidate.startsWith(root + path.sep)
  const file = safe && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : null

  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('페이지를 찾을 수 없습니다.')
    return
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('서버에서 파일을 읽지 못했습니다.')
      return
    }
    const body = path.extname(file) === '.html' ? renderHtml(data.toString('utf8')) : data
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' })
    response.end(body)
  })
}).listen(port, '0.0.0.0', () => {
  console.log(`Static client: http://localhost:${port}`)
})
