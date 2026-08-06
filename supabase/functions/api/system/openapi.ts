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
    '/blogs': { post: {
      summary: 'Create a blog and reserve its public address',
      description: 'Stores the normalized slug and returns the canonical public path as /blog/{slug}.',
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', required: ['name', 'slug'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 30 },
          slug: { type: 'string', pattern: '^(?!.*--)[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$', example: 'jungle-dev' },
          description: { type: 'string', maxLength: 160 },
        },
      } } } },
      responses: { '201': { description: 'Blog created with its canonical URL' }, '400': { description: 'Invalid name, slug, or description' }, '401': { description: 'Unauthenticated' }, '403': { description: 'Invalid CSRF token' }, '409': { description: 'Blog or slug already exists' } },
    } },
    '/blogs/check-slug': { get: {
      summary: 'Check blog address availability',
      description: 'Normalizes the slug and returns the canonical public path. Availability is advisory; POST /blogs performs the final unique check.',
      parameters: [{ name: 'slug', in: 'query', required: true, schema: { type: 'string', pattern: '^(?!.*--)[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' } }],
      responses: { '200': { description: 'Normalized slug, canonical URL, and availability' }, '400': { description: 'Invalid or reserved slug' } },
    } },
    '/blogs/me': {
      get: { summary: 'Get current user blog', responses: { '200': { description: 'Current blog' } } },
      patch: { summary: 'Update mutable blog profile fields', description: 'Updates name and description. Slug is immutable.', responses: { '200': { description: 'Blog updated' }, '400': { description: 'Validation error or immutable slug' } } },
    },
    '/blogs/me/profile-image': {
      post: { summary: 'Upload cropped WebP profile image', responses: { '200': { description: 'Profile image URL' }, '400': { description: 'Invalid WebP or over 2MB' } } },
      delete: { summary: 'Reset profile image', responses: { '204': { description: 'Profile image removed' } } },
    },
    '/blogs/me/dashboard': { get: { summary: 'Get blog management dashboard', responses: { '200': { description: 'Counts and recent content' } } } },
    '/blogs/me/categories': {
      get: { summary: 'List ordered blog categories and post counts', responses: { '200': { description: 'Category list' } } },
      post: { summary: 'Create a blog category', responses: { '201': { description: 'Category created' }, '409': { description: 'Duplicate or category limit' } } },
    },
    '/blogs/me/categories/order': { patch: { summary: 'Replace complete category order', responses: { '200': { description: 'Order saved' } } } },
    '/blogs/me/categories/{id}': {
      patch: { summary: 'Rename a category', responses: { '200': { description: 'Category updated' } } },
      delete: { summary: 'Delete an unused category', responses: { '204': { description: 'Category deleted' }, '409': { description: 'CATEGORY_IN_USE' } } },
    },
    '/blogs/{slug}': { get: {
      summary: 'Get a public creator blog, posts, and shop items',
      description: 'Returns the blog profile with subscriberCount, published posts, and up to eight market items owned by the blogger.',
      responses: { '200': { description: 'Public personalized blog' }, '404': { description: 'Blog not found' } },
    } },
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
      delete: { summary: 'Move an owned post to 30-day trash', responses: { '204': { description: 'Post moved to trash' } } },
    },
    '/posts/{id}/restore': { post: { summary: 'Restore a trashed post', responses: { '200': { description: 'Post restored' } } } },
    '/posts/{id}/permanent': { delete: { summary: 'Permanently delete a trashed post', responses: { '204': { description: 'Post deleted' } } } },
    '/market/items/{id}/restore': { post: { summary: 'Restore a trashed market item', responses: { '200': { description: 'Item restored' } } } },
    '/market/items/{id}/permanent': { delete: { summary: 'Permanently delete or tombstone a trashed item', responses: { '204': { description: 'Item purged' } } } },
    '/health': { get: { summary: 'Check API health', responses: { '200': { description: 'API is healthy' } } } },
  },
}
