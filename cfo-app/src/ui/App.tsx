import { useMemo, useRef, useState } from 'react'
import * as F from '../core/format'
import type { Lang } from '../core/format'
import { importCsv, UnknownFormatError } from '../core/importers'
import { emptyProfile, type AssetClass, type Liability, type ManualAsset, type Profile } from '../core/model'
import { overview } from '../core/portfolio'
import { buildSummary } from '../core/upload'
import { forgetSealed, loadSealed, open, saveSealed, seal } from '../core/vault'
import { annaKrakenCsv, annaProfile, DEMO_PRICE_EUR } from '../data/demo'
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

let idSeq = 0
const newId = () => `m${Date.now().toString(36)}${idSeq++}`

export function App() {
  const [lang, setLang] = useState<Lang>('sk')
  const t = strings(lang)
  const [mode, setMode] = useState<Mode>('demo')
  const [own, setOwn] = useState<Profile>(() => emptyProfile())
  const [price, setPrice] = useState(DEMO_PRICE_EUR)
  const [note, setNote] = useState('')
  const demo = useMemo(() => annaProfile(), [])
  const profile = mode === 'demo' ? demo : own
  const o = useMemo(() => overview(profile, price), [profile, price])
  const summary = useMemo(() => buildSummary(profile, price), [profile, price])
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
          <button role="tab" aria-selected={mode === 'demo'} className={mode === 'demo' ? 'on' : ''} onClick={() => { setMode('demo'); setPrice(DEMO_PRICE_EUR); setNote('') }}>{t.demo}</button>
          <button role="tab" aria-selected={mode === 'own'} className={mode === 'own' ? 'on' : ''} onClick={() => { setMode('own'); setNote('') }}>{t.own}</button>
        </div>
        {mode === 'demo' && <p className="banner">{t.demoBanner}</p>}
      </section>

      <PriceBox lang={lang} price={price} setPrice={setPrice} />

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
        </>
      ) : (
        <p className="card empty">{t.empty}</p>
      )}

      {mode === 'own' && (
        <>
          <ImportBox lang={lang} onImport={(txs, msg) => { setOwn((p) => ({ ...p, txs })); setNote(msg) }} onError={setNote} />
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

function PriceBox({ lang, price, setPrice }: { lang: Lang; price: number; setPrice: (n: number) => void }) {
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
    </section>
  )
}

function ImportBox({ lang, onImport, onError }: { lang: Lang; onImport: (txs: Profile['txs'], msg: string) => void; onError: (m: string) => void }) {
  const t = strings(lang)
  const input = useRef<HTMLInputElement>(null)
  function handle(text: string) {
    try {
      const r = importCsv(text)
      onImport(r.txs, t.imported(r.txs.length, r.skipped))
    } catch (e) {
      onError(e instanceof UnknownFormatError ? t.unknownFormat : t.readError)
    }
  }
  return (
    <section className="card">
      <h2>{t.import}</h2>
      <p className="muted">{t.importLead}</p>
      <div className="row">
        <button onClick={() => input.current?.click()}>{t.chooseFile}</button>
        <button className="ghost" onClick={() => handle(annaKrakenCsv())}>{t.sampleFile}</button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) handle(await f.text())
            e.target.value = ''
          }}
        />
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
