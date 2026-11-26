import { useEffect, useMemo, useState } from 'react'
import type { Lang } from '../core/format'
import { mergeAccount } from '../core/brokers'
import { emptyProfile, type Profile } from '../core/model'
import { overview } from '../core/portfolio'
import { DEFAULT_RADAR, radarItems } from '../core/radar'
import { annaProfile } from '../data/demo'
import { AskPage, DashboardPage, DataPage, GoalsPage, PortfolioPage, RadarPage, ResearchPage, TransactionsPage, type Chat } from './pages'
import { BOOK, START_PRICE, type Mode } from './parts'
import { app, type Page } from './strings-app'

const PAGES: Page[] = ['dashboard', 'ask', 'research', 'radar', 'portfolio', 'transactions', 'goals', 'data']
const ICONS: Record<Page, string> = {
  dashboard: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
  ask: 'M4 5h16v11H8l-4 4z',
  research: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  radar: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12l6-6',
  portfolio: 'M3 7h18v13H3zM8 7V4h8v3',
  transactions: 'M4 7h13l-3-3M20 17H7l3 3',
  goals: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 12h.01',
  data: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
}

function readPrefs(): typeof DEFAULT_RADAR {
  try {
    return { ...DEFAULT_RADAR, ...JSON.parse(localStorage.getItem('vcfo-radar') ?? '{}') }
  } catch {
    return DEFAULT_RADAR
  }
}

const pageFromHash = (): Page => {
  const h = location.hash.replace('#', '') as Page
  return PAGES.includes(h) ? h : 'dashboard'
}

export function App() {
  const [lang, setLang] = useState<Lang>('sk')
  const a = app(lang)
  const [page, setPageState] = useState<Page>(pageFromHash)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('demo')
  const [own, setOwn] = useState<Profile>(() => emptyProfile())
  const [price, setPrice] = useState(START_PRICE)
  const [prefs, setPrefsState] = useState(readPrefs)
  const [chats, setChats] = useState<Chat[]>([])
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [pendingMode, setPendingMode] = useState<'chat' | 'radar'>('chat')
  const [demo, setDemo] = useState<Profile>(() => annaProfile())
  const [topics, setTopics] = useState<string[]>([])
  const [vaultSaved, setVaultSaved] = useState(false)
  const profile = mode === 'demo' ? demo : own
  const setProfile = (fn: (p: Profile) => Profile) => (mode === 'demo' ? setDemo(fn) : setOwn(fn))
  const o = useMemo(() => overview(profile, price, BOOK), [profile, price])
  const radar = useMemo(() => radarItems(profile, price, BOOK, { ...prefs, today: new Date().toISOString().slice(0, 10) }), [profile, price, prefs])
  const watchCount = radar.filter((r) => r.level === 'watch').length

  useEffect(() => {
    const on = () => setPageState(pageFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const go = (p: Page) => {
    location.hash = p
    setPageState(p)
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }
  const setPrefs = (p: typeof DEFAULT_RADAR) => {
    setPrefsState(p)
    try {
      localStorage.setItem('vcfo-radar', JSON.stringify(p))
    } catch {
      /* storage blocked */
    }
  }
  const switchMode = (m: Mode) => {
    setMode(m)
    setChats([])
  }

  const ctx = { lang, profile, price, o, radar, go, mode, setProfile }
  const askWith = (q: string, m: 'chat' | 'radar' = 'chat') => { setPendingQuestion(q); setPendingMode(m); go('ask') }

  return (
    <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="side">
        <div className="side-top">
          <div className="brand">
            <span className="logo">Virtuse</span> <span className="muted">CFO</span>
          </div>
          <button className="icon close-menu" onClick={() => setMenuOpen(false)} aria-label={a.close}>×</button>
        </div>
        <nav>
          {PAGES.map((p) => (
            <a key={p} href={`#${p}`} className={p === page ? 'on' : ''} onClick={(e) => { e.preventDefault(); go(p) }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[p]} /></svg>
              <span>{a.nav[p]}</span>
              {p === 'radar' && watchCount > 0 && <b className="badge">{watchCount}</b>}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <div className="seg full" role="group">
            <button className={mode === 'demo' ? 'on' : ''} onClick={() => switchMode('demo')}>{a.demoChip}</button>
            <button className={mode === 'own' ? 'on' : ''} onClick={() => switchMode('own')}>{a.ownChip}</button>
          </div>
          <div className="row between">
            <span className="tag">{a.proto}</span>
            <div className="seg" role="group" aria-label="Language">
              {(['sk', 'en'] as Lang[]).map((l) => (
                <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
      </aside>
      <div className="scrim" onClick={() => setMenuOpen(false)} />
      <main className="main">
        <header className="mobile-top">
          <button className="icon" onClick={() => setMenuOpen(true)} aria-label={a.menu}>☰</button>
          <span className="brand"><span className="logo">Virtuse</span> <span className="muted">CFO</span></span>
          <span className="tag">{mode === 'demo' ? a.demoChip : a.ownChip}</span>
        </header>
        {page === 'dashboard' && <DashboardPage {...ctx} onAsk={askWith} setup={{ chats: chats.length > 0, vault: vaultSaved }} />}
        {page === 'ask' && <AskPage {...ctx} chats={chats} setChats={setChats} pending={pendingQuestion} pendingMode={pendingMode} clearPending={() => setPendingQuestion('')} />}
        {page === 'research' && <ResearchPage {...ctx} topics={topics} setTopics={setTopics} />}
        {page === 'radar' && <RadarPage {...ctx} prefs={prefs} setPrefs={setPrefs} onCreate={(q) => askWith(q, 'radar')} />}
        {page === 'portfolio' && <PortfolioPage {...ctx} />}
        {page === 'transactions' && <TransactionsPage {...ctx} />}
        {page === 'goals' && <GoalsPage {...ctx} />}
        {page === 'data' && (
          <DataPage
            {...ctx}
            setPrice={setPrice}
            own={own}
            setOwn={setOwn}
            onVaultSaved={() => setVaultSaved(true)}
            onBroker={(acc) => setOwn((p) => ({ ...p, brokers: [...p.brokers.filter((b) => b.source !== acc.source), mergeAccount(p.brokers.find((b) => b.source === acc.source), acc)] }))}
          />
        )}
      </main>
    </div>
  )
}
