export type Lang = 'sk' | 'en'

const LOCALE: Record<Lang, string> = { sk: 'sk-SK', en: 'en-IE' }

export function eur(n: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    style: 'currency',
    currency: 'EUR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

export function btc(n: number, lang: Lang): string {
  return (
    new Intl.NumberFormat(LOCALE[lang], {
      minimumFractionDigits: 4,
      maximumFractionDigits: 8,
    }).format(n) + ' BTC'
  )
}

export function pct(n: number, lang: Lang, digits = 1): string {
  const s = new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
  return lang === 'sk' ? `${s} %` : `${s}%`
}

export function date(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}
