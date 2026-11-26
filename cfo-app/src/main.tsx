import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { PriceBook } from './core/prices'
import { App } from './ui/App'
import { BOOK, setBook } from './ui/parts'
import './ui/styles.css'

// The same price file for every visitor (nothing about the user is sent).
// Use it when it is newer than the copy built into the app; never wait long.
async function loadPrices(): Promise<void> {
  try {
    const r = await fetch('./prices.json', { cache: 'no-cache', signal: AbortSignal.timeout(2500) })
    if (!r.ok) return
    const b = (await r.json()) as PriceBook
    if (b?.fx?.perEur?.USD && Array.isArray(b.prices?.instruments) && b.builtAt > BOOK.builtAt) setBook(b)
  } catch {
    /* offline or blocked: keep the bundled prices */
  }
}

loadPrices().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
