import { useEffect, useMemo, useRef, useState } from 'react'
import { ask, SUGGESTED, type Answer } from '../core/ask'
import type { BrokerAccount } from '../core/brokers'
import * as F from '../core/format'
import type { Lang } from '../core/format'
import { dayMoveEur, portfolioRows, type PortfolioRow } from '../core/holdings'
import type { Profile } from '../core/model'
import type { Overview } from '../core/portfolio'
import { findInstrument } from '../core/prices'
import { DEFAULT_RADAR, type RadarItem } from '../core/radar'
import { checkRules, parseRule, type Rule } from '../core/rules'
import { goalProgress, type Goal } from '../core/goals'
import { buildSummary } from '../core/upload'
import { BOOK, BrokersCard, CLASS_COLOR, Fact, ImportBox, ManualBox, PriceBox, VaultBox, type Mode } from './parts'
import { strings } from './strings'
import { app, radarText, type Page } from './strings-app'

interface Ctx {
  lang: Lang
  profile: Profile
  price: number
  o: Overview
  radar: RadarItem[]
  go: (p: Page) => void
  mode: Mode
  setProfile: (fn: (p: Profile) => Profile) => void
}

function Head({ title, lead, right }: { title: string; lead?: string; right?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {right}
    </header>
  )
}

function Empty({ lang, go }: { lang: Lang; go: (p: Page) => void }) {
  const a = app(lang)
  return (
    <div className="card empty-state">
      <h2>{a.emptyTitle}</h2>
      <p className="muted">{a.emptyLead}</p>
      <button onClick={() => go('data')}>{a.emptyCta}</button>
    </div>
  )
}

const signed = (n: number, lang: Lang, d = 2) => `${n > 0 ? '+' : ''}${F.pct(n, lang, d)}`
const dayClass = (n?: number) => (n === undefined ? '' : n > 0 ? 'up' : n < 0 ? 'down' : '')

/* ------------------------------------------------------------- Dashboard */

export function DashboardPage({ lang, profile, price, o, radar, go, mode, onAsk, setup }: Ctx & { onAsk: (q: string) => void; setup: { chats: boolean; vault: boolean } }) {
  const a = app(lang)
  const t = strings(lang)
  const [q, setQ] = useState('')
  const rows = useMemo(() => portfolioRows(profile, price, BOOK, o.assetsEur), [profile, price, o.assetsEur])
  const movers = rows.filter((r) => r.changePct !== undefined).sort((x, y) => Math.abs(dayMoveEur(y)) - Math.abs(dayMoveEur(x))).slice(0, 5)
  const cash = o.allocation.find((s) => s.assetClass === 'cash')?.valueEur ?? 0
  const invest = o.bitcoin.valueEur + o.brokers.investedValueEur
  const hasData = o.assetsEur > 0

  return (
    <>
      <Head title={a.hello(mode === 'demo' ? 'Anna' : '')} lead={mode === 'demo' ? t.demoBanner : undefined} />
      {mode === 'own' && <SetupCard lang={lang} go={go} done={[profile.txs.length > 0 || profile.brokers.length > 0, profile.manualAssets.length > 0 || profile.liabilities.length > 0, setup.chats, (profile.rules ?? []).length > 0, (profile.goals ?? []).length > 0, setup.vault]} />}
      {!hasData ? (
        <Empty lang={lang} go={go} />
      ) : (
        <>
          <section className="kpis">
            <Tile label={t.netWorth} value={F.eur(o.netWorthEur, lang)} onClick={() => go('portfolio')} />
            <Tile label={a.investments} value={F.eur(invest, lang)} sub={a.investmentsSub} onClick={() => go('portfolio')} />
            <Tile label={a.cash} value={F.eur(cash, lang)} />
            <Tile label={a.liabilities} value={F.eur(o.liabilitiesEur, lang)} onClick={() => go('data')} />
          </section>
          <section className="dash-grid">
            <div className="card">
              <h2>{a.assets}</h2>
              <div className="bar" aria-hidden="true">
                {o.allocation.map((s) => <span key={s.assetClass} style={{ width: `${s.pct}%`, background: CLASS_COLOR[s.assetClass] }} />)}
              </div>
              <div className="lrow strong"><span>{a.allAssets}</span><b>{F.eur(o.assetsEur, lang)}</b></div>
              <ul className="legend">
                {o.allocation.map((s) => (
                  <li key={s.assetClass}>
                    <i style={{ background: CLASS_COLOR[s.assetClass] }} />
                    <span>{t.classes[s.assetClass]}</span>
                    <b>{F.pct(s.pct, lang)}</b>
                    <em>{F.eur(s.valueEur, lang)}</em>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h2>{a.movers}</h2>
              {movers.length === 0 ? <p className="muted small">{a.moversEmpty}</p> : (
                <ul className="items">
                  {movers.map((r) => (
                    <li key={r.key} className="mover">
                      <span>{r.symbol}<small className="basis">{r.where}</small></span>
                      <em className={dayClass(r.changePct)}>{signed(r.changePct!, lang)}</em>
                      <b className={dayClass(r.changePct)}>{F.eur(dayMoveEur(r), lang)}</b>
                    </li>
                  ))}
                </ul>
              )}
              <p className="muted small">{a.pricesAsOf(F.date(BOOK.prices.instruments[0]?.date ?? BOOK.fx.date, lang))}</p>
            </div>

            <div className="card ask-widget">
              <h2>{a.askTitle}</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) onAsk(q.trim()) }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={a.askPlaceholder} aria-label={a.askTitle} />
                <button type="submit">{a.askSend}</button>
              </form>
              <div className="chips">
                {SUGGESTED[lang].slice(0, 4).map((s) => <button key={s} className="chip" onClick={() => onAsk(s)}>{s}</button>)}
              </div>
            </div>

            <div className="card">
              <h2>{a.liabilities}</h2>
              <div className="lrow strong"><span>{a.allLiabilities}</span><b>{F.eur(o.liabilitiesEur, lang)}</b></div>
              <ul className="items">
                {profile.liabilities.map((l) => (
                  <li key={l.id} className="two"><span>{l.name}</span><b className="down">−{F.eur(l.balanceEur, lang)}</b></li>
                ))}
              </ul>
            </div>

            <div className="card span2">
              <div className="card-head"><h2>{a.radarTitle}</h2><button className="link" onClick={() => go('radar')}>{a.radarAll}</button></div>
              {radar.length === 0 ? <p className="muted small">{a.radarEmpty}</p> : (
                <ul className="radar-list">
                  {radar.slice(0, 4).map((r) => <RadarRow key={r.id} item={r} lang={lang} />)}
                </ul>
              )}
            </div>

            <div className="card span2">
              <h2>{t.btcTitle}</h2>
              <dl className="facts">
                <Fact k={t.held} v={F.btc(o.bitcoin.btc, lang)} />
                <Fact k={t.value} v={F.eur(o.bitcoin.valueEur, lang)} />
                <Fact k={t.invested} v={F.eur(o.bitcoin.netInvestedEur, lang)} />
                <Fact k={t.avg} v={o.bitcoin.avgBuyPrice ? F.eur(o.bitcoin.avgBuyPrice, lang) : '–'} />
                <Fact k={t.fees} v={`${F.eur(o.bitcoin.feesEur, lang, 2)} · ${F.pct(o.bitcoin.feePct, lang, 2)} ${t.feePct}`} />
              </dl>
            </div>
          </section>
        </>
      )}
      <footer className="foot">{t.foot}</footer>
    </>
  )
}

function Tile({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="k">{label}</span>
      <span className="v">{value}</span>
      {sub && <span className="s">{sub}</span>}
    </>
  )
  return onClick ? <button className="kpi clickable" onClick={onClick}>{inner}</button> : <div className="kpi">{inner}</div>
}

function RadarRow({ item, lang }: { item: RadarItem; lang: Lang }) {
  const a = app(lang)
  const { title, why } = radarText(item, lang)
  return (
    <li className={`radar-item ${item.level}`}>
      <span className="kind">{a.kinds[item.kind]}</span>
      <div>
        <p className="title">{title}</p>
        <p className="muted small">{why}</p>
      </div>
      <span className={`lvl ${item.level}`}>{item.level === 'watch' ? a.watch : a.info}</span>
    </li>
  )
}

function SetupCard({ lang, go, done }: { lang: Lang; go: (p: Page) => void; done: boolean[] }) {
  const a = app(lang)
  const pct = Math.round((done.filter(Boolean).length / done.length) * 100)
  if (pct === 100) return null
  const target: Page[] = ['data', 'data', 'ask', 'radar', 'goals', 'data']
  return (
    <section className="card setup">
      <div className="setup-head">
        <div>
          <h2>{a.setupTitle(pct)}</h2>
          <p className="muted small">{a.setupLead}</p>
        </div>
        <div className="ring" style={{ ['--p' as string]: pct }}><span>{pct} %</span></div>
      </div>
      <ul>
        {a.setupSteps.map((step, i) => (
          <li key={step} className={done[i] ? 'done' : ''}>
            <span className="tick">{done[i] ? '✓' : '+'}</span>
            {done[i] ? <span>{step}</span> : <button className="link plain" onClick={() => go(target[i])}>{step}</button>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------- Composer (shared) */

type ComposerMode = 'chat' | 'radar'

function Composer({ lang, onSend, mode, setMode, modes = ['chat', 'radar'], placeholder }: { lang: Lang; onSend: (q: string, m: ComposerMode) => void; mode: ComposerMode; setMode: (m: ComposerMode) => void; modes?: ComposerMode[]; placeholder?: string }) {
  const a = app(lang)
  const [q, setQ] = useState('')
  return (
    <form className="composer2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { onSend(q.trim(), mode); setQ('') } }}>
      <textarea
        value={q}
        rows={2}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (q.trim()) { onSend(q.trim(), mode); setQ('') } } }}
        placeholder={placeholder ?? (mode === 'radar' ? a.radarPh : a.askPlaceholder)}
        aria-label={a.askTitle}
      />
      <div className="composer-bar">
        {modes.length > 1 ? (
          <div className="seg small-seg" role="group">
            {modes.map((m) => <button type="button" key={m} className={m === mode ? 'on' : ''} onClick={() => setMode(m)}>{m === 'chat' ? a.modeChat : a.modeRadar}</button>)}
          </div>
        ) : <span />}
        <button type="submit" className="send" aria-label={a.askSend}>↑</button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------- Ask */

export interface ChatMsg {
  role: 'user' | 'cfo'
  text: string
  answer?: Answer
}
export interface Chat {
  id: string
  title: string
  msgs: ChatMsg[]
}

export function AskPage({ lang, profile, price, o, setProfile, chats, setChats, pending, pendingMode, clearPending }: Ctx & { chats: Chat[]; setChats: (fn: (c: Chat[]) => Chat[]) => void; pending: string; pendingMode: ComposerMode; clearPending: () => void }) {
  const a = app(lang)
  const [activeId, setActiveId] = useState<string | null>(chats[0]?.id ?? null)
  const [mode, setMode] = useState<ComposerMode>(pendingMode)
  const [filter, setFilter] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const active = chats.find((c) => c.id === activeId) ?? null
  const symbols = useMemo(() => portfolioRows(profile, price, BOOK, o.assetsEur).map((r) => r.symbol), [profile, price, o.assetsEur])

  function reply(question: string, m: ComposerMode): Answer {
    if (m === 'radar') {
      const rule = parseRule(question, symbols)
      if (!rule) return { kind: 'unknown', lines: [a.ruleNotUnderstood], sources: [] }
      setProfile((p) => ({ ...p, rules: [...(p.rules ?? []), rule] }))
      return { kind: 'answer', lines: [a.ruleAdded(rule.text)], sources: [] }
    }
    return ask(question, profile, price, BOOK, lang)
  }

  function send(text: string, m: ComposerMode) {
    const question = text.trim()
    if (!question) return
    const msgs: ChatMsg[] = [{ role: 'user', text: question }, { role: 'cfo', text: '', answer: reply(question, m) }]
    if (active) {
      setChats((cs) => cs.map((c) => (c.id === active.id ? { ...c, msgs: [...c.msgs, ...msgs] } : c)))
    } else {
      const id = `c${Date.now()}`
      setChats((cs) => [{ id, title: question.slice(0, 48), msgs }, ...cs])
      setActiveId(id)
    }
  }

  const handled = useRef('')
  useEffect(() => {
    if (!pending) {
      handled.current = ''
      return
    }
    if (handled.current === pending) return
    handled.current = pending
    setMode(pendingMode)
    send(pending, pendingMode)
    clearPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [active?.msgs.length])

  const shown = chats.filter((c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()))

  return (
    <section className="ask-layout2">
      <div className="chat2">
        <div className="chat-top">
          <h1>{a.askTitle}</h1>
          <button className="ghost" onClick={() => setActiveId(null)}>+ {a.newChat}</button>
        </div>
        <div className="msgs">
          {!active && (
            <div className="chat-empty">
              <p>{a.askLead}</p>
              <p className="muted">{a.askNote}</p>
              <div className="chips">{SUGGESTED[lang].map((s) => <button key={s} className="chip" onClick={() => send(s, 'chat')}>{s}</button>)}</div>
            </div>
          )}
          {active?.msgs.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="msg user">{m.text}</div>
            ) : (
              <div key={i} className={`msg cfo ${m.answer?.kind}`}>
                {m.answer?.kind === 'advice' && <span className="tag warn">{a.adviceTag}</span>}
                {m.answer?.lines.map((l, j) => <p key={j}>{l}</p>)}
                {!!m.answer?.sources.length && (
                  <div className="sources">
                    <span>{a.sources}:</span>
                    {m.answer.sources.map((s) => <em key={s}>{s}</em>)}
                  </div>
                )}
              </div>
            ),
          )}
          <div ref={end} />
        </div>
        <Composer lang={lang} onSend={send} mode={mode} setMode={setMode} />
        <p className="disclaimer">{a.disclaimer}</p>
      </div>
      <aside className="history">
        <h2>{a.history}</h2>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={a.search} aria-label={a.search} />
        {shown.length === 0 ? <p className="muted small">{a.noHistory}</p> : (
          <ul>
            {shown.map((c) => (
              <li key={c.id} className={c.id === activeId ? 'on' : ''}>
                <button className="chat-title" onClick={() => setActiveId(c.id)}>{c.title || a.untitled}</button>
                <button className="link" onClick={() => { setChats((cs) => cs.filter((x) => x.id !== c.id)); if (activeId === c.id) setActiveId(null) }} aria-label={a.deleteChat}>×</button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">{a.chatsNotSaved}</p>
      </aside>
    </section>
  )
}

/* ------------------------------------------------------------- Research */

export function ResearchPage({ lang, profile, price, o, topics, setTopics }: Ctx & { topics: string[]; setTopics: (fn: (t: string[]) => string[]) => void }) {
  const a = app(lang)
  const rows = useMemo(() => portfolioRows(profile, price, BOOK, o.assetsEur), [profile, price, o.assetsEur])
  const priced = rows
    .map((r) => ({ r, ins: r.symbol === 'BTC' ? BOOK.prices.instruments.find((i) => i.id === 'BTC') ?? null : findInstrument({ symbol: r.symbol }, BOOK) }))
    .filter((x) => x.ins)
  const [sel, setSel] = useState(0)
  const [tab, setTab] = useState<'ideas' | 'reports'>('ideas')
  const [mode, setMode] = useState<ComposerMode>('chat')
  const cur = priced[Math.min(sel, priced.length - 1)]
  const add = (q: string) => { setTopics((t) => [q, ...t]); setTab('reports') }

  return (
    <>
      <section className="research-hero">
        <h1>{a.researchHero}</h1>
        <p className="muted">{a.researchSub}</p>
        <Composer lang={lang} onSend={(q) => add(q)} mode={mode} setMode={setMode} modes={['chat']} placeholder={a.newTopicPh} />
        <div className="seg tabs">
          <button className={tab === 'ideas' ? 'on' : ''} onClick={() => setTab('ideas')}>{a.suggested}</button>
          <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>{a.reports}{topics.length ? ` (${topics.length})` : ''}</button>
        </div>
        {tab === 'ideas' ? (
          <ul className="idea-list">{a.researchIdeas.map((x) => <li key={x}><button className="plain-row" onClick={() => add(x)}>{x}</button></li>)}</ul>
        ) : topics.length === 0 ? <p className="muted small">{a.noReports}</p> : (
          <ul className="idea-list">{topics.map((x, i) => <li key={i} className="report-row"><span>{x}</span><em>{a.queued}</em></li>)}</ul>
        )}
      </section>
      {priced.length > 0 && (
        <section className="research">
          <aside className="card inst-list">
            <h2>{a.yourInstruments}</h2>
            <ul>
              {priced.map(({ r, ins }, i) => (
                <li key={r.key}>
                  <button className={i === sel ? 'on' : ''} onClick={() => setSel(i)}>
                    <b>{r.symbol}</b>
                    <small>{ins!.name}</small>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="card inst">
            <p className="muted small">{cur.r.where}</p>
            <h2 className="inst-name">{cur.ins!.name}</h2>
            <dl className="facts">
              {cur.ins!.isin && <Fact k={a.isin} v={cur.ins!.isin} />}
              <Fact k={a.lastClose} v={`${F.money(cur.ins!.price, cur.ins!.currency, lang)} · ${F.date(cur.ins!.date, lang)}`} />
              {cur.ins!.changePct !== undefined && <Fact k={a.dayMove} v={signed(cur.ins!.changePct, lang)} />}
              <Fact k={a.yourPosition} v={`${F.qty(cur.r.quantity, lang)} · ${F.eur(cur.r.valueEur, lang)}`} />
              <Fact k={a.share} v={F.pct(cur.r.sharePct, lang)} />
            </dl>
            <h3>{a.virtuseGuides}</h3>
            <ul className="guides">
              {a.guides.map(([label, href]) => <li key={href}><a href={href} target="_blank" rel="noopener">{label} ↗</a></li>)}
            </ul>
            <p className="muted small">{BOOK.prices.source} · {BOOK.fx.source}</p>
          </div>
        </section>
      )}
    </>
  )
}

/* ------------------------------------------------------------- Radar */

function ruleLine(rule: Rule, actual: number | undefined, symbol: string | undefined, lang: Lang): string {
  if (actual === undefined) return rule.text
  const sk = lang === 'sk'
  switch (rule.kind) {
    case 'move': return sk ? `${symbol}: ${signed(actual, lang)} za deň` : `${symbol}: ${signed(actual, lang)} in a day`
    case 'share_above': return sk ? `${symbol} tvorí ${F.pct(actual, lang)} majetku` : `${symbol} is ${F.pct(actual, lang)} of assets`
    case 'networth_below': return sk ? `Čistý majetok ${F.eur(actual, lang)}` : `Net worth ${F.eur(actual, lang)}`
    case 'btc_fee_above': return sk ? `Poplatky ${F.pct(actual, lang, 2)} z nákupov` : `Fees ${F.pct(actual, lang, 2)} of buys`
    case 'cash_below': return sk ? `Hotovosť ${F.eur(actual, lang)}` : `Cash ${F.eur(actual, lang)}`
  }
}

export function RadarPage({ lang, profile, price, radar, prefs, setPrefs, setProfile, onCreate }: Ctx & { prefs: typeof DEFAULT_RADAR; setPrefs: (p: typeof DEFAULT_RADAR) => void; onCreate: (q: string) => void }) {
  const a = app(lang)
  const rules = profile.rules ?? []
  const hits = useMemo(() => checkRules(rules, profile, price, BOOK), [rules, profile, price])
  const fields: [keyof typeof DEFAULT_RADAR, string, number][] = [
    ['movePct', a.moveTh, 0.5],
    ['feePct', a.feeTh, 0.1],
    ['concentrationPct', a.concTh, 5],
    ['cashPct', a.cashTh, 5],
  ]
  return (
    <>
      <Head title={a.radarTitle} lead={a.radarLead} right={<button onClick={() => onCreate('')}>{a.create} +</button>} />
      <section className="how3">
        {a.radarHow.map(([h, p], i) => (
          <div key={h} className="card how3-card">
            <span className="step-n">{i + 1}</span>
            <h3>{h}</h3>
            <p className="muted small">{p}</p>
          </div>
        ))}
      </section>

      <section className="radar-layout">
        <div>
          <div className="card">
            <h2>{a.yourRules}</h2>
            {rules.length === 0 ? <p className="muted small">{a.noRules}</p> : (
              <ul className="rule-list">
                {rules.map((r) => {
                  const own = hits.filter((h) => h.rule.id === r.id)
                  return (
                    <li key={r.id}>
                      <div>
                        <p>{r.text}</p>
                        {own.map((h, i) => <p key={i} className="small hit">● {ruleLine(r, h.actual, h.symbol, lang)}</p>)}
                      </div>
                      <span className={`lvl ${own.length ? 'watch' : ''}`}>{own.length ? a.ruleHit : a.ruleQuiet}</span>
                      <button className="link" onClick={() => setProfile((p) => ({ ...p, rules: (p.rules ?? []).filter((x) => x.id !== r.id) }))}>{a.remove}</button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="card">
            <h2>{a.templates}</h2>
            <div className="tmpl-grid">
              {a.ruleTemplates.map(([k, text]) => (
                <button key={text} className="tmpl" onClick={() => onCreate(text)}>
                  <b>{k}</b>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>{a.autoFeed}</h2>
            {radar.length === 0 ? <p className="muted">{a.radarEmpty}</p> : <ul className="radar-list">{radar.map((r) => <RadarRow key={r.id} item={r} lang={lang} />)}</ul>}
          </div>
        </div>
        <aside className="card">
          <h2>{a.settings}</h2>
          {fields.map(([k, label, step]) => (
            <label key={k} className="setting">
              <span>{label}</span>
              <span className="num">
                <input type="number" min={0} step={step} value={prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: Math.max(0, Number(e.target.value) || 0) })} />
                %
              </span>
            </label>
          ))}
          <button className="link" onClick={() => setPrefs(DEFAULT_RADAR)}>Reset</button>
        </aside>
      </section>
    </>
  )
}

/* ------------------------------------------------------------- Portfolio */

export function PortfolioPage({ lang, profile, price, o, go }: Ctx) {
  const a = app(lang)
  const t = strings(lang)
  const [tab, setTab] = useState(0)
  const rows = useMemo(() => portfolioRows(profile, price, BOOK, o.assetsEur), [profile, price, o.assetsEur])
  const basisLabel = (r: PortfolioRow) => (r.basis === 'btc' ? a.basisBtc : t.basis[r.basis])
  return (
    <>
      <Head title={a.nav.portfolio} lead={a.portfolioLead} right={<button onClick={() => go('data')}>+ {a.addAssetType}</button>} />
      <div className="tabs-line">
        {a.tabsPortfolio.map((x, i) => <button key={x} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{x}</button>)}
      </div>
      {tab === 0 && (rows.length === 0 ? <Empty lang={lang} go={go} /> : (
        <section className="card table-card">
          <table>
            <thead>
              <tr><th>{a.colName}</th><th>{a.colWhere}</th><th className="r">{a.colQty}</th><th className="r">{a.colValue}</th><th className="r">{a.colShare}</th><th className="r">{a.colDay}</th><th>{a.colBasis}</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td><b>{r.symbol}</b>{r.name && <small className="basis">{r.name}</small>}</td>
                  <td>{r.where}</td>
                  <td className="r">{r.symbol === 'BTC' ? F.btc(r.quantity, lang) : F.qty(r.quantity, lang)}</td>
                  <td className="r"><b>{F.eur(r.valueEur, lang)}</b></td>
                  <td className="r">{F.pct(r.sharePct, lang)}</td>
                  <td className={`r ${dayClass(r.changePct)}`}>{r.changePct === undefined ? '–' : signed(r.changePct, lang)}</td>
                  <td><small className={`basis b-${r.basis}`}>{basisLabel(r)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {tab === 1 && (profile.brokers.length > 0 ? <BrokersCard lang={lang} accounts={profile.brokers} book={BOOK} /> : <Empty lang={lang} go={go} />)}
      {tab === 2 && (
        <>
          <section className="card">
            {profile.manualAssets.length === 0 ? <p className="muted small">{a.noManual}</p> : (
              <ul className="items">
                {profile.manualAssets.map((m) => <li key={m.id} className="two"><span>{m.name}<small className="basis">{t.classes[m.assetClass]}</small></span><b>{F.eur(m.valueEur, lang)}</b></li>)}
              </ul>
            )}
          </section>
          <section className="card">
            <h2>{a.addAssetType}</h2>
            <div className="type-grid">
              {a.assetTypes.map(([h, p]) => (
                <button key={h} className="type-card" onClick={() => go('data')}>
                  <b>{h}</b>
                  <span>{p}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
      {tab === 3 && (
        <section className="card">
          <div className="lrow strong"><span>{a.allLiabilities}</span><b>{F.eur(o.liabilitiesEur, lang)}</b></div>
          <ul className="items">
            {profile.liabilities.map((l) => <li key={l.id} className="two"><span>{l.name}<small className="basis">{t.debtKinds[l.kind]}</small></span><b className="down">−{F.eur(l.balanceEur, lang)}</b></li>)}
          </ul>
        </section>
      )}
    </>
  )
}

/* ------------------------------------------------------------- Goals */

export function GoalsPage({ lang, profile, price, setProfile }: Ctx) {
  const a = app(lang)
  const goals = profile.goals ?? []
  const progress = useMemo(() => goalProgress(goals, profile, price, BOOK), [goals, profile, price])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Goal['kind']>('net_worth')
  const [target, setTarget] = useState('')
  const fmt = (g: Goal, n: number) => (g.kind === 'btc' ? F.btc(n, lang) : F.eur(n, lang))
  return (
    <>
      <Head title={a.nav.goals} lead={a.goalsLead} />
      {progress.length === 0 ? <div className="card empty-state"><p className="muted">{a.noGoals}</p></div> : (
        <section className="goal-grid">
          {progress.map((p) => (
            <div key={p.goal.id} className="card goal">
              <div className="card-head">
                <h2>{p.goal.name}</h2>
                <button className="link" onClick={() => setProfile((x) => ({ ...x, goals: (x.goals ?? []).filter((g) => g.id !== p.goal.id) }))}>{a.remove}</button>
              </div>
              <p className="muted small">{a.goalKinds[p.goal.kind]}</p>
              <div className="progress"><span style={{ width: `${p.pct}%` }} /></div>
              <div className="lrow">
                <span>{p.goal.kind === 'debt_free' ? `${fmt(p.goal, p.current)}` : `${fmt(p.goal, p.current)} ${a.goalOf} ${fmt(p.goal, p.target)}`}</span>
                <b>{p.done ? a.goalDone : F.pct(p.pct, lang, 0)}</b>
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="card">
        <h2>{a.addGoal}</h2>
        <form className="row" onSubmit={(e) => {
          e.preventDefault()
          const v = Number(target)
          if (!name.trim() || (kind !== 'debt_free' && !(v > 0))) return
          setProfile((p) => ({ ...p, goals: [...(p.goals ?? []), { id: `g${Date.now()}`, name: name.trim(), kind, target: kind === 'debt_free' ? 0 : v, startDebt: kind === 'debt_free' ? p.liabilities.reduce((s, l) => s + l.balanceEur, 0) : undefined }] }))
          setName(''); setTarget('')
        }}>
          <input placeholder={a.goalName} value={name} onChange={(e) => setName(e.target.value)} aria-label={a.goalName} />
          <select value={kind} onChange={(e) => setKind(e.target.value as Goal['kind'])} aria-label={a.goalTarget}>
            {Object.entries(a.goalKinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {kind !== 'debt_free' && <input type="number" min={0} step="any" placeholder={a.goalTarget} value={target} onChange={(e) => setTarget(e.target.value)} aria-label={a.goalTarget} />}
          <button type="submit">{a.addGoal}</button>
        </form>
      </section>
    </>
  )
}

/* ------------------------------------------------------------- Transactions */

export function TransactionsPage({ lang, profile }: Ctx) {
  const a = app(lang)
  const [kind, setKind] = useState<string>('all')
  const txs = [...profile.txs].reverse().filter((x) => kind === 'all' || x.kind === kind)
  const kinds = ['all', ...new Set(profile.txs.map((x) => x.kind))]
  return (
    <>
      <Head title={a.nav.transactions} lead={a.txLead} />
      {profile.txs.length === 0 ? <div className="card"><p className="muted">{a.txNone}</p></div> : (
        <section className="card table-card">
          <div className="seg wrap">
            {kinds.map((k) => <button key={k} className={k === kind ? 'on' : ''} onClick={() => setKind(k)}>{k === 'all' ? a.all : a.txKinds[k]}</button>)}
          </div>
          <table>
            <thead><tr><th>{a.colDate}</th><th>{a.colType}</th><th className="r">BTC</th><th className="r">{a.colEur}</th><th className="r">{a.colFee}</th></tr></thead>
            <tbody>
              {txs.map((x) => (
                <tr key={x.id}>
                  <td>{F.date(x.time, lang)}</td>
                  <td>{a.txKinds[x.kind]}</td>
                  <td className="r">{F.btc(x.btc, lang).replace(' BTC', '')}</td>
                  <td className="r">{x.eur ? F.eur(x.eur, lang, 2) : '–'}</td>
                  <td className="r">{x.feeEur ? F.eur(x.feeEur, lang, 2) : x.feeBtc ? F.btc(x.feeBtc, lang) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

/* ------------------------------------------------------------- Data & privacy */

export function DataPage({ lang, profile, price, mode, setPrice, own, setOwn, onBroker, onVaultSaved }: Ctx & {
  onVaultSaved: () => void
  setPrice: (n: number) => void
  own: Profile
  setOwn: (fn: (p: Profile) => Profile) => void
  onBroker: (a: BrokerAccount) => void
}) {
  const a = app(lang)
  const t = strings(lang)
  const [note, setNote] = useState('')
  const summary = useMemo(() => buildSummary(profile, price, BOOK), [profile, price])
  return (
    <>
      <Head title={a.nav.data} lead={a.dataLead} />
      <PriceBox lang={lang} price={price} setPrice={setPrice} book={BOOK} />
      {mode === 'demo' ? (
        <p className="card muted">{a.demoReadOnly}</p>
      ) : (
        <>
          <ImportBox lang={lang} onTxs={(txs) => setOwn((p) => ({ ...p, txs }))} onBroker={onBroker} onNote={setNote} />
          {note && <p className="note" role="status">{note}</p>}
          <ManualBox lang={lang} profile={own} setProfile={setOwn} />
          <VaultBox lang={lang} profile={own} onOpen={(p) => setOwn(() => p)} onSaved={onVaultSaved} />
        </>
      )}
      <section className="card">
        <h2>{t.leaves}</h2>
        <p className="muted">{t.leavesLead}</p>
        <pre className="payload">{JSON.stringify(summary, null, 2)}</pre>
        <p className="muted small">{t.stays}</p>
      </section>
      <footer className="foot">{t.foot}</footer>
    </>
  )
}
