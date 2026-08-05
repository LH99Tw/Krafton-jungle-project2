import { corsHeaders, json } from '../shared.ts'
import { openApiDocument } from './openapi.ts'

const swaggerAsset = async (path: 'swagger-ui.css' | 'swagger-ui-bundle.js') => {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.12/${path}`)
  return new Response(response.body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': path.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export const handleSystemRoute = (request: Request, path: string): Response | Promise<Response> | null => {
  if (request.method !== 'GET') return null
  if (path === '/swagger-ui.css') return swaggerAsset('swagger-ui.css')
  if (path === '/swagger-ui-bundle.js') return swaggerAsset('swagger-ui-bundle.js')
  if (path === '/openapi.json') return json(openApiDocument)
  if (path === '/docs' || path === '/docs/') {
    return Response.redirect('https://krafton-jungle-project2-client.vercel.app/api-docs.html', 302)
  }
  if (path === '/health' || path === '/') {
    return json({ status: 'ok', service: 'tistory-api', runtime: 'supabase-edge-functions' })
  }
  return null
}
