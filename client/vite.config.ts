import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const spaDocumentFallback = () => {
  const rewriteDocument = (request: { method?: string; url?: string; headers: { accept?: string } }) => {
    if (request.method !== 'GET' || !request.headers.accept?.includes('text/html')) return
    const url = new URL(request.url ?? '/', 'http://vite.local')
    if (url.pathname.startsWith('/api') || url.pathname.split('/').pop()?.includes('.')) return
    request.url = `/index.html${url.search}`
  }

  return {
    name: 'spa-document-fallback-before-static-html',
    enforce: 'pre' as const,
    configureServer(server: { middlewares: { use: (handler: (request: Parameters<typeof rewriteDocument>[0], response: unknown, next: () => void) => void) => void } }) {
      server.middlewares.use((request, _response, next) => { rewriteDocument(request); next() })
    },
    configurePreviewServer(server: { middlewares: { use: (handler: (request: Parameters<typeof rewriteDocument>[0], response: unknown, next: () => void) => void) => void } }) {
      server.middlewares.use((request, _response, next) => { rewriteDocument(request); next() })
    },
  }
}

const apiProxyUrl = new URL(
  process.env.VITE_API_PROXY_TARGET
    ?? 'https://npuyxiqjowqeewesmctq.supabase.co/functions/v1',
)

export default defineConfig({
  plugins: [spaDocumentFallback(), react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: apiProxyUrl.origin,
        changeOrigin: true,
        rewrite: (requestPath) => `${apiProxyUrl.pathname.replace(/\/$/, '')}${requestPath}`,
      },
    },
  },
  preview: { host: '0.0.0.0', allowedHosts: ['.vercel.app'] },
})
