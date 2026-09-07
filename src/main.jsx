import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { registerSW } from 'virtual:pwa-register'
import { router } from './router'
import { initSettings } from './db'
import './index.css'

// Força atualização imediata de novos deploys no celular/PWA
registerSW({ immediate: true })

// Initialize settings
initSettings()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
