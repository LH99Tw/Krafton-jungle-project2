export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Tistory API',
    version: '1.0.0',
    description: 'Tistory clone backend API deployed on Supabase Edge Functions.',
  },
  paths: {
    '/auth/signup': { post: {
      summary: 'Create a user and sign in',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object',
          required: ['email', 'nickname', 'password', 'passwordConfirm'],
          properties: {
            email: { type: 'string', format: 'email', maxLength: 255 },
            nickname: { type: 'string', minLength: 2, maxLength: 30 },
            password: { type: 'string', minLength: 8, maxLength: 72 },
            passwordConfirm: { type: 'string' },
          },
        } } },
      },
      responses: { '201': { description: 'User created and signed in' }, '400': { description: 'Validation error' }, '403': { description: 'Invalid CSRF token' }, '409': { description: 'Email already exists' } },
    } },
    '/auth/login': { post: { summary: 'Sign in with email and password', responses: { '200': { description: 'Signed in' }, '400': { description: 'Validation error' }, '401': { description: 'Invalid credentials' }, '403': { description: 'Invalid CSRF token' } } } },
    '/auth/logout': { post: { summary: 'Destroy the current session', responses: { '204': { description: 'Signed out' } } } },
    '/auth/csrf': { get: {
      summary: 'Issue a CSRF token',
      responses: { '200': {
        description: 'CSRF token issued',
        content: { 'application/json': { schema: {
          type: 'object',
          properties: { data: { type: 'object', properties: { csrfToken: { type: 'string' } } } },
        } } },
      } },
    } },
    '/me': { get: { summary: 'Get the current user and blog', responses: { '200': { description: 'Current user' }, '401': { description: 'Unauthenticated' } } } },
    '/blogs': { post: { summary: 'Create a blog', responses: { '201': { description: 'Blog created' } } } },
    '/blogs/check-slug': { get: { summary: 'Check blog slug availability', responses: { '200': { description: 'Availability' } } } },
    '/blogs/me': { get: { summary: 'Get current user blog', responses: { '200': { description: 'Current blog' } } } },
    '/blogs/{slug}': { get: { summary: 'Get public blog and posts', responses: { '200': { description: 'Public blog' } } } },
    '/blogs/{slug}/subscription': {
      post: { summary: 'Subscribe to a blog', responses: { '201': { description: 'Subscribed' } } },
      delete: { summary: 'Unsubscribe from a blog', responses: { '204': { description: 'Unsubscribed' } } },
    },
    '/posts': {
      get: { summary: 'List public or owned posts', responses: { '200': { description: 'Post list' } } },
      post: { summary: 'Create a draft or published post', responses: { '201': { description: 'Post created' } } },
    },
    '/posts/{id}': {
      get: { summary: 'Read a post', responses: { '200': { description: 'Post detail' } } },
      patch: { summary: 'Update an owned post', responses: { '200': { description: 'Post updated' } } },
      delete: { summary: 'Delete an owned post', responses: { '204': { description: 'Post deleted' } } },
    },
    '/health': { get: { summary: 'Check API health', responses: { '200': { description: 'API is healthy' } } } },
  },
}
