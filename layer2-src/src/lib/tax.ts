// ─────────────────────────────────────────────────────────────
// Tax & Inheritance Agent – country tax overviews + inheritance
// readiness scoring. Virtuse Layer 2 (Module: Tax)
// IMPORTANT: figures are an INDICATIVE 2025 overview for
// education – tax law changes fast. Not tax advice.
//
// Trilingual (en/sk/cs): display strings are {en, sk, cs} triples.
// Scoring math (tiers, points, thresholds) is 100% unchanged from the
// English-only version — do not rework it.
// ─────────────────────────────────────────────────────────────

import { t } from './i18n';
import type { Lang, LocalizedText } from './i18n';
export type { Lang, LocalizedText };

export interface CountryTax {
  id: string;
  name: LocalizedText;
  flag: string;
  gainTax: LocalizedText;
  exemption: LocalizedText;
  filing: LocalizedText;
  note: LocalizedText;
}

export const COUNTRY_TAX: CountryTax[] = [
  {
    id: 'cz',
    name: { en: 'Czechia', sk: 'Česko', cs: 'Česko' },
    flag: '🇨🇿',
    gainTax: { en: '15 % income tax (23 % above threshold)', sk: '15 % daň z príjmu (23 % nad prahovou hodnotou)', cs: '15 % daň z příjmu (23 % nad prahovou hodnotou)' },
    exemption: { en: 'Tax-free after 3-year holding (time test)', sk: 'Bez dane po 3-ročnom držaní (časový test)', cs: 'Bez daně po 3letém držení (časový test)' },
    filing: { en: 'Annual personal tax return', sk: 'Ročné daňové priznanie fyzickej osoby', cs: 'Roční daňové přiznání fyzické osoby' },
    note: { en: 'Every disposal (incl. crypto-to-crypto) is a taxable event – keep complete records from day one.', sk: 'Každé zbavenie sa (vrátane krypto-krypto) je zdaniteľná udalosť – veďte si kompletnú evidenciu od prvého dňa.', cs: 'Každé zbavení se (včetně krypto-krypto) je zdanitelná událost – veďte si kompletní evidenci od prvního dne.' },
  },
  {
    id: 'sk',
    name: { en: 'Slovakia', sk: 'Slovensko', cs: 'Slovensko' },
    flag: '🇸🇰',
    gainTax: { en: '19–35 % income tax + 16 % health contributions', sk: '19–35 % daň z príjmov + 16 % zdravotné odvody', cs: '19–35 % daň z příjmů + 16 % zdravotní pojištění' },
    exemption: { en: 'No holding-period exemption', sk: 'Bez oslobodenia podľa doby držania', cs: 'Bez osvobození podle doby držení' },
    filing: { en: 'Annual personal tax return (type B), due 31 March', sk: 'Daňové priznanie fyzickej osoby typ B, do 31. marca', cs: 'Daňové přiznání fyzické osoby typu B, do 31. března' },
    note: { en: 'Every disposal (incl. crypto-to-crypto) is taxable. A planned 7 % rate and 1-year exemption were cancelled before taking effect.', sk: 'Každý predaj aj výmena krypto za krypto sa zdaňuje. Plánovanú sadzbu 7 % a oslobodenie po 1 roku zrušili skôr, než nadobudli účinnosť.', cs: 'Každý prodej i směna krypto za krypto se daní. Plánovanou sazbu 7 % a osvobození po 1 roce zrušili dříve, než nabyly účinnosti.' },
  },
  {
    id: 'pl',
    name: { en: 'Poland', sk: 'Poľsko', cs: 'Polsko' },
    flag: '🇵🇱',
    gainTax: { en: '19 % flat capital gains tax', sk: '19 % jednotná daň z kapitálových výnosov', cs: '19 % jednotná daň z kapitálových výnosů' },
    exemption: { en: 'No holding-period exemption', sk: 'Bez oslobodenia podľa doby držania', cs: 'Bez osvobození podle doby držení' },
    filing: { en: 'Annual PIT-38', sk: 'Ročné priznanie PIT-38', cs: 'Roční přiznání PIT-38' },
    note: { en: 'Crypto-to-crypto swaps are not taxed – only sales for money, goods or services are. Calculate each sale’s PLN gain or loss.', sk: 'Výmeny krypto za krypto sa nezdaňujú – zdaňuje sa len predaj za peniaze, tovar alebo služby. Pri každom predaji vypočítajte zisk v PLN.', cs: 'Výměny kryptoměny za kryptoměnu se nedaní – daní se jen prodej za peníze, zboží nebo služby. U každého prodeje vypočítejte zisk v PLN.' },
  },
  {
    id: 'at',
    name: { en: 'Austria', sk: 'Rakúsko', cs: 'Rakousko' },
    flag: '🇦🇹',
    gainTax: { en: '27.5 % KESt (capital gains tax)', sk: '27,5 % KESt (daň z kapitálových výnosov)', cs: '27,5 % KESt (daň z kapitálových výnosů)' },
    exemption: { en: 'Tax-free after 1 year only for crypto bought before March 2021; later purchases have no exemption', sk: 'Po 1 roku bez dane len pri kryptomenách kúpených pred marcom 2021; neskoršie nákupy bez oslobodenia', cs: 'Po 1 roce bez daně jen u kryptoměn koupených před březnem 2021; pozdější nákupy bez osvobození' },
    filing: { en: 'Annual return for gains via foreign exchanges; Austrian providers withhold the tax', sk: 'Priznanie pre zisky cez zahraničné burzy; rakúski poskytovatelia daň zrážajú', cs: 'Přiznání pro zisky přes zahraniční burzy; rakouští poskytovatelé daň srážejí' },
    note: { en: 'Crypto-to-crypto swaps are tax-neutral. Lending and mining are taxed on receipt; staking rewards and airdrops are taxed when sold, at zero cost.', sk: 'Výmeny krypto za krypto sú daňovo neutrálne. Požičiavanie a ťažba sa zdaňujú pri prijatí, staking a airdropy až pri predaji (s nulovou cenou).', cs: 'Výměny kryptoměny za kryptoměnu jsou daňově neutrální. Půjčování a těžba se daní při přijetí, staking a airdropy až při prodeji (s nulovou cenou).' },
  },
  {
    id: 'de',
    name: { en: 'Germany', sk: 'Nemecko', cs: 'Německo' },
    flag: '🇩🇪',
    gainTax: { en: 'Up to 45 % income tax (progressive)', sk: 'Až 45 % daň z príjmu (progresívna)', cs: 'Až 45 % daň z příjmu (progresivní)' },
    exemption: { en: '0 % after 1-year holding (private-sale exemption)', sk: '0 % po 1-ročnom držaní (oslobodenie súkromného predaja)', cs: '0 % po ročním držení (osvobození soukromého prodeje)' },
    filing: { en: 'Annual tax return', sk: 'Ročné daňové priznanie', cs: 'Roční daňové přiznání' },
    note: { en: 'Crypto-to-crypto is taxable within the first year. FIFO record-keeping is critical.', sk: 'Krypto-krypto je zdaniteľné počas prvého roka. Evidencia metódou FIFO je kľúčová.', cs: 'Krypto-krypto je zdanitelné během prvního roku. Evidence metodou FIFO je klíčová.' },
  },
  {
    id: 'hu',
    name: { en: 'Hungary', sk: 'Maďarsko', cs: 'Maďarsko' },
    flag: '🇭🇺',
    gainTax: { en: '15 % capital gains tax', sk: '15 % daň z kapitálových výnosov', cs: '15 % daň z kapitálových výnosů' },
    exemption: { en: 'No holding-period exemption', sk: 'Bez oslobodenia podľa doby držania', cs: 'Bez osvobození podle doby držení' },
    filing: { en: 'Annual personal income tax return', sk: 'Ročné priznanie dane z príjmu fyzickej osoby', cs: 'Roční přiznání daně z příjmu fyzické osoby' },
    note: { en: 'Documented acquisition costs are deductible – keep every invoice.', sk: 'Doložené obstarávacie náklady sú odpočítateľné – uchovávajte každú faktúru.', cs: 'Doložené pořizovací náklady jsou odečitatelné – uchovávejte každou fakturu.' },
  },
  {
    id: 'si',
    name: { en: 'Slovenia', sk: 'Slovinsko', cs: 'Slovinsko' },
    flag: '🇸🇮',
    gainTax: { en: 'No tax on private disposal gains (business trading is taxed)', sk: 'Súkromné zisky z predaja sa nezdaňujú (podnikateľské obchodovanie áno)', cs: 'Soukromé zisky z prodeje se nedaní (podnikatelské obchodování ano)' },
    exemption: { en: 'Private gains are not taxed; a proposed 25% tax was withdrawn in 2025', sk: 'Súkromné zisky sú bez dane; navrhovaná 25 % daň bola v roku 2025 stiahnutá', cs: 'Soukromé zisky jsou bez daně; navrhovaná 25% daň byla v roce 2025 stažena' },
    filing: { en: 'None for private gains; business and mining income in the annual return', sk: 'Pri súkromných ziskoch žiadne; podnikateľské príjmy a ťažba v ročnom priznaní', cs: 'U soukromých zisků žádné; podnikatelské příjmy a těžba v ročním přiznání' },
    note: { en: 'Mining is taxed as other income. Frequent trading can count as a business activity.', sk: 'Ťažba sa zdaňuje ako iný príjem. Časté obchodovanie môže byť podnikaním.', cs: 'Těžba se daní jako jiný příjem. Časté obchodování může být podnikáním.' },
  },
  {
    id: 'hr',
    name: { en: 'Croatia', sk: 'Chorvátsko', cs: 'Chorvatsko' },
    flag: '🇭🇷',
    gainTax: { en: '12% on crypto gains (since 2024)', sk: '12 % zo ziskov z kryptomien (od roku 2024)', cs: '12 % ze zisků z kryptoměn (od roku 2024)' },
    exemption: { en: 'Tax-free after a 2-year holding period', sk: 'Bez dane po 2 rokoch držby', cs: 'Bez daně po 2 letech držení' },
    filing: { en: 'JOPPD form by the end of February (not the annual return)', sk: 'Formulár JOPPD do konca februára (nie ročné priznanie)', cs: 'Formulář JOPPD do konce února (ne roční přiznání)' },
    note: { en: 'File JOPPD even for exempt sales. Losses offset gains only within the same year.', sk: 'JOPPD podajte aj pri oslobodených predajoch. Straty sa započítavajú len v rámci toho istého roka.', cs: 'JOPPD podejte i u osvobozených prodejů. Ztráty se započítávají jen v rámci téhož roku.' },
  },
  {
    id: 'ro',
    name: { en: 'Romania', sk: 'Rumunsko', cs: 'Rumunsko' },
    flag: '🇷🇴',
    gainTax: { en: '16% income tax on crypto gains (10% until 2025)', sk: '16 % daň z príjmov zo ziskov z kryptomien (do 2025: 10 %)', cs: '16 % daň z příjmů ze zisků z kryptoměn (do 2025: 10 %)' },
    exemption: { en: 'No holding-period exemption', sk: 'Bez oslobodenia podľa doby držania', cs: 'Bez osvobození podle doby držení' },
    filing: { en: 'Annual return (income from other sources)', sk: 'Ročné priznanie (príjem z iných zdrojov)', cs: 'Roční přiznání (příjem z jiných zdrojů)' },
    note: { en: 'The rate rose from 10% to 16% for gains from 2026. Gains under 200 lei per transaction are exempt up to 600 lei a year.', sk: 'Sadzba pre zisky od roku 2026 stúpla z 10 % na 16 %. Zisky pod 200 lei za transakciu sú oslobodené do 600 lei ročne.', cs: 'Sazba pro zisky od roku 2026 vzrostla z 10 % na 16 %. Zisky pod 200 lei za transakci jsou osvobozené do 600 lei ročně.' },
  },
  {
    id: 'bg',
    name: { en: 'Bulgaria', sk: 'Bulharsko', cs: 'Bulharsko' },
    flag: '🇧🇬',
    gainTax: { en: '10 % flat tax on gains', sk: '10 % jednotná daň zo zisku', cs: '10 % jednotná daň ze zisku' },
    exemption: { en: 'No holding-period exemption', sk: 'Bez oslobodenia podľa doby držania', cs: 'Bez osvobození podle doby držení' },
    filing: { en: 'Annual tax return', sk: 'Ročné daňové priznanie', cs: 'Roční daňové přiznání' },
    note: { en: 'Low flat rate; keep exchange statements for audit-ready records.', sk: 'Nízka jednotná sadzba; uchovávajte si výpisy z burzy pre prípadnú kontrolu.', cs: 'Nízká jednotná sazba; uchovávejte si výpisy z burzy pro případnou kontrolu.' },
  },
  {
    id: 'nl',
    name: { en: 'Netherlands', sk: 'Holandsko', cs: 'Nizozemsko' },
    flag: '🇳🇱',
    gainTax: { en: 'Box 3 wealth tax on deemed return (~36 % on fictional yield)', sk: 'Majetková daň Box 3 z predpokladaného výnosu (~36 % z fiktívneho výnosu)', cs: 'Majetková daň Box 3 z předpokládaného výnosu (~36 % z fiktivního výnosu)' },
    exemption: { en: 'Tax-free allowance (€59,357 per person, 2026)', sk: 'Nezdaniteľná časť (59 357 € na osobu, 2026)', cs: 'Nezdanitelná část (59 357 € na osobu, 2026)' },
    filing: { en: 'Annual Box 3 declaration', sk: 'Ročné priznanie Box 3', cs: 'Roční přiznání Box 3' },
    note: { en: 'No capital-gains tax per se – you are taxed on assumed return of your holdings. Box 3 is under reform – verify the current year’s rules.', sk: 'Neexistuje priama daň z kapitálových výnosov – zdaňuje sa predpokladaný výnos z vášho majetku. Box 3 prechádza reformou – overte si aktuálne pravidlá pre daný rok.', cs: 'Neexistuje přímá daň z kapitálových výnosů – zdaňuje se předpokládaný výnos z vašeho majetku. Box 3 prochází reformou – ověřte si aktuální pravidla pro daný rok.' },
  },
  {
    id: 'fr',
    name: { en: 'France', sk: 'Francúzsko', cs: 'Francie' },
    flag: '🇫🇷',
    gainTax: { en: '31.4% flat tax (PFU: 12.8% income tax + 18.6% social charges, 2026)', sk: '31,4 % paušálna daň (PFU: 12,8 % daň z príjmov + 18,6 % sociálne odvody, 2026)', cs: '31,4 % paušální daň (PFU: 12,8 % daň z příjmů + 18,6 % sociální odvody, 2026)' },
    exemption: { en: 'No holding-period exemption; total disposals up to €305 a year are exempt', sk: 'Bez oslobodenia podľa doby držania; predaje spolu do 305 € ročne sú oslobodené', cs: 'Bez osvobození podle doby držení; prodeje celkem do 305 € ročně jsou osvobozené' },
    filing: { en: 'Annual return with form 2086; foreign accounts on form 3916-bis', sk: 'Ročné priznanie s formulárom 2086; zahraničné účty na formulári 3916-bis', cs: 'Roční přiznání s formulářem 2086; zahraniční účty na formuláři 3916-bis' },
    note: { en: 'Crypto-to-crypto swaps are not taxed: only sales for euros, goods or services are.', sk: 'Výmeny krypto-krypto sa nezdaňujú: zdaňuje sa len predaj za eurá, tovar alebo služby.', cs: 'Výměny krypto-krypto se nedaní: daní se jen prodej za eura, zboží nebo služby.' },
  },
  {
    id: 'es',
    name: { en: 'Spain', sk: 'Španielsko', cs: 'Španělsko' },
    flag: '🇪🇸',
    gainTax: { en: '19–30% progressive tax on savings income', sk: '19–30 % progresívna daň z kapitálových príjmov', cs: '19–30 % progresivní daň z kapitálových příjmů' },
    exemption: { en: 'No holding-period exemption', sk: 'Bez oslobodenia podľa doby držania', cs: 'Bez osvobození podle doby držení' },
    filing: { en: 'Annual IRPF return; Modelo 721 for crypto held abroad over €50,000', sk: 'Ročné priznanie IRPF; Modelo 721 pre krypto v zahraničí nad 50 000 €', cs: 'Roční přiznání IRPF; Modelo 721 pro krypto v zahraničí nad 50 000 €' },
    note: { en: 'Crypto-to-crypto swaps are taxable disposals – use FIFO for identical coins.', sk: 'Výmeny krypto-krypto sú zdaniteľné prevody – pre rovnaké mince použite FIFO.', cs: 'Výměny krypto-krypto jsou zdanitelné převody – pro stejné mince použijte FIFO.' },
  },
];

// ── Inheritance readiness ────────────────────────────────────

export interface ChecklistItem {
  id: string;
  question: LocalizedText;
  detail: LocalizedText;
  points: number;
  action: LocalizedText;
}

export const INHERITANCE_CHECKLIST: ChecklistItem[] = [
  {
    id: 'letter',
    question: { en: 'Do your heirs have written instructions (a "letter of instruction")?', sk: 'Majú vaši dedičia písomné pokyny („list s pokynmi")?', cs: 'Mají vaši dědicové písemné pokyny („dopis s pokyny")?' },
    detail: { en: 'A document that says what exists, where things are, and what to do – without containing any seed words itself.', sk: 'Dokument, ktorý hovorí, čo existuje, kde sa to nachádza a čo robiť – bez toho, aby sám obsahoval seed frázu.', cs: 'Dokument, který říká, co existuje, kde se to nachází a co dělat – aniž by sám obsahoval seed frázi.' },
    points: 20,
    action: { en: 'Write a letter of instruction: inventory, locations, contacts – never seed phrases. Store it with your will or attorney.', sk: 'Napíšte list s pokynmi: zoznam, umiestnenia, kontakty – nikdy nie seed frázy. Uložte ho spolu so závetom alebo u právnika.', cs: 'Napište dopis s pokyny: seznam, umístění, kontakty – nikdy ne seed fráze. Uložte ho spolu se závětí nebo u právníka.' },
  },
  {
    id: 'separation',
    question: { en: 'Are your keys geographically separated?', sk: 'Sú vaše kľúče geograficky rozdelené?', cs: 'Jsou vaše klíče geograficky rozdělené?' },
    detail: { en: 'Never all backups in one home. Fire, theft or flood should never be able to destroy access.', sk: 'Nikdy nemajte všetky zálohy na jednom mieste. Požiar, krádež ani povodeň by nikdy nemali zničiť prístup.', cs: 'Nikdy nemějte všechny zálohy na jednom místě. Požár, krádež ani povodeň by nikdy neměly zničit přístup.' },
    points: 20,
    action: { en: 'Move one key/backup to a second location: bank vault, trusted family, or a professional key agent.', sk: 'Presuňte jeden kľúč/zálohu na druhé miesto: bankový trezor, dôveryhodná rodina alebo profesionálny správca kľúčov.', cs: 'Přesuňte jeden klíč/zálohu na druhé místo: bankovní trezor, důvěryhodná rodina nebo profesionální správce klíčů.' },
  },
  {
    id: 'heir-aware',
    question: { en: 'Does at least one heir know your bitcoin exists and where to start?', sk: 'Vie aspoň jeden dedič, že váš bitcoin existuje a kde začať?', cs: 'Ví alespoň jeden dědic, že váš bitcoin existuje a kde začít?' },
    detail: { en: 'Bitcoin discovered years late, or never, is the most common inheritance failure.', sk: 'Bitcoin objavený o roky neskôr, alebo vôbec, je najčastejšie zlyhanie dedičstva.', cs: 'Bitcoin objevený o roky později, nebo vůbec, je nejčastější selhání dědictví.' },
    points: 15,
    action: { en: 'Tell one trusted person the outline exists and who to contact. Full details only in the letter of instruction.', sk: 'Povedzte jednej dôveryhodnej osobe, že prehľad existuje a koho kontaktovať. Všetky detaily len v liste s pokynmi.', cs: 'Řekněte jedné důvěryhodné osobě, že přehled existuje a koho kontaktovat. Všechny detaily jen v dopise s pokyny.' },
  },
  {
    id: 'multisig',
    question: { en: 'Do you use multisig (2-of-3) instead of a single seed phrase?', sk: 'Používate multisig (2 z 3) namiesto jedinej seed frázy?', cs: 'Používáte multisig (2 ze 3) místo jediné seed fráze?' },
    detail: { en: 'A single seed is a single point of failure – for you and for your heirs.', sk: 'Jediná seed fráza je jediný bod zlyhania – pre vás aj pre vašich dedičov.', cs: 'Jediná seed fráze je jediný bod selhání – pro vás i pro vaše dědice.' },
    points: 20,
    action: { en: 'Upgrade to 2-of-3 multisig: you hold two keys, a partner (e.g. Unchained-style vault) or attorney holds one.', sk: 'Prejdite na multisig 2 z 3: dva kľúče držíte vy, jeden partner (napr. trezor v štýle Unchained) alebo právnik.', cs: 'Přejděte na multisig 2 ze 3: dva klíče držíte vy, jeden partner (např. trezor ve stylu Unchained) nebo právník.' },
  },
  {
    id: 'tested',
    question: { en: 'Have you tested recovery with a small amount?', sk: 'Otestovali ste obnovu na malej sume?', cs: 'Otestovali jste obnovu na malé částce?' },
    detail: { en: 'An untested inheritance procedure is a hypothesis, not a plan.', sk: 'Neotestovaný postup dedenia je hypotéza, nie plán.', cs: 'Netestovaný postup dědění je hypotéza, ne plán.' },
    points: 15,
    action: { en: 'Do a full recovery drill on a small UTXO, with your heir watching, once a year.', sk: 'Raz ročne urobte kompletnú skúšku obnovy na malom UTXO, za prítomnosti vášho dediča.', cs: 'Jednou ročně udělejte kompletní zkoušku obnovy na malém UTXO, za přítomnosti vašeho dědice.' },
  },
  {
    id: 'accounts',
    question: { en: 'Are exchange accounts, loans and automated plans documented?', sk: 'Sú účty na burzách, pôžičky a automatizované plány zdokumentované?', cs: 'Jsou účty na burzách, půjčky a automatizované plány zdokumentované?' },
    detail: { en: 'Custodial balances, bitcoin-backed loans and DCA bots die with forgotten logins.', sk: 'Kustodiálne zostatky, pôžičky kryté Bitcoinom a DCA boty zanikajú so zabudnutými prihláseniami.', cs: 'Kustodiální zůstatky, půjčky kryté Bitcoinem a DCA boti zanikají se zapomenutými přihlášeními.' },
    points: 15,
    action: { en: 'Maintain an inventory of platforms, account IDs and how balances should be claimed – inside your letter of instruction.', sk: 'Veďte si zoznam platforiem, identifikátorov účtov a postupu na uplatnenie zostatkov – v liste s pokynmi.', cs: 'Veďte si seznam platforem, identifikátorů účtů a postupu pro uplatnění zůstatků – v dopise s pokyny.' },
  },
];

export interface ScoreResult {
  score: number;
  max: number;
  tier: 'at-risk' | 'partial' | 'ready';
  label: string;
  missing: ChecklistItem[];
}

export function scoreInheritance(answered: Record<string, boolean>, lang: Lang = 'en'): ScoreResult {
  let score = 0;
  const missing: ChecklistItem[] = [];
  for (const item of INHERITANCE_CHECKLIST) {
    if (answered[item.id]) score += item.points;
    else missing.push(item);
  }
  const max = INHERITANCE_CHECKLIST.reduce((s, i) => s + i.points, 0);
  const tier = score < 40 ? 'at-risk' : score < 70 ? 'partial' : 'ready';
  const label =
    tier === 'at-risk'
      ? t(lang, 'At risk – coins may be lost', 'Rizikové – mince môžu byť stratené', 'Rizikové – mince mohou být ztraceny')
      : tier === 'partial'
        ? t(lang, 'Partially protected', 'Čiastočne chránené', 'Částečně chráněno')
        : t(lang, 'Inheritance-ready', 'Pripravené na dedenie', 'Připraveno na dědění');
  return { score, max, tier, label, missing };
}

export const MULTISIG_KEYS = [
  {
    id: 'A',
    holder: { en: 'You', sk: 'Vy', cs: 'Vy' },
    location: { en: 'Hardware wallet #1 · your home', sk: 'Hardvérová peňaženka #1 · váš domov', cs: 'Hardwarová peněženka #1 · váš domov' },
    share: { en: 'Key A', sk: 'Kľúč A', cs: 'Klíč A' },
  },
  {
    id: 'B',
    holder: { en: 'You', sk: 'Vy', cs: 'Vy' },
    location: { en: 'Hardware wallet #2 · bank vault / second location', sk: 'Hardvérová peňaženka #2 · bankový trezor / druhé miesto', cs: 'Hardwarová peněženka #2 · bankovní trezor / druhé místo' },
    share: { en: 'Key B', sk: 'Kľúč B', cs: 'Klíč B' },
  },
  {
    id: 'C',
    holder: { en: 'Partner / attorney', sk: 'Partner / právnik', cs: 'Partner / právník' },
    location: { en: 'Unchained-style vault service · releases on inheritance event', sk: 'Trezorová služba v štýle Unchained · uvoľní pri dedičskej udalosti', cs: 'Trezorová služba ve stylu Unchained · uvolní při dědické události' },
    share: { en: 'Key C', sk: 'Kľúč C', cs: 'Klíč C' },
  },
];

export const PARTNER_LINKS = {
  // Real plain company sites (no Virtuse affiliate/referral relationship
  // exists yet for either — neither is a featured partner anywhere on
  // virtuse.com, so these are placeholder links to the real companies,
  // not a claim of partnership). Verified live 2026-09-09.
  unchained: 'https://www.unchained.com/',
  // Was "Coinfirm" — coinfirm.com now redirects to lukka.tech; Coinfirm
  // appears to have been absorbed into Lukka and no longer exists as an
  // independent brand, so this page now names and links to Lukka
  // instead (per explicit user decision, 2026-09-09).
  lukka: 'https://lukka.tech/',
};
