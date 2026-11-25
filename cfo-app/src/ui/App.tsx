import { useMemo, useRef, useState } from 'react'
import * as F from '../core/format'
import type { Lang } from '../core/format'
import { BROKER_NAMES, mergeAccount, type BrokerAccount } from '../core/brokers'
import { importCsv, UnknownFormatError } from '../core/importers'
import { emptyProfile, type AssetClass, type Liability, type ManualAsset, type Profile } from '../core/model'
import { overview } from '../core/portfolio'
import { buildSummary } from '../core/upload'
import { forgetSealed, loadSealed, open, saveSealed, seal } from '../core/vault'
import { annaKrakenCsv, annaProfile, DEMO_PRICE_EUR } from '../data/demo'
import priceData from '../data/prices.json'
import { btcPriceEur, revalue, type PriceBook } from '../core/prices'
import { SAMPLES } from '../data/samples'
import { strings } from './strings'

type Mode = 'demo' | 'own'
const CLASS_COLOR: Record<AssetClass, string> = {
  bitcoin: '#f7931a',
  cash: '#8b949e',
  stocks: '#5faede',
  real_estate: '#a78bfa',
  pension: '#2dd4bf',
  other: '#484f58',
}
const MANUAL_CLASSES: Exclude<AssetClass, 'bitcoin'>[] = ['cash', 'stocks', 'real_estate', 'pension', 'other']

const BOOK = priceData as PriceBook
const START_PRICE = Math.round(btcPriceEur(BOOK) ?? DEMO_PRICE_EUR)

let idSeq = 0
const newId = () => `m${Date.now().toString(36)}${idSeq++}`

export function App() {
  const [lang, setLang] = useState<Lang>('sk')
  const t = strings(lang)
  const [mode, setMode] = useState<Mode>('demo')
  const [own, setOwn] = useState<Profile>(() => emptyProfile())
  const [price, setPrice] = useState(START_PRICE)
  const [note, setNote] = useState('')
  const demo = useMemo(() => annaProfile(), [])
  const profile = mode === 'demo' ? demo : own
  const o = useMemo(() => overview(profile, price, BOOK), [profile, price])
  const summary = useMemo(() => buildSummary(profile, price, BOOK), [profile, price])
  const hasData = o.assetsEur > 0 || profile.txs.length > 0

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <span className="logo">Virtuse</span> <span className="muted">CFO</span>
          <span className="tag">{t.tag}</span>
        </div>
        <div className="seg" role="group" aria-label="Language">
          {(['sk', 'en'] as Lang[]).map((l) => (
            <button key={l} className={l === lang ? 'on' : ''} onClick={() => { setLang(l); document.documentElement.lang = l }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <section className="hero">
        <h1>{t.title}</h1>
        <p className="lead">{t.lead}</p>
        <div className="seg big" role="tablist">
          <button role="tab" aria-selected={mode === 'demo'} className={mode === 'demo' ? 'on' : ''} onClick={() => { setMode('demo'); setPrice(START_PRICE); setNote('') }}>{t.demo}</button>
          <button role="tab" aria-selected={mode === 'own'} className={mode === 'own' ? 'on' : ''} onClick={() => { setMode('own'); setNote('') }}>{t.own}</button>
        </div>
        {mode === 'demo' && <p className="banner">{t.demoBanner}</p>}
      </section>

      <PriceBox lang={lang} price={price} setPrice={setPrice} book={BOOK} />

      {hasData ? (
        <>
          <section className="kpis">
            <Kpi label={t.netWorth} value={F.eur(o.netWorthEur, lang)} />
            <Kpi label={t.assets} value={F.eur(o.assetsEur, lang)} />
            <Kpi label={t.debts} value={F.eur(o.liabilitiesEur, lang)} />
            <Kpi label={t.btcShare} value={F.pct(o.btcSharePct, lang)} sub={t.btcShareNote} />
          </section>

          <section className="grid2">
            <div className="card">
              <h2>{t.btcTitle}</h2>
              <dl className="facts">
                <Fact k={t.held} v={F.btc(o.bitcoin.btc, lang)} />
                <Fact k={t.value} v={F.eur(o.bitcoin.valueEur, lang)} />
                <Fact k={t.invested} v={F.eur(o.bitcoin.netInvestedEur, lang)} />
                <Fact k={t.avg} v={o.bitcoin.avgBuyPrice ? F.eur(o.bitcoin.avgBuyPrice, lang) : '–'} />
                <Fact k={t.gain} v={F.eur(o.bitcoin.gainEur, lang)} />
                <Fact k={t.fees} v={`${F.eur(o.bitcoin.feesEur, lang, 2)} · ${F.pct(o.bitcoin.feePct, lang, 2)} ${t.feePct}`} />
                <Fact k={t.buys} v={o.bitcoin.firstBuy ? `${o.bitcoin.buys} · ${t.since} ${F.date(o.bitcoin.firstBuy, lang)}` : String(o.bitcoin.buys)} />
              </dl>
            </div>
            <div className="card">
              <h2>{t.allocation}</h2>
              <div className="bar" aria-hidden="true">
                {o.allocation.map((s) => (
                  <span key={s.assetClass} style={{ width: `${s.pct}%`, background: CLASS_COLOR[s.assetClass] }} />
                ))}
              </div>
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
          </section>
          {profile.brokers.length > 0 && <BrokersCard lang={lang} accounts={profile.brokers} book={BOOK} />}
        </>
      ) : (
        <p className="card empty">{t.empty}</p>
      )}

      {mode === 'own' && (
        <>
          <ImportBox
            lang={lang}
            onTxs={(txs) => setOwn((p) => ({ ...p, txs }))}
            onBroker={(a) => setOwn((p) => ({ ...p, brokers: [...p.brokers.filter((b) => b.source !== a.source), mergeAccount(p.brokers.find((b) => b.source === a.source), a)] }))}
            onNote={setNote}
          />
          {note && <p className="note" role="status">{note}</p>}
          <ManualBox lang={lang} profile={own} setProfile={setOwn} />
          <VaultBox lang={lang} profile={own} onOpen={(p) => setOwn(p)} />
        </>
      )}

      <section className="card">
        <h2>{t.leaves}</h2>
        <p className="muted">{t.leavesLead}</p>
        <pre className="payload">{JSON.stringify(summary, null, 2)}</pre>
        <p className="muted small">{t.stays}</p>
      </section>

      <footer className="foot">{t.foot}</footer>
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
      {sub && <span className="s">{sub}</span>}
    </div>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  )
}

function PriceBox({ lang, price, setPrice, book }: { lang: Lang; price: number; setPrice: (n: number) => void; book: PriceBook }) {
  const t = strings(lang)
  const [err, setErr] = useState(false)
  async function load() {
    setErr(false)
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur')
      const j = (await r.json()) as { bitcoin?: { eur?: number } }
      if (!j.bitcoin?.eur) throw new Error('no price')
      setPrice(Math.round(j.bitcoin.eur))
    } catch {
      setErr(true)
    }
  }
  return (
    <section className="pricebox">
      <label>
        <span>{t.price}</span>
        <input type="number" min={1} step={100} value={price} onChange={(e) => setPrice(Math.max(1, Number(e.target.value) || 1))} />
      </label>
      <button className="ghost" onClick={load}>{t.loadPrice}</button>
      <span className="muted small">{err ? t.priceFail : t.priceHint}</span>
      <p className="muted small sources">{t.sources(F.date(book.fx.date, lang), F.date(book.prices.instruments[0]?.date ?? book.fx.date, lang), book.prices.instruments.length)}</p>
    </section>
  )
}

function ImportBox({ lang, onTxs, onBroker, onNote }: { lang: Lang; onTxs: (txs: Profile['txs']) => void; onBroker: (a: BrokerAccount) => void; onNote: (m: string) => void }) {
  const t = strings(lang)
  const input = useRef<HTMLInputElement>(null)
  function handle(texts: string[]) {
    const msgs: string[] = []
    for (const text of texts) {
      try {
        const r = importCsv(text)
        if (r.kind === 'btc') {
          onTxs(r.txs)
          msgs.push(t.imported(r.txs.length, r.skipped))
        } else {
          onBroker(r.account)
          msgs.push(t.importedBroker(BROKER_NAMES[r.account.source], r.account.has.positions ? r.account.holdings.length : -1))
        }
      } catch (e) {
        msgs.push(e instanceof UnknownFormatError ? t.unknownFormat : t.readError)
      }
    }
    onNote(msgs.join(' '))
  }
  const samples: [string, string[]][] = [
    ['Kraken', [annaKrakenCsv()]],
    ['XTB', [SAMPLES.xtbPositions, SAMPLES.xtbCash]],
    ['IBKR', [SAMPLES.ibkr]],
    ['Trading 212', [SAMPLES.t212]],
  ]
  return (
    <section className="card">
      <h2>{t.import}</h2>
      <p className="muted">{t.importLead}</p>
      <ul className="howto">
        {t.howto.map(([who, how]) => <li key={who}><b>{who}</b> {how}</li>)}
      </ul>
      <div className="row">
        <button onClick={() => input.current?.click()}>{t.chooseFile}</button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          hidden
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])]
            if (files.length) handle(await Promise.all(files.map((f) => f.text())))
            e.target.value = ''
          }}
        />
      </div>
      <div className="row">
        <span className="muted small">{t.sampleFile}:</span>
        {samples.map(([name, texts]) => (
          <button key={name} className="ghost" onClick={() => handle(texts)}>{name}</button>
        ))}
      </div>
    </section>
  )
}

function BrokersCard({ lang, accounts, book }: { lang: Lang; accounts: BrokerAccount[]; book: PriceBook }) {
  const t = strings(lang)
  return (
    <section className="card">
      <h2>{t.brokers}</h2>
      <div className="brokers">
        {accounts.map((raw) => {
          const { account: a, holdings, unpriced } = revalue(raw, book)
          const notes = a.notes.filter((n) => !(n === 'valued_at_cost' && unpriced === 0 && holdings.length > 0))
          return (
            <div key={a.source} className="broker">
              <h3>{BROKER_NAMES[a.source]}{a.period && <span className="muted small"> · {a.period}</span>}</h3>
              <dl className="facts">
                {a.has.positions && <Fact k={a.valuedAt === 'cost' ? t.investedAtCost : t.investedMarket} v={F.eur(a.investedValueEur, lang)} />}
                {a.has.cash && <Fact k={t.cash} v={F.eur(a.cashEur, lang)} />}
                {a.has.cash && <Fact k={t.deposited} v={F.eur(a.depositedEur - a.withdrawnEur, lang)} />}
                {a.has.cash && <Fact k={t.income} v={F.eur(a.dividendsEur, lang, 2)} />}
                {a.has.cash && a.taxWithheldEur > 0 && <Fact k={t.taxWithheld} v={F.eur(a.taxWithheldEur, lang, 2)} />}
                {a.has.cash && <Fact k={t.brokerFees} v={F.eur(a.feesEur, lang, 2)} />}
              </dl>
              {holdings.length > 0 && (
                <ul className="items holdings">
                  {holdings.map((h) => (
                    <li key={h.symbol}>
                      <span>{h.symbol}<small className={`basis b-${h.basis}`}>{t.basis[h.basis]}</small></span>
                      <em>{F.qty(h.quantity, lang)} {t.pcs}</em>
                      <b title={h.currency !== 'EUR' && h.value !== undefined ? F.money(h.value, h.currency, lang) : undefined}>{h.basis === 'none' ? '–' : F.eur(h.valueEur, lang)}</b>
                    </li>
                  ))}
                </ul>
              )}
              {unpriced > 0 && <p className="muted small">{t.unpricedNote(unpriced)}</p>}
              {!a.has.positions && <p className="muted small">{t.missingPositions}</p>}
              {!a.has.cash && <p className="muted small">{t.missingCash}</p>}
              {notes.map((n) => <p key={n} className="muted small">{t.note(n)}</p>)}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ManualBox({ lang, profile, setProfile }: { lang: Lang; profile: Profile; setProfile: (fn: (p: Profile) => Profile) => void }) {
  const t = strings(lang)
  const [name, setName] = useState('')
  const [cls, setCls] = useState<ManualAsset['assetClass']>('cash')
  const [amt, setAmt] = useState('')
  const [dName, setDName] = useState('')
  const [dKind, setDKind] = useState<Liability['kind']>('mortgage')
  const [dAmt, setDAmt] = useState('')

  return (
    <section className="card">
      <h2>{t.manual}</h2>
      <p className="muted">{t.manualLead}</p>
      <ul className="items">
        {profile.manualAssets.map((a) => (
          <li key={a.id}>
            <span>{a.name}</span><em>{t.classes[a.assetClass]}</em><b>{F.eur(a.valueEur, lang)}</b>
            <button className="link" onClick={() => setProfile((p) => ({ ...p, manualAssets: p.manualAssets.filter((x) => x.id !== a.id) }))}>{t.remove}</button>
          </li>
        ))}
        {profile.liabilities.map((l) => (
          <li key={l.id} className="debt">
            <span>{l.name}</span><em>{t.debtKinds[l.kind]}</em><b>−{F.eur(l.balanceEur, lang)}</b>
            <button className="link" onClick={() => setProfile((p) => ({ ...p, liabilities: p.liabilities.filter((x) => x.id !== l.id) }))}>{t.remove}</button>
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={(e) => {
        e.preventDefault()
        const v = Number(amt)
        if (!name.trim() || !(v > 0)) return
        setProfile((p) => ({ ...p, manualAssets: [...p.manualAssets, { id: newId(), name: name.trim(), assetClass: cls, valueEur: v }] }))
        setName(''); setAmt('')
      }}>
        <input placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} aria-label={t.name} />
        <select value={cls} onChange={(e) => setCls(e.target.value as ManualAsset['assetClass'])} aria-label={t.kind}>
          {MANUAL_CLASSES.map((c) => <option key={c} value={c}>{t.classes[c]}</option>)}
        </select>
        <input type="number" min={0} placeholder={t.amount} value={amt} onChange={(e) => setAmt(e.target.value)} aria-label={t.amount} />
        <button type="submit">{t.add}</button>
      </form>
      <form className="row" onSubmit={(e) => {
        e.preventDefault()
        const v = Number(dAmt)
        if (!dName.trim() || !(v > 0)) return
        setProfile((p) => ({ ...p, liabilities: [...p.liabilities, { id: newId(), name: dName.trim(), kind: dKind, balanceEur: v }] }))
        setDName(''); setDAmt('')
      }}>
        <input placeholder={t.name} value={dName} onChange={(e) => setDName(e.target.value)} aria-label={t.name} />
        <select value={dKind} onChange={(e) => setDKind(e.target.value as Liability['kind'])} aria-label={t.kind}>
          {(Object.keys(t.debtKinds) as Liability['kind'][]).map((k) => <option key={k} value={k}>{t.debtKinds[k]}</option>)}
        </select>
        <input type="number" min={0} placeholder={t.amount} value={dAmt} onChange={(e) => setDAmt(e.target.value)} aria-label={t.amount} />
        <button type="submit" className="ghost">{t.addDebt}</button>
      </form>
      <label className="row inline">
        <span className="muted">{t.extraBtc}</span>
        <input type="number" min={0} step={0.001} value={profile.extraBtc || ''} placeholder="0" onChange={(e) => setProfile((p) => ({ ...p, extraBtc: Math.max(0, Number(e.target.value) || 0) }))} />
      </label>
    </section>
  )
}

function VaultBox({ lang, profile, onOpen }: { lang: Lang; profile: Profile; onOpen: (p: Profile) => void }) {
  const t = strings(lang)
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState('')
  return (
    <section className="card">
      <h2>{t.vault}</h2>
      <p className="muted">{t.vaultLead}</p>
      <div className="row">
        <input type="password" autoComplete="new-password" placeholder={t.passphrase} value={pass} onChange={(e) => setPass(e.target.value)} aria-label={t.passphrase} />
        <button onClick={async () => {
          try { saveSealed(await seal(profile, pass)); setMsg(t.saved) } catch { setMsg(t.shortPass) }
        }}>{t.save}</button>
        <button className="ghost" onClick={async () => {
          const s = loadSealed()
          if (!s) return setMsg(t.nothingSaved)
          try { onOpen(await open(s, pass)); setMsg(t.opened) } catch { setMsg(t.wrongPass) }
        }}>{t.openVault}</button>
        <button className="link" onClick={() => { forgetSealed(); setMsg(t.forgotten) }}>{t.forget}</button>
      </div>
      {msg && <p className="note" role="status">{msg}</p>}
    </section>
  )
}
