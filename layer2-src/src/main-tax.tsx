import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initI18n } from './lib/i18n'
import Tax from './pages/Tax.tsx'

// Tax is deployed as its own standalone static page (tax.html), with
// no internal routes of its own — same pattern as main-stacking.tsx.
// Load the page language's dictionary (no-op for EN/SK/CS) before rendering.
initI18n().then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Tax />
  </StrictMode>,
))
