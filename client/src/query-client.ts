import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { createClient, RealtimeChannel } from '@supabase/supabase-js'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: (attempt) => Math.min(250 * 2 ** attempt, 2_000),
      refetchOnWindowFocus: true,
    },
  },
})

export const PUBLIC_QUERY_CACHE_KEY = 'tistory.public-query-cache.v1'
export const publicQueryPersister = createSyncStoragePersister({
  storage: window.sessionStorage,
  key: PUBLIC_QUERY_CACHE_KEY,
})

export const shouldPersistPublicQuery = (queryKey: readonly unknown[]) => {
  const [surface, ...parts] = queryKey
  if (surface === 'home') return true
  if (surface === 'posts') return parts[0] === 'public'
  if (surface === 'blog') return typeof parts[0] === 'string'
  if (surface === 'post') return typeof parts[0] === 'string'
  return false
}

export const clearUserQueryState = () => {
  queryClient.removeQueries({
    predicate: (query) => !shouldPersistPublicQuery(query.queryKey),
  })
}

const surfaceKeys: Record<string, string[]> = {
  home: ['home'],
  posts: ['home', 'posts', 'blog'],
  market: ['home', 'market', 'blog'],
  blogs: ['home', 'blogs', 'blog'],
}

let channel: RealtimeChannel | null = null
let invalidateTimer: number | null = null
const pendingKeys = new Set<string>()

const queueSurfaceInvalidation = (surface: string) => {
  for (const key of surfaceKeys[surface] ?? ['home']) pendingKeys.add(key)
  if (invalidateTimer !== null) window.clearTimeout(invalidateTimer)
  invalidateTimer = window.setTimeout(() => {
    const keys = new Set(pendingKeys)
    pendingKeys.clear()
    invalidateTimer = null
    void queryClient.invalidateQueries({
      predicate: (query) => keys.has(String(query.queryKey[0])),
    })
  }, 250)
}

export const startContentInvalidation = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey || channel) return () => {}

  const realtime = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  channel = realtime.channel('content-cache', { config: { private: false } })
    .on('broadcast', { event: 'invalidate' }, ({ payload }) => {
      queueSurfaceInvalidation(String(payload?.surface ?? ''))
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'content_versions',
    }, ({ new: payload }) => {
      const surface = String((payload as Record<string, unknown>).surface ?? '')
      queueSurfaceInvalidation(surface)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') return
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        void queryClient.invalidateQueries()
      }
    })

  return () => {
    if (invalidateTimer !== null) window.clearTimeout(invalidateTimer)
    if (channel) void realtime.removeChannel(channel)
    channel = null
  }
}

export const subscribeMarketChatChanges = (onChange: (conversationId?: number) => void) => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) return () => {}

  const realtime = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  let debounceTimer: number | null = null
  let pendingConversationId: number | undefined
  const notify = (conversationId?: number) => {
    pendingConversationId = conversationId ?? pendingConversationId
    if (debounceTimer !== null) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      const nextId = pendingConversationId
      pendingConversationId = undefined
      debounceTimer = null
      onChange(nextId)
    }, 120)
  }

  const nextChannel = realtime.channel('market-chat', { config: { private: false } })
    .on('broadcast', { event: 'changed' }, ({ payload }) => {
      const id = Number(payload?.conversationId)
      notify(Number.isSafeInteger(id) && id > 0 ? id : undefined)
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'market_chat_versions',
    }, () => notify())
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') notify()
    })

  return () => {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer)
    void realtime.removeChannel(nextChannel)
  }
}
