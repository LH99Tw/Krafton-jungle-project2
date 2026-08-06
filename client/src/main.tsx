import React from 'react'
import ReactDOM from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import '@fontsource-variable/noto-sans-kr'
import '@fontsource/dm-serif-display/400.css'
import '@fontsource/jua/400.css'
import App from './App'
import { publicQueryPersister, queryClient, shouldPersistPublicQuery, startContentInvalidation } from './query-client'
import './styles.css'

startContentInvalidation()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: publicQueryPersister,
        maxAge: 5 * 60_000,
        buster: import.meta.env.VITE_APP_VERSION ?? '2026-08-refresh-cache-v1',
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === 'success' && shouldPersistPublicQuery(query.queryKey),
        },
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
)
