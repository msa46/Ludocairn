import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import './styles/global.css'
import { App } from './app/App'
import type { RegisterWorker } from './pwa/register'

const root = document.querySelector<HTMLDivElement>('#root')

if (!root) {
  throw new Error('Ludocairn root element was not found')
}

const registerWorker: RegisterWorker = (callbacks) =>
  registerSW({
    onNeedRefresh: callbacks.onNeedRefresh,
    onOfflineReady: callbacks.onOfflineReady,
    onRegisteredSW: (_scriptUrl, registration) =>
      callbacks.onRegistered(registration),
    onRegisterError: callbacks.onRegisterError,
  })

createRoot(root).render(
  <StrictMode>
    <App registerWorker={registerWorker} />
  </StrictMode>,
)
