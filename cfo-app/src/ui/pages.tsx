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

export function DashboardPage({ lang, profile, price, o, radar, go, mode, onAsk }: Ctx & { onAsk: (q: string) => void }) {
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

export function AskPage({ lang, profile, price, chats, setChats, pending, clearPending }: Ctx & { chats: Chat[]; setChats: (fn: (c: Chat[]) => Chat[]) => void; pending: string; clearPending: () => void }) {
  const a = app(lang)
  const [activeId, setActiveId] = useState<string | null>(chats[0]?.id ?? null)
  const [q, setQ] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const active = chats.find((c) => c.id === activeId) ?? null

  function send(text: string) {
    const question = text.trim()
    if (!question) return
    const answer = ask(question, profile, price, BOOK, lang)
    const msgs: ChatMsg[] = [{ role: 'user', text: question }, { role: 'cfo', text: '', answer }]
    if (active) {
      setChats((cs) => cs.map((c) => (c.id === active.id ? { ...c, msgs: [...c.msgs, ...msgs] } : c)))
    } else {
      const id = `c${Date.now()}`
      setChats((cs) => [{ id, title: question.slice(0, 48), msgs }, ...cs])
      setActiveId(id)
    }
    setQ('')
  }

  useEffect(() => {
    if (pending) {
      send(pending)
      clearPending()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [active?.msgs.length])

  return (
    <>
      <Head title={a.askTitle} lead={a.askLead} />
      <section className="ask-layout">
        <aside className="card chat-list">
          <button className="ghost full" onClick={() => setActiveId(null)}>+ {a.newChat}</button>
          <ul>
            {chats.map((c) => (
              <li key={c.id} className={c.id === activeId ? 'on' : ''}>
                <button className="chat-title" onClick={() => setActiveId(c.id)}>{c.title || a.untitled}</button>
                <button className="link" onClick={() => { setChats((cs) => cs.filter((x) => x.id !== c.id)); if (activeId === c.id) setActiveId(null) }}>{a.deleteChat}</button>
              </li>
            ))}
          </ul>
          <p className="muted small">{a.chatsNotSaved}</p>
        </aside>
        <div className="card chat">
          <div className="msgs">
            {!active && (
              <div className="chat-empty">
                <p className="muted">{a.askNote}</p>
                <div className="chips">{SUGGESTED[lang].map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>
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
          <form className="composer" onSubmit={(e) => { e.preventDefault(); send(q) }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={a.askPlaceholder} aria-label={a.askTitle} />
            <button type="submit">{a.askSend}</button>
          </form>
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------------- Research */

export function ResearchPage({ lang, profile, price, o, go }: Ctx) {
  const a = app(lang)
  const rows = useMemo(() => portfolioRows(profile, price, BOOK, o.assetsEur), [profile, price, o.assetsEur])
  const priced = rows
    .map((r) => ({ r, ins: r.symbol === 'BTC' ? BOOK.prices.instruments.find((i) => i.id === 'BTC') ?? null : findInstrument({ symbol: r.symbol }, BOOK) }))
    .filter((x) => x.ins)
  const [sel, setSel] = useState(0)
  const [topic, setTopic] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const cur = priced[Math.min(sel, priced.length - 1)]

  return (
    <>
      <Head title={app(lang).nav.research} lead={a.researchLead} />
      <section className="card">
        <h2>{a.newTopic}</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (topic.trim()) { setTopics((t) => [topic.trim(), ...t]); setTopic('') } }}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={a.newTopicPh} aria-label={a.newTopic} />
          <button type="submit" className="ghost">{a.addTopic}</button>
        </form>
        <p className="muted small">{a.newTopicNote}</p>
        {topics.length > 0 && <ul className="items">{topics.map((x, i) => <li key={i} className="two"><span>{x}</span><em>{a.queued}</em></li>)}</ul>}
      </section>
      {priced.length === 0 ? (
        <div className="card empty-state"><p className="muted">{a.noInstruments}</p><button onClick={() => go('data')}>{a.emptyCta}</button></div>
      ) : (
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

export function RadarPage({ lang, radar, prefs, setPrefs }: Ctx & { prefs: typeof DEFAULT_RADAR; setPrefs: (p: typeof DEFAULT_RADAR) => void }) {
  const a = app(lang)
  const fields: [keyof typeof DEFAULT_RADAR, string, number][] = [
    ['movePct', a.moveTh, 0.5],
    ['feePct', a.feeTh, 0.1],
    ['concentrationPct', a.concTh, 5],
    ['cashPct', a.cashTh, 5],
  ]
  return (
    <>
      <Head title={a.radarTitle} lead={a.radarLead} />
      <section className="radar-layout">
        <div className="card">
          {radar.length === 0 ? <p className="muted">{a.radarEmpty}</p> : <ul className="radar-list">{radar.map((r) => <RadarRow key={r.id} item={r} lang={lang} />)}</ul>}
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
  const rows = useMemo(() => portfolioRows(profile, price, BOOK, o.assetsEur), [profile, price, o.assetsEur])
  const basisLabel = (r: PortfolioRow) => (r.basis === 'btc' ? a.basisBtc : t.basis[r.basis])
  return (
    <>
      <Head title={a.nav.portfolio} lead={a.portfolioLead} />
      {rows.length === 0 ? <Empty lang={lang} go={go} /> : (
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
      )}
      {profile.brokers.length > 0 && <BrokersCard lang={lang} accounts={profile.brokers} book={BOOK} />}
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

export function DataPage({ lang, profile, price, mode, setPrice, own, setOwn, onBroker }: Ctx & {
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
          <VaultBox lang={lang} profile={own} onOpen={(p) => setOwn(() => p)} />
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
