import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { initI18n } from './lib/i18n'
import App from './App.tsx'

// Load the page language's dictionary (no-op for EN/SK/CS) before rendering.
initI18n().then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
))
