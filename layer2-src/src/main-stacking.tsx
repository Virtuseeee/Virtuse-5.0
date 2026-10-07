import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initI18n } from './lib/i18n'
import Stacking from './pages/Stacking.tsx'

// Stacking is deployed as its own standalone static page (stacking.html),
// with no internal routes of its own, so — unlike main.tsx's Concierge
// entry — this skips react-router's BrowserRouter entirely.
// Load the page language's dictionary (no-op for EN/SK/CS) before rendering.
initI18n().then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Stacking />
  </StrictMode>,
))
