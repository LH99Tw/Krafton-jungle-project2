export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Jungletory API',
    version: '1.0.0',
    description: 'Jungletory clone backend API deployed on Supabase Edge Functions.',
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
    '/auth/change-password': { post: { summary: 'Replace a temporary or current user password', responses: { '200': { description: 'Password changed' }, '401': { description: 'Current password invalid' } } } },
    '/auth/interests': { patch: { summary: 'Replace the current user interests', responses: { '200': { description: 'Interests updated' }, '400': { description: 'Invalid interests' }, '401': { description: 'Unauthenticated' } } } },
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
    '/me': {
      get: { summary: 'Get the current user and blog', responses: { '200': { description: 'Current user' }, '401': { description: 'Unauthenticated' } } },
      delete: { summary: 'Reauthenticate and withdraw the current account while retaining posts and market items in the administrator trash', responses: { '204': { description: 'Account withdrawn and content hidden' } } },
    },
    '/me/third-party-consent': { post: { summary: 'Record the current user third-party processing consent decision', responses: { '200': { description: 'Consent decision saved' }, '400': { description: 'Invalid consent decision' }, '401': { description: 'Unauthenticated' } } } },
    '/ai/state': { get: { summary: 'Get companion, conversation, mission and daily AI quota state', responses: { '200': { description: 'AI companion state' }, '401': { description: 'Login required' } } } },
    '/ai/companion': { patch: { summary: 'Select an AI character and record AI processing consent', responses: { '200': { description: 'Updated AI state' }, '400': { description: 'Character or consent missing' } } } },
    '/ai/messages': { post: {
      summary: 'Send one personality-preserving character conversation turn',
      description: 'Selects up to three verified service knowledge entries from the message and optional current pathname. Limited to 20 successful model turns per user and 200 globally per KST day.',
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', required: ['body', 'idempotencyKey'],
        properties: { body: { type: 'string', minLength: 1, maxLength: 300 }, idempotencyKey: { type: 'string' }, context: { type: 'object', properties: { pathname: { type: 'string', description: 'Current internal application pathname; unknown paths are ignored.' } } } },
      } } } },
      responses: { '201': { description: 'Character reply, verified optional suggestedAction, and remaining quota' }, '429': { description: 'Per-minute, user daily, or global daily limit reached' } },
    } },
    '/ai/history': { delete: { summary: 'Delete completed AI messages and the saved memory summary', responses: { '200': { description: 'History deleted' } } } },
    '/ai/missions/{id}/start': { post: { summary: 'Start or resume one of the three server-verified companion missions', responses: { '200': { description: 'Mission mode state' }, '409': { description: 'Companion missing or mission already completed' } } } },
    '/ai/missions/{id}/pause': { post: { summary: 'Pause a mission and return to general conversation', responses: { '200': { description: 'General conversation state' } } } },
    '/blogs': {
      get: { summary: 'List and search blogs', parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } }, { name: 'size', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } }], responses: { '200': { description: 'Paginated blog list' } } },
      post: {
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
      },
    },
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
    '/blogs/me/stats': { get: { summary: 'Get total published post views and unique blog visitors', responses: { '200': { description: 'Home account panel statistics' } } } },
    '/blogs/me/categories': {
      get: { summary: 'List selectable blog categories and post counts', description: 'The post editor reads this list but never creates categories.', responses: { '200': { description: 'Category list' } } },
      post: { summary: 'Create a blog category from blog management', responses: { '201': { description: 'Category created' }, '409': { description: 'Duplicate or category limit' } } },
    },
    '/blogs/me/categories/order': { patch: { summary: 'Replace complete category order', responses: { '200': { description: 'Order saved' } } } },
    '/blogs/me/categories/{id}': {
      patch: { summary: 'Rename a category', responses: { '200': { description: 'Category updated' } } },
      delete: { summary: 'Delete an unused category', responses: { '204': { description: 'Category deleted' }, '409': { description: 'CATEGORY_IN_USE' } } },
    },
    '/blogs/me/classifications': {
      get: { summary: 'List writer classifications, source, and usage counts', responses: { '200': { description: 'Classification list with source INTEREST or CUSTOM' } } },
      post: { summary: 'Create an interest or custom classification', description: 'INTEREST names must exist in the current user interests. CUSTOM classifications are created explicitly in the post editor.', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'source'], properties: { name: { type: 'string', minLength: 1, maxLength: 30 }, source: { type: 'string', enum: ['INTEREST', 'CUSTOM'] } } } } } }, responses: { '201': { description: 'Classification created with source' }, '400': { description: 'Invalid name or interest source' } } },
    },
    '/blogs/me/classifications/order': { patch: { summary: 'Replace complete classification order', responses: { '200': { description: 'Order saved' } } } },
    '/blogs/me/classifications/{id}': {
      patch: { summary: 'Rename a classification', responses: { '200': { description: 'Classification updated' } } },
      delete: { summary: 'Delete an unused classification', responses: { '204': { description: 'Classification deleted' }, '409': { description: 'CLASSIFICATION_IN_USE' } } },
    },
    '/blogs/{slug}': { get: {
      summary: 'Get a public creator blog, posts, and shop items',
      description: 'Returns the blog profile with subscriberCount, published posts, and up to eight market items owned by the blogger.',
      responses: { '200': { description: 'Public personalized blog' }, '404': { description: 'Blog not found' } },
    } },
    '/preferences/me': {
      get: { summary: 'Get preference catalog and current selections', responses: { '200': { description: 'Preferences' } } },
      put: { summary: 'Replace current user preferences and complete onboarding', responses: { '200': { description: 'Preferences saved' } } },
    },
    '/blogs/{slug}/subscription': {
      post: { summary: 'Subscribe to a blog', responses: { '201': { description: 'Subscribed' } } },
      delete: { summary: 'Unsubscribe from a blog', responses: { '204': { description: 'Unsubscribed' } } },
    },
    '/posts': {
      get: {
        summary: 'List public, owned, followed, or bookmarked posts',
        parameters: [
          { name: 'scope', in: 'query', schema: { type: 'string', enum: ['public', 'mine', 'following', 'bookmarked'], default: 'public' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['latest', 'popular'], default: 'latest' } },
        ],
        responses: { '200': { description: 'Post list with category, classifications, reaction counts, and the current user state' } },
      },
      post: {
        summary: 'Create a draft or published post',
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['title', 'contentText', 'contentDocument', 'status'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 100 }, content: { type: 'string', minLength: 1, deprecated: true },
            contentText: { type: 'string', minLength: 1, maxLength: 20000 }, contentDocument: { type: 'object', description: 'Validated TipTap JSON document' },
            draftKey: { type: 'string', format: 'uuid', description: 'Connects temporary image uploads to this post' },
            status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'] }, categoryId: { type: 'integer', nullable: true },
            classificationIds: { type: 'array', maxItems: 5, uniqueItems: true, items: { type: 'integer' } },
          },
        } } } },
        responses: { '201': { description: 'Post created' }, '400': { description: 'Invalid category or classifications' } },
      },
    },
    '/posts/{id}': {
      get: { summary: 'Read a post', responses: { '200': { description: 'Post detail' } } },
      patch: { summary: 'Update an owned post', responses: { '200': { description: 'Post updated' } } },
      delete: { summary: 'Move an owned post to 30-day trash', responses: { '204': { description: 'Post moved to trash' } } },
    },
    '/posts/images': {
      post: { summary: 'Upload an optimized post image', description: 'Accepts multipart WebP images up to 2MB. A draft may own at most five images.', responses: { '201': { description: 'Image asset created' }, '400': { description: 'Invalid image' }, '409': { description: 'Image limit reached' } } },
    },
    '/posts/images/{id}': { delete: { summary: 'Delete an unused temporary post image', responses: { '204': { description: 'Image deleted' } } } },
    '/posts/{id}/restore': { post: { summary: 'Restore a trashed post', responses: { '200': { description: 'Post restored' } } } },
    '/posts/{id}/permanent': { delete: { summary: 'Permanently delete a trashed post', responses: { '204': { description: 'Post deleted' } } } },
    '/posts/{id}/like': {
      post: { summary: 'Like a published post', responses: { '201': { description: 'Liked' } } },
      delete: { summary: 'Remove my post like', responses: { '204': { description: 'Like removed' } } },
    },
    '/posts/{id}/bookmark': {
      post: { summary: 'Bookmark a published post', responses: { '201': { description: 'Bookmarked' } } },
      delete: { summary: 'Remove my post bookmark', responses: { '204': { description: 'Bookmark removed' } } },
    },
    '/posts/{id}/comments': {
      get: { summary: 'List comments and one-level replies', responses: { '200': { description: 'Comment list' } } },
      post: { summary: 'Create a comment or one-level reply', responses: { '201': { description: 'Comment created' } } },
    },
    '/comments/{id}': {
      patch: { summary: 'Edit my comment', responses: { '200': { description: 'Comment updated' } } },
      delete: { summary: 'Delete or tombstone my comment', responses: { '204': { description: 'Comment deleted' } } },
    },
    '/notifications': { get: { summary: 'List my notifications', responses: { '200': { description: 'Paginated notification list and unread count' }, '401': { description: 'Unauthenticated' } } } },
    '/notifications/read-all': { patch: { summary: 'Mark all my notifications as read', responses: { '200': { description: 'All notifications marked as read' } } } },
    '/notifications/{id}/read': { patch: { summary: 'Mark one of my notifications as read', responses: { '200': { description: 'Notification marked as read' }, '404': { description: 'Notification not found' } } } },
    '/home': { get: { summary: 'Get banners and ranked home modules', description: 'Includes marketItems: up to five public SELLING items ordered by likeCount DESC, createdAt DESC, id DESC. Creator entries include subscriberCount, current-user isSubscribed, and enriched popular posts.', responses: { '200': { description: 'Home payload with marketItems' } } } },
    '/home/banners': { get: { summary: 'List active scheduled home banners', responses: { '200': { description: 'Active banners' } } } },
    '/admin/home-banners': {
      get: { summary: 'List every home banner as an operator', responses: { '200': { description: 'Banner list' }, '403': { description: 'Admin required' } } },
      post: { summary: 'Create a scheduled home banner', responses: { '201': { description: 'Banner created' }, '403': { description: 'Admin required' } } },
    },
    '/admin/home-banners/{id}': {
      patch: { summary: 'Update a scheduled home banner', responses: { '200': { description: 'Banner updated' } } },
      delete: { summary: 'Delete a home banner', responses: { '204': { description: 'Banner deleted' } } },
    },
    '/admin/auth/login': { post: { summary: 'Sign in to the isolated administrator console with login ID', responses: { '200': { description: 'Administrator session created' }, '401': { description: 'Invalid administrator credentials' } } } },
    '/admin/me': { get: { summary: 'Read the active administrator session', responses: { '200': { description: 'Administrator identity' }, '403': { description: 'Administrator role required' } } } },
    '/admin/dashboard': { get: { summary: 'Read 30 KST days of selected administrator metric series', responses: { '200': { description: 'Zero-filled metric series' } } } },
    '/admin/dashboard/details': { get: { summary: 'Search the detail rows for one administrator metric', responses: { '200': { description: 'Paginated detail rows' } } } },
    '/admin/posts': { get: { summary: 'Search every post as an administrator', responses: { '200': { description: 'Paginated posts' } } } },
    '/admin/posts/{id}': {
      patch: { summary: 'Update any post as an administrator', responses: { '200': { description: 'Post updated' } } },
      delete: { summary: 'Move any post to the administrator trash', responses: { '204': { description: 'Post moved to trash' } } },
    },
    '/admin/posts/{id}/restore': { post: { summary: 'Restore a post from the administrator trash', responses: { '200': { description: 'Post restored' } } } },
    '/admin/posts/{id}/images': { post: { summary: 'Upload and attach a WebP image while editing any post as an administrator', responses: { '201': { description: 'Attached post image' } } } },
    '/admin/posts/{id}/permanent-delete': { post: { summary: 'Permanently delete a post from the administrator trash', responses: { '204': { description: 'Post permanently deleted' } } } },
    '/admin/notices': { get: { summary: 'List official notice posts', responses: { '200': { description: 'Notice posts' } } }, post: { summary: 'Create an official notice post', responses: { '201': { description: 'Notice created' } } } },
    '/admin/notices/{id}': {
      patch: { summary: 'Update an official notice', responses: { '200': { description: 'Notice updated' } } },
      delete: { summary: 'Move an official notice to the administrator trash', responses: { '204': { description: 'Notice moved to trash' } } },
    },
    '/admin/market-items': { get: { summary: 'Search every market listing as an administrator', responses: { '200': { description: 'Paginated market listings' } } } },
    '/admin/market-items/{id}': {
      patch: { summary: 'Update any market listing as an administrator', responses: { '200': { description: 'Market listing updated' } } },
      delete: { summary: 'Move any market listing to the administrator trash', responses: { '204': { description: 'Market listing moved to trash' } } },
    },
    '/admin/market-items/{id}/restore': { post: { summary: 'Restore a market listing from the administrator trash', responses: { '200': { description: 'Market listing restored' } } } },
    '/admin/market-items/{id}/permanent-delete': { post: { summary: 'Permanently delete a market listing from the administrator trash', responses: { '204': { description: 'Market listing permanently deleted' } } } },
    '/admin/users': { get: { summary: 'Search non-administrator accounts and wallet balances', responses: { '200': { description: 'Paginated users' } } } },
    '/admin/users/{id}': { patch: { summary: 'Update user email, nickname or active/blocked state', responses: { '200': { description: 'User updated' } } } },
    '/admin/users/{id}/password-reset': { post: { summary: 'Issue a one-time visible temporary password', responses: { '200': { description: 'Temporary password' } } } },
    '/admin/users/{id}/wallet': { put: { summary: 'Set a target wallet balance with an audited reason', responses: { '200': { description: 'Balance and adjustment' } } } },
    '/admin/users/{id}/withdraw': { post: { summary: 'Reauthenticate the administrator and irreversibly anonymize a user', responses: { '204': { description: 'User anonymized' } } } },
    '/admin/audit-logs': { get: { summary: 'Read the append-only administrator audit API', responses: { '200': { description: 'Paginated audit entries' } } } },
    '/market/items': {
      get: { summary: 'List and search market items', description: 'Each item includes likeCount and current-user isLiked.', parameters: [{ name: 'sort', in: 'query', schema: { type: 'string', enum: ['latest', 'popular', 'price_asc', 'price_desc'], default: 'latest' }, description: 'popular orders by likeCount DESC, createdAt DESC, id DESC.' }], responses: { '200': { description: 'Market item list' } } },
      post: { summary: 'Create a market item', responses: { '201': { description: 'Market item created' } } },
    },
    '/market/items/{id}': {
      get: { summary: 'Read a market item', responses: { '200': { description: 'Market item' } } },
      patch: { summary: 'Update an owned market item', responses: { '200': { description: 'Market item updated' } } },
      delete: { summary: 'Move an owned market item to trash', responses: { '204': { description: 'Market item moved to trash' } } },
    },
    '/market/items/{id}/images': { put: { summary: 'Replace 1-5 owned market item WebP images', responses: { '200': { description: 'Images replaced' }, '400': { description: 'Invalid image count, type, or size' } } } },
    '/market/items/{id}/like': {
      post: { summary: 'Like a public SELLING market item', responses: { '201': { description: 'Like active' }, '401': { description: 'Login required' }, '404': { description: 'Selling item not found' } } },
      delete: { summary: 'Remove my market item like idempotently', responses: { '204': { description: 'Like inactive' }, '401': { description: 'Login required' } } },
    },
    '/market/items/{id}/conversations': { post: { summary: 'Start or reuse a buyer conversation', responses: { '201': { description: 'Conversation' } } } },
    '/market/items/{id}/purchase': { post: { summary: 'Purchase a selling item with wallet points', responses: { '201': { description: 'Order created and buyer balance returned' }, '409': { description: 'Item unavailable or insufficient points' } } } },
    '/market/wallet': { get: { summary: 'Read my wallet balance and recent transactions', responses: { '200': { description: 'Wallet and up to 50 recent transactions' }, '401': { description: 'Unauthenticated' } } } },
    '/market/wallet/charge': { post: { summary: 'Charge my wallet with a supported point amount', responses: { '201': { description: 'Wallet charged' }, '400': { description: 'Unsupported charge amount' } } } },
    '/market/orders': { get: { summary: 'List my buyer or seller orders', parameters: [{ name: 'role', in: 'query', schema: { type: 'string', enum: ['buyer', 'seller'], default: 'buyer' } }], responses: { '200': { description: 'Order list' } } } },
    '/market/orders/{id}/complete': { post: { summary: 'Complete a paid order as its buyer', responses: { '200': { description: 'Order completed' }, '403': { description: 'Buyer permission required' }, '409': { description: 'Order cannot be completed' } } } },
    '/market/conversations': { get: { summary: 'List my market conversations through the participant-scoped chat RPC', responses: { '200': { description: 'Conversation list' } } } },
    '/market/conversations/{id}/messages': {
      get: { summary: 'List conversation messages', responses: { '200': { description: 'Message list' } } },
      post: { summary: 'Send a conversation message', responses: { '201': { description: 'Message sent' } } },
    },
    '/market/conversations/{id}/read': { post: { summary: 'Mark received conversation messages as read', responses: { '204': { description: 'Messages marked as read' } } } },
    '/market/conversations/{id}': { delete: { summary: 'Leave and hide a market conversation for the current participant', responses: { '204': { description: 'Conversation left' } } } },
    '/market/conversations/{id}/messages/{messageId}': { delete: { summary: 'Soft-delete my market chat message', responses: { '204': { description: 'Message deleted' } } } },
    '/market/conversations/{id}/messages/{messageId}/reactions': {
      put: { summary: 'Add one of six reactions to a market chat message', responses: { '201': { description: 'Reaction active' } } },
      delete: { summary: 'Remove my reaction from a market chat message', responses: { '204': { description: 'Reaction inactive' } } },
    },
    '/market/items/{id}/restore': { post: { summary: 'Restore a trashed market item', responses: { '200': { description: 'Item restored' } } } },
    '/market/items/{id}/permanent': { delete: { summary: 'Permanently delete or tombstone a trashed item', responses: { '204': { description: 'Item purged' } } } },
    '/health': { get: { summary: 'Check API health', responses: { '200': { description: 'API is healthy' } } } },
  },
}
