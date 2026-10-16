// Footer operator line (legal pack 2026-10-16, 3.1): rendered under the copyright as
// <p class="footer-operator"><a href="operator.html">{label}</a>{text}</p>.
// operator.html sits in each language folder (root for EN), relative like the chrome.ts links.
// Kept out of chrome.ts because gen_chrome.py regenerates that file from the homepages.
import type { Lang } from '@/lib/i18n';

export const OPERATOR_HREF = 'operator.html';

export const OPERATOR: Record<Lang, { label: string; text: string }> = {
  en: { label: "Operator", text: ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Slovakia · Company ID (IČO) 36 709 042 · VAT ID SK2022293042 · Commercial Register of the Municipal Court Bratislava III, section Sa, file No. 4452/B · info@virtuse.com" },
  sk: { label: "Prevádzkovateľ", text: ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka · IČO 36 709 042 · IČ DPH SK2022293042 · zapísaná v Obchodnom registri Mestského súdu Bratislava III, oddiel Sa, vložka č. 4452/B · info@virtuse.com" },
  cs: { label: "Provozovatel", text: ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Slovensko · IČO 36 709 042 · DIČ pro DPH SK2022293042 · zapsaná v obchodním rejstříku Městského soudu Bratislava III, oddíl Sa, vložka č. 4452/B · info@virtuse.com" },
  uk: { label: "Оператор", text: ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Словаччина · Ідентифікаційний номер (IČO) 36 709 042 · Номер платника ПДВ SK2022293042 · зареєстрована в Торговому реєстрі Міського суду Братислава III, розділ Sa, № 4452/B · info@virtuse.com" },
  ru: { label: "Оператор", text: ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Словакия · Идентификационный номер (IČO) 36 709 042 · Номер плательщика НДС SK2022293042 · зарегистрирована в Торговом реестре Городского суда Братислава III, раздел Sa, № 4452/B · info@virtuse.com" },
  de: { label: "Betreiber", text: ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Slowakei · Firmennummer (IČO) 36 709 042 · USt-IdNr. SK2022293042 · eingetragen im Handelsregister des Stadtgerichts Bratislava III, Abteilung Sa, Einlage Nr. 4452/B · info@virtuse.com" },
  fr: { label: "Exploitant", text: " : Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Slovaquie · N° d’identification (IČO) 36 709 042 · N° TVA SK2022293042 · immatriculée au registre du commerce du tribunal municipal de Bratislava III, section Sa, n° 4452/B · info@virtuse.com" },
  es: { label: "Titular", text: ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Eslovaquia · N.º de identificación (IČO) 36 709 042 · NIF-IVA SK2022293042 · inscrita en el Registro Mercantil del Tribunal Municipal de Bratislava III, sección Sa, n.º 4452/B · info@virtuse.com" },
  pl: { label: "Operator", text: ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Słowacja · Nr identyfikacyjny (IČO) 36 709 042 · NIP UE SK2022293042 · wpisana do rejestru handlowego Sądu Miejskiego Bratysława III, sekcja Sa, nr 4452/B · info@virtuse.com" },
  hu: { label: "Üzemeltető", text: ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Szlovákia · Cégazonosító (IČO) 36 709 042 · Közösségi adószám SK2022293042 · bejegyezve a Pozsonyi III. Városi Bíróság cégjegyzékébe, Sa szakasz, 4452/B szám · info@virtuse.com" },
};
