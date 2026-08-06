import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyUrl = new URL(
  process.env.VITE_API_PROXY_TARGET
    ?? 'https://tirnfqlznctbvwzfolmq.supabase.co/functions/v1',
)

export default defineConfig({
  plugins: [react()],
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
