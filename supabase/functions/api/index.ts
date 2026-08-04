const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Tistory API',
    version: '1.0.0',
    description: 'Tistory clone backend API deployed on Supabase Edge Functions.',
  },
  servers: [{ url: './' }],
  paths: {
    '/health': {
      get: {
        summary: 'Check API health',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthResponse: {
        type: 'object',
        required: ['status', 'service', 'runtime'],
        properties: {
          status: { type: 'string', example: 'ok' },
          service: { type: 'string', example: 'tistory-api' },
          runtime: { type: 'string', example: 'supabase-edge-functions' },
        },
      },
    },
  },
}

const json = (body: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const swaggerAsset = async (path: 'swagger-ui.css' | 'swagger-ui-bundle.js') => {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.12/${path}`)
  return new Response(response.body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': path.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

const swaggerUi = () => new Response(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tistory API Docs</title>
    <link rel="stylesheet" href="./swagger-ui.css?v=2" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="./swagger-ui-bundle.js?v=2"></script>
    <script>
      window.addEventListener('load', () => {
        if (!window.SwaggerUIBundle) {
          document.getElementById('swagger-ui').textContent = 'Swagger UI 스크립트를 불러오지 못했습니다.';
          return;
        }
        window.ui = SwaggerUIBundle({
          url: 'https://tirnfqlznctbvwzfolmq.supabase.co/functions/v1/api/openapi.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis],
          layout: 'BaseLayout'
        });
      });
    </script>
  </body>
</html>`, { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })

Deno.serve((request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)

  const pathname = new URL(request.url).pathname
  if (pathname.endsWith('/swagger-ui.css')) return swaggerAsset('swagger-ui.css')
  if (pathname.endsWith('/swagger-ui-bundle.js')) return swaggerAsset('swagger-ui-bundle.js')
  if (pathname.endsWith('/openapi.json')) {
    return new Response(JSON.stringify(openApiDocument), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (pathname.endsWith('/docs') || pathname.endsWith('/docs/')) {
    return Response.redirect('https://krafton-jungle-project2-client.vercel.app/api-docs.html', 302)
  }
  if (pathname.endsWith('/health') || pathname.endsWith('/api')) {
    return json({ status: 'ok', service: 'tistory-api', runtime: 'supabase-edge-functions' })
  }

  return json({ error: 'not_found' }, 404)
})
