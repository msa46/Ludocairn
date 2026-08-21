import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/global.css'
import { App } from './app/App'

const root = document.querySelector<HTMLDivElement>('#root')

if (!root) {
  throw new Error('Ludocairn root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
