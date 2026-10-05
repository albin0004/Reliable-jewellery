import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function mount() {
  const rootElement = document.getElementById('root')
  if (!rootElement) return false
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  return true
}

if (!mount()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount)
  } else {
    window.addEventListener('load', mount)
  }
}
