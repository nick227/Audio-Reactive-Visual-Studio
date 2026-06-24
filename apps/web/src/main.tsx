import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { createApiClient } from '@avl/sdk'
import { App } from './App'
import { queryClient } from './lib/queryClient'
import './styles/global.css'

createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001' })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="bottom-right" richColors />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
