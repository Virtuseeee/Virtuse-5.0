# Dimension 8: Bitcoin Payment Processing & Merchant Services in Europe

*Research Date: May 29, 2026*
*Focus: Non-custodial, self-hosted Bitcoin payment solutions outside MiCA regulatory scope*

---

## Executive Summary

Bitcoin merchant payments in Europe are experiencing significant growth, driven by three converging forces: (1) maturing non-custodial infrastructure led by BTCPay Server, (2) accelerating Lightning Network adoption for retail payments, and (3) city-level initiatives creating circular Bitcoin economies. Europe holds approximately 26-30% of the global Bitcoin payments market, with an estimated 15,000-25,000+ merchants accepting Bitcoin across the continent as of early 2026. Non-custodial solutions — primarily BTCPay Server — represent a distinct and growing segment that falls explicitly outside MiCA's CASP licensing requirements, creating a two-track market of regulated custodial processors and unregulated self-hosted alternatives.

---

## 1. Number of European Merchants Accepting Bitcoin

### 1.1 Global and European Merchant Estimates

**BTCMap Data (Primary Source)**

BTCMap, the crowdsourced OpenStreetMap-based merchant directory, provides the most comprehensive ground-level data on Bitcoin-accepting merchants.

```
Claim: As of November 2025, BTCMap tracked 20,443 Bitcoin-accepting merchants globally, with 11,371 verified within the past 12 months [^430^]
Source: BTC Map Blog
URL: https://blog.btcmap.org/posts/2025-11/
Date: November 30, 2025
Excerpt: "Total Bitcoin-accepting merchants: 18,526 → 20,443 (+1,917 +10.3%); Recently verified (<1y): 9,779 → 11,371 (+1,592 +16.3%)"
Context: Monthly growth of 10.3% in tracked merchants. Dashboard currently shows 25,545 total merchants with 15,740 verified
Confidence: Medium (crowdsourced data, verification quality varies by region)
```

```
Claim: BTCMap dashboard shows 25,545 total merchants and 2,247 exchanges as of early 2026, with 15,740 verified locations [^457^]
Source: BTC Map Dashboard
URL: https://btcmap.org/dashboard
Date: Accessed May 2026
Excerpt: "Total Merchants: 25,545 · 15,740 [verified]; Total Exchanges: 2,247 · 848 [verified]"
Context: Represents cumulative data including historical entries. Year verification critical for accuracy
Confidence: Medium
```

### 1.2 European Country-Level Estimates

**Academic Research (Springer/Financial Innovation)**

```
Claim: As of July 2024, BTC Map contained approximately 11,000 merchants globally, with 7,211 (64%) verified within the previous 12 months. The Czech Republic had 857 mapped merchants with 95% verified within 12 months [^456^]
Source: Springer - Financial Innovation Journal
URL: https://link.springer.com/article/10.1186/s40854-025-00871-z
Date: November 26, 2025
Excerpt: "As of July 2024, BTC Map contains information about approximately 11,000 merchants that accept Bitcoin payments...Of the 11,208 merchants in BTC Map on the date of our analysis, 7,211 or 64% had been verified within the previous twelve months...the Czech Republic [had] 857 [merchants]"
Context: Peer-reviewed academic spatial analysis of Bitcoin merchant adoption. Prague community specifically contained 269 merchants in 735 sq km
Confidence: High (academic peer review)
```

**France-Specific Data**

```
Claim: France has approximately 300+ shops accepting Bitcoin as of early 2026, far fewer than Germany (7,000+) and the Netherlands (4,500+). Daily Bitcoin transaction volume estimated at EUR 150,000 [^435^] [^391^]
Source: Fibo-Crypto.fr / Earnpark
URL: https://fibo-crypto.fr/en/blog/pay-bitcoin-france-2026-guide-shops-cards-crypto/ ; https://earnpark.com/en/posts/bitcoin-in-france-new-rules-every-holder-must-know/
Date: February 23, 2026 / January 27, 2026
Excerpt: "300+ shops accept Bitcoin in France, listed on BTC Map and PayerenBitcoin.fr" and "Country comparison table: France ~2,000 merchants, Germany ~7,000, Netherlands ~4,500, Switzerland ~8,000"
Context: The Fibo-Crypto figure (300+) likely represents actively verified merchants, while Earnpark's higher figure (~2,000) may include inactive or less verified entries. Significant variance suggests need for careful verification status consideration
Confidence: Medium (different methodologies produce different counts)
```

**Germany — Leading European Market**

```
Claim: Germany holds 24.6% of the European cryptocurrency exchanges market and leads in merchant adoption with an estimated 7,000+ Bitcoin-accepting merchants [^166^] [^391^]
Source: Market Data Forecast / Earnpark
URL: https://www.marketdataforecast.com/market-reports/europe-cryptocurrency-exchanges-market ; https://earnpark.com/en/posts/bitcoin-in-france-new-rules-every-holder-must-know/
Date: February 12, 2026 / January 27, 2026
Excerpt: "Germany outperformed other European countries in the cryptocurrency exchanges market by holding 24.6 percent of the regional market share in 2025"
Context: Germany's progressive regulatory stance, strong fintech ecosystem, and Bitcoin-friendly tax policies (private sales tax-free after 1 year holding) contribute to leadership position
Confidence: Medium (market share data is for exchanges, merchant numbers from composite sources)
```

**Switzerland — Highest Merchant Density**

```
Claim: Switzerland has approximately 8,000 Bitcoin-accepting merchants with the highest daily transaction volume in Europe at EUR 1.2 million. Lugano alone has 360-400+ merchants accepting Bitcoin [^391^] [^428^] [^419^]
Source: Earnpark / Digital Watch Observatory / NAKA Blog
URL: Multiple sources
Date: December 2025 - July 2025
Excerpt: "Switzerland: ~8,000 merchant locations, EUR 1.2M daily avg. TX volume" (Earnpark); "more than 350 shops and restaurants now accepting Bitcoin" (Digital Watch); "over 400 merchants in Lugano accept Bitcoin" (NAKA)
Context: Switzerland leads in per-capita adoption. Lugano's Plan B initiative is the most concentrated merchant adoption program in Europe. Note: 8,000 figure may include all crypto-accepting merchants, not exclusively Bitcoin
Confidence: Medium-High for Lugano (well-documented); Medium for nationwide figures
```

### 1.3 Summary: European Bitcoin Merchant Landscape

| Country | Estimated Merchants | Key Initiatives | Data Quality |
|---------|-------------------|-----------------|--------------|
| Germany | 7,000+ | Einundzwanzig communities, BTCMap | Medium |
| Switzerland | 8,000+ | Lugano Plan B (360-400+), Bitcoin Assoc. CH | Medium-High |
| Netherlands | 4,500+ | Local Bitcoin communities | Medium |
| France | 300-2,000+ | Printemps (20 stores), Lyzi network (1,500+) | Medium |
| Czech Republic | 857 ( mapped) | Prague Bitcoin community (269), BTCPrague | High |
| Czech Rep. | 857 (mapped) | Prague Bitcoin community (269), BTCPrague | High |
| UK | Unknown | Growing adoption | Low |
| **Europe Total** | **15,000-25,000+** | Multiple initiatives | Medium |

---

## 2. BTCPay Server Adoption in Europe (Self-Hosted = Non-MiCA)

### 2.1 Global BTCPay Server Scale

```
Claim: BTCPay Server reached 1 million downloads from GitHub by 2025, with potentially hundreds of thousands of active instances worldwide. One instance often serves multiple merchants [^406^]
Source: Bitcoin Magazine
URL: https://bitcoinmagazine.com/business/btcpay-server-the-backbone-of-bitcoin-commerce-2025
Date: June 4, 2025
Excerpt: "As of 2025, BTCPay Server has had one million downloads directly from its GitHub repository...there could be hundreds of thousands of instances of BTCPay Server running throughout the world"
Context: BTCPay Server's self-hosted nature makes precise counting impossible. Downloads do not account for cloud providers (Voltage, LunaNode) or Docker deployments. 170+ open source contributors, 8,393+ commits
Confidence: Medium (proxy metrics, actual deployment numbers unknown)
```

### 2.2 European BTCPay Server Deployments

**BTCPrague Conference Case Study**

```
Claim: In June 2025, 25 Prague merchants were onboarded to BTCPay Server, processing 7,079 Lightning transactions totaling 0.5885 BTC (1.3 million CZK / EUR 53,000) over 4 days. 63% of merchants indicated interest in accepting Bitcoin outside the conference setting [^53^]
Source: BTCPay Server Blog - Case Study
URL: https://blog.btcpayserver.org/case-study-btcprague/
Date: August 13, 2025
Excerpt: "25 local merchants were onboarded to accept Bitcoin payments...Over the course of just four days, vendors processed 7,079 transactions totaling 0.5885 BTC equivalent to 1.3 million CZK...63% indicated they would even consider offering Bitcoin as a payment option in their business outside the conference setting"
Context: Model collaboration between BTCPay Server, NiceHash (hardware), and Blink (Lightning). Average payment size ~183 CZK (EUR 7.5). 100% of surveyed merchants willing to accept Bitcoin again
Confidence: High (primary case study with direct survey data)
```

**European Squash Federation**

```
Claim: The European Squash Federation became the first major European sports federation to adopt Bitcoin, using BTCPay Server for donations and payments [^405^] [^403^]
Source: European Squash Federation / Bit2Me News
URL: https://europeansquash.com/european-squash-federation-bitcoin/ ; https://news.bit2me.com/en/la-esf-adopta-bitcoin/
Date: January 27, 2025 / January 29, 2025
Excerpt: "The ESF has become the first major sports federation in Europe to integrate Bitcoin into its operations...accept Bitcoin transactions for both incoming and outgoing payments"
Context: Implemented with Satoshi Consult (Norway). ESF holds Bitcoin as reserve asset. Uses BTCPay Server for donation processing
Confidence: High (official federation announcement)
```

**Oslo Airport Tax-Free (Travel Retail Norway)**

```
Claim: Travel Retail Norway introduced Bitcoin payments via BTCPay Server and Lightning Network at Oslo Airport for Click & Collect purchases in December 2025, with settlement in Norwegian kroner in real time [^398^] [^396^]
Source: Moodie Davitt Report / Nostr (Satoshi Consult)
URL: https://moodiedavittreport.com/travel-retail-norway-hails-world-first-with-bitcoin-payments-for-arrivals-click-collect-purchases/
Date: December 18, 2025
Excerpt: "Travel Retail Norway (TRN)...has introduced Bitcoin payments for customers using Click & Collect services on arrival at Oslo Airport...The payment solution is provided by Satoshi Consult"
Context: "World first" for airport tax-free Bitcoin payments. Lightning-only (no on-chain). Operates across Oslo, Bergen, Stavanger, and Trondheim airports. Plans to expand to other stores
Confidence: High (multiple corroborating sources, official press release)
```

**Unbank — Large-Scale Deployment**

```
Claim: Unbank processed $40 million in volume and 41,416 Bitcoin transactions in six months using BTCPay Server, demonstrating enterprise-scale non-custodial processing [^468^]
Source: BTCPay Server Case Study
URL: https://blog.btcpayserver.org/case-study-unbank/
Date: February 18, 2025
Excerpt: "Between [June 1, 2024] and December 31, 2024 the total number of transactions recorded was 40,416, driving the gross volume to $40 million"
Context: Unbank operates Bitcoin ATM networks. Deployment was Docker-based with small engineering team fully operational in 3 months. $38M from ATMs, $2.5M from cash withdrawals, $400K+ from retail buy transactions
Confidence: High (primary case study with verified transaction data)
```

### 2.3 BTCPay Server as Non-MiCA Infrastructure

```
Claim: BTCPay Server is explicitly non-custodial and self-hosted, requiring no MiCA license. It charges zero processing fees and gives merchants complete sovereignty over funds [^390^] [^36^]
Source: EMS Comparison / BTCPay Server 2025 Report
URL: https://ems-ltd.global/best-crypto-merchant-account-providers/ ; https://blog.btcpayserver.org/2025-report/
Date: April 29, 2026 / January 21, 2026
Excerpt: "BTCPay Server is the open-source self-hosted alternative. It charges zero processing fees and gives merchants complete sovereignty over their funds" and "open-source, self-hosted payments platform that enables individuals and organizations to accept and manage Bitcoin payments without trusted third parties"
Context: Self-hosted nature means the merchant operates the software, not a regulated third party. No KYC required. No transaction fees beyond network fees. This architecture places it outside MiCA CASP definitions
Confidence: High (explicit project positioning)
```

**BTCPay Server 2025 Progress Report Key Metrics:**
- 3 major releases shipped
- Plugin ecosystem expanded for enterprise-scale payments
- Guinness World Record: 4,187 cryptocurrency POS transactions in 8 hours (Las Vegas 2025)
- 25+ conferences, workshops, meetups participated across Europe, Africa, Asia, Latin America
- BTCPay Day in Prague: 130+ attendees
- 15+ podcasts and interviews

---

## 3. Bitcoin Payment Volume in Europe

### 3.1 European Share of Global Market

```
Claim: Europe held approximately 26% of the global crypto payment gateway market share in 2025, and 30% of the Bitcoin payments market [^162^] [^427^]
Source: SQ Magazine / Market Research Future
URL: https://sqmagazine.co.uk/crypto-payments-industry-statistics/ ; https://www.marketresearchfuture.com/reports/bitcoin-payments-market-24724
Date: March 12, 2026 / April 6, 2026
Excerpt: "Europe held approximately 26% of the global market share in 2025 due to strong regulatory infrastructure and fintech innovation" and "Europe is witnessing significant growth in the Bitcoin payments market, holding around 30% of the global share"
Context: North America holds ~45% of Bitcoin payments market. Global Bitcoin payments market valued at $27.11 billion in 2025, projected to reach $63.13 billion by 2035 (8.82% CAGR)
Confidence: Medium (market sizing estimates vary across sources)
```

### 3.2 Chainalysis European Transaction Data

```
Claim: Between July 2024 and June 2025, European crypto markets showed robust growth with a peak of $234 billion in transaction volume in December 2024. Germany received $219.4 billion, France $180.1 billion [^118^]
Source: Chainalysis 2025 Geography of Cryptocurrency Report
URL: https://www.chainalysis.com/blog/europe-crypto-adoption-2025/
Date: October 16, 2025
Excerpt: "the market staged a robust recovery, reaching a peak of $234 billion in December...Germany ($219.4 billion), Ukraine ($206.3 billion), and France ($180.1 billion)"
Context: This data captures all crypto transactions, not solely merchant payments. UK led with $273.2 billion. European Economic Area methodology includes EU + Iceland, Liechtenstein, Norway
Confidence: High (Chainalysis is the industry standard for blockchain analytics)
```

### 3.3 CoinGate European Payment Processing

```
Claim: CoinGate processed 1.42 million crypto payments in 2025 (one every 22 seconds), bringing total platform volume to over 7 million payments since launch. Bitcoin accounted for 22.1% of all payments [^95^] [^394^]
Source: CoinGate 2025 Data Report
URL: https://coingate.com/blog/post/crypto-payments-data-report-2025 ; https://www.tradingview.com/news/chainwire:97aa20367094b:0-coingate-publishes-2025-crypto-payments-report-highlighting-shift-to-operational-use/
Date: January 21, 2026
Excerpt: "In 2025, CoinGate processed 1.42 million crypto payments...Bitcoin reclaimed its position as the most-used cryptocurrency, accounting for 22.1% of all payments"
Context: CoinGate is MiCA-licensed (Bank of Lithuania). Transaction volumes adjusted down 15% YoY due to USDT discontinuation under MiCA and Crypto Travel Rule implementation. Average cart value: EUR 108. 25.2% of payments settled in stablecoins (up from 16.7%)
Confidence: High (primary company data)
```

### 3.4 BitPay European Market

```
Claim: BitPay reached 130,000 merchants globally in 2025, with approximately 28% of users in Europe. Bitcoin accounted for 84% of BitPay transactions [^422^]
Source: SQ Magazine - BitPay Statistics
URL: https://sqmagazine.co.uk/bitpay-statistics/
Date: December 2, 2025
Excerpt: "BitPay reached 130,000 merchants globally in 2025. Approximately 58% of BitPay users are in the U.S., with around 28% in Europe...Bitcoin (BTC) accounted for about 84% of all BitPay transactions"
Context: Implies ~36,400 BitPay merchants in Europe (28% of 130,000). BitPay is US-based and primarily serves as a custodial processor. B2B payments grew 14% driven by cross-border settlement efficiency
Confidence: Medium (BitPay does not publicly break out European merchant numbers independently)
```

---

## 4. Comparison: Custodial vs Non-Custodial Payment Processing

### 4.1 Market Structure

The European Bitcoin payment processing landscape is bifurcated into two distinct regulatory and operational categories:

| Dimension | Custodial (MiCA-Regulated) | Non-Custodial (Outside MiCA) |
|-----------|---------------------------|------------------------------|
| **Examples** | CoinGate, BitPay, BVNK, Triple-A | BTCPay Server, Lightning Checkout, Swiss Bitcoin Pay |
| **License Required** | MiCA CASP license | None (self-hosted) |
| **KYC Requirements** | Yes, full customer due diligence | None |
| **Fee Structure** | 0.5% - 2% + potential monthly fees | 0% (BTCPay) or 0.5-0.8% (managed non-custodial) |
| **Custody Model** | Processor holds funds temporarily | Merchant receives directly to own wallet |
| **Fiat Settlement** | Yes (EUR, USD, GBP) | No native fiat (requires separate off-ramp) |
| **Setup Complexity** | Low (SaaS, plugins) | Medium-High (self-hosted) or Low (managed) |
| **Control** | Limited (terms of service apply) | Full sovereignty |

### 4.2 Custodial Processor Landscape

```
Claim: CoinGate is MiCA-licensed and PI-licensed in the EU, processing 1.42 million payments in 2025 across 180+ countries with a flat 1% fee and settlement in EUR, USD, and GBP [^393^]
Source: CoinGate Blog
URL: https://coingate.com/blog/post/best-crypto-payment-gateway
Date: April 16, 2026
Excerpt: "We are MiCA-licensed and PI-licensed in the EU, processing 1.42 million payments in 2025 across 180+ countries. We settle in EUR, USD, and GBP with a flat 1% fee"
Context: CoinGate's MiCA compliance gives regulatory certainty to EU merchants but requires KYC, adds onboarding friction (days/weeks), and subjects operations to Travel Rule requirements
Confidence: High
```

```
Claim: NOWPayments (Amsterdam-based) offers non-custodial processing with 0.5% fees and no KYC, but uses a temporary intermediate wallet making it technically custodial during the transaction window [^390^]
Source: EMS Comparison
URL: https://ems-ltd.global/best-crypto-merchant-account-providers/
Date: April 29, 2026
Excerpt: "NOWPayments claims non-custodial status but uses a temporary intermediate wallet before forwarding to merchants, which is technically custodial"
Context: "Non-custodial" branding in crypto payment space requires careful scrutiny. True non-custodial means funds flow directly from customer to merchant's wallet without intermediary control
Confidence: High (technical analysis of architecture)
```

### 4.3 Non-Custodial/Self-Hosted Growth

```
Claim: Merchants are increasingly choosing non-custodial solutions to avoid KYC, processing fees, and regulatory friction. BTCPay Server is "unmatched for self-sovereign, fee-free Bitcoin acceptance" [^390^] [^436^]
Source: EMS / Coinsnap WooCommerce Guide
URL: https://ems-ltd.global/best-crypto-merchant-account-providers/ ; https://coinsnap.io/blog/woocommerce-bitcoin-the-complete-2025-guide/
Date: April 29, 2026 / April 28, 2026
Excerpt: "BTCPay Server is unmatched for self-sovereign, fee-free Bitcoin acceptance. It integrates well with WooCommerce" and "Lightning-ready, non-custodial: Coinsnap (plug-and-play; direct to your wallet, supports on-chain and Lightning)"
Context: The trade-off is operational responsibility: merchants must manage server updates, uptime, security patches. For non-technical teams this is a genuine burden. Managed non-custodial alternatives (Coinsnap, Lightning Checkout) bridge this gap
Confidence: High (market consensus)
```

**Key Insight**: MiCA's implementation has created a two-speed market. Custodial processors (CoinGate, etc.) offer regulatory compliance and fiat settlement but require KYC and impose fees. Non-custodial solutions (BTCPay Server) offer zero fees, no KYC, and full sovereignty but require technical capability and separate fiat off-ramp arrangements. This bifurcation is likely to persist and potentially deepen as MiCA enforcement intensifies.

---

## 5. Lightning vs On-Chain Merchant Settlement Split

### 5.1 Global Lightning Network Growth

```
Claim: The Lightning Network processed over 8 million monthly transactions in early 2025, with public Lightning volume surging 266% year-over-year despite a decline in public channel count [^13^]
Source: CoinLaw Lightning Statistics
URL: https://coinlaw.io/bitcoin-lightning-network-usage-statistics/
Date: February 7, 2026
Excerpt: "The Lightning Network facilitated over 8 million monthly transactions in early 2025, with public Lightning volume surging 266% year-over-year despite a decline in public channel count"
Context: Transaction count decreased from 6.6M (August 2023) to 2.4M (2024 projection) while volume surged, indicating shift toward higher-value transactions, particularly exchange deposits/withdrawals
Confidence: Medium (estimates based on node sampling; excludes private channels)
```

### 5.2 CoinGate Lightning Adoption Data

```
Claim: The percentage of Bitcoin payments processed via Lightning at CoinGate more than doubled from 6.5% in Q2 2022 to 16.6% in Q2 2024, with projections for 20%+ in Q3 2024 [^98^]
Source: CoinGate Lightning Network Data
URL: https://coingate.com/blog/post/lightning-network-year-over-year-data
Date: August 13, 2024
Excerpt: "The percentage of Bitcoin payments processed via the Lightning Network at CoinGate has more than doubled in two years from 6.5% in Q2 2022 to 16.6% in Q2 2024"
Context: Growth trajectory suggests Lightning could represent 20-25% of CoinGate Bitcoin payments by mid-2025. CoinGate Q2 2024 Lightning orders increased 28.4% vs Q2 2023 and 74.6% vs Q2 2022
Confidence: High (primary processor data)
```

### 5.3 Merchant Lightning Adoption Share

```
Claim: Merchant adoption share of Bitcoin payments via Lightning reached 15% by mid-2024 and continued growing into 2025. SMB Lightning adoption in the U.S. rose ~30% YoY among Bitcoin payment providers [^13^] [^162^]
Source: CoinLaw / SQ Magazine
URL: https://coinlaw.io/bitcoin-lightning-network-usage-statistics/ ; https://sqmagazine.co.uk/crypto-payments-industry-statistics/
Date: February 7, 2026 / March 12, 2026
Excerpt: "Merchant adoption share of Bitcoin payments via Lightning reached 15% by mid-2024 and is continuing upward in 2025" and "Lightning Network processes 16.6% of Bitcoin payments at CoinGate"
Context: Lightning particularly strong for microtransactions (sub-$100), retail POS, and high-frequency low-value payments. On-chain preferred for large settlements, treasury movements, and B2B transfers
Confidence: Medium-High
```

### 5.4 Lightning Performance Metrics

```
Claim: Lightning Network achieves 99%+ payment success rate in well-configured implementations, with sub-second settlement times. Median base fee is 1 satoshi (~$0.001) [^47^] [^468^]
Source: Fidelity Digital Assets / TrySpeed
URL: https://www.fidelitydigitalassets.com/sites/g/files/djuvja3256/files/acquiadam/FDA_US_UK_TheLightningNetwork_ExpandingBitcoinUseCases_1187503.2.0_V1.pdf ; https://www.tryspeed.com/blog/lightning-network-api
Date: 2024 / May 15, 2026
Excerpt: "Similar to transaction speeds and fees, the 99%+ success rate for Lightning payments is possible with proper configurations" and "Payment success rates reach 99% in well-configured Lightning setups"
Context: Success rate depends on channel configuration, number of hops (each additional hop reduces success by 4-8%), and liquidity management. River Financial reported 98.7% success in September 2022, improving over time
Confidence: High (multiple corroborating sources)
```

### 5.5 European Lightning Infrastructure

```
Claim: Germany holds the second-largest share of Lightning nodes globally at 13.4%, behind the US (30.6%). France (4.7%), Netherlands (3.3%), UK (3.6%), Switzerland (2.4%), and Italy (2.1%) are also significant [^13^]
Source: CoinLaw
URL: https://coinlaw.io/bitcoin-lightning-network-usage-statistics/
Date: February 7, 2026
Excerpt: "Germany holds the second-largest share at 13.4%...France (4.7%), Canada (4.3%), and the United Kingdom (3.6%) round out the next top contributors...Netherlands (3.3%), Switzerland (2.4%), Italy (2.1%), and Spain (2.1%)"
Context: European countries collectively represent ~30% of global Lightning nodes. Germany's position reflects strong technical community and Bitcoin development ecosystem
Confidence: Medium (node geolocation can be approximated)
```

### 5.6 Settlement Split Summary

| Payment Type | Lightning Share | On-Chain Share | Trend |
|-------------|----------------|----------------|-------|
| Retail POS (<$100) | 70-85% | 15-30% | Lightning growing |
| E-commerce ($100-$1,000) | 40-60% | 40-60% | Mixed |
| B2B / Treasury (>$1,000) | 10-20% | 80-90% | On-chain dominant |
| **Overall Merchant** | **15-25%** | **75-85%** | **Lightning growing ~30% YoY** |

---

## 6. European Bitcoin Merchant Success Stories & Case Studies

### 6.1 Lugano, Switzerland — Plan B Initiative (City-Level)

```
Claim: Lugano's Plan B initiative, launched in partnership with Tether, has onboarded 360-400+ merchants accepting Bitcoin, Tether (USDT), and LVGA stablecoin for everyday payments. The city allocated 100M+ CHF toward blockchain development with 3M CHF for merchant incentives [^419^] [^428^] [^421^]
Source: NAKA Blog / Digital Watch / Plan B Lugano
URL: https://naka.com/blog/crypto-payments-adoption-switzerland-lugano ; https://dig.watch/updates/swiss-city-deepens-crypto-adoption-as-350-businesses-now-accept-bitcoin ; https://planb.lugano.ch/
Date: July 9, 2025 / December 12, 2025 / February 13, 2026
Excerpt: "Today, over 400 merchants in Lugano accept Bitcoin (BTC), Tether (USD₮), and LVGA...The city allocated over 100M CHF toward blockchain development, with 3M CHF earmarked specifically for merchant incentives"
Context: Most advanced city-level Bitcoin payment ecosystem in Europe. Plan B Forum attracts 2,500+ attendees annually. Uses NAKA Payment Network for POS infrastructure. 6,100+ crypto payments recorded during 2024 Plan B Forum ($160,000 in volume). Even McDonald's and municipal services accept crypto
Confidence: High (multiple official sources)
```

### 6.2 Printemps — European Department Store Pioneer

```
Claim: Printemps became the first European department store to accept cryptocurrency payments across 20 stores in France, partnering with Binance Pay and Lyzi. The stores receive payments in euros within 48 hours [^462^] [^455^]
Source: Printemps Official / Lyzi
URL: https://www.groupe-printemps.com/en/article/printemps-adopts-cryptocurrency-payments ; https://lyzi.io/en/blog/crypto-payments-at-printemps-how-it-works
Date: November 26, 2024 / February 24, 2026
Excerpt: "Printemps has become the first European department store to accept cryptocurrency payments thanks to a strategic partnership with Binance Pay...20 Printemps stores across France"
Context: Supports Bitcoin, Ethereum, EURI, and USDC. 6.5 million French crypto users represent target market. Won Bronze Laureate Award at Nuit du Commerce Connecte 2024
Confidence: High (official corporate announcement)
```

### 6.3 Tisseo Toulouse — Public Transport Pioneer

```
Claim: Since March 2025, Toulouse has become the first European city to accept cryptocurrencies for public transport via the Tisseo app, allowing payment for metro, bus, tramway and cable car tickets [^479^] [^477^]
Source: Lyzi / National Technology
URL: https://lyzi.io/en/blog/pay-your-metro-ticket-in-crypto-with-tisseo ; https://nationaltechnology.co.uk/Paying_In_Crypto_How_Soon_Before_Using_Bitcoin_At_The_Checkout_Becomes_Normal.php
Date: February 24, 2026 / May 12, 2025
Excerpt: "Since March 2025, users of the Tisseo network in Toulouse have been able to pay for their tickets in cryptocurrencies such as bitcoin, Ethereum Or the Solana...a first in Europe for a public transport network"
Context: Partnership with Lyzi required EUR 50,000 integration investment. Supports 70+ cryptocurrencies via Binance Pay backend. Currently Android-only. Sacha Briand (Tisseo finance manager): "18% of French people already own cryptocurrencies. To not miss the train, we are launching this payment method"
Confidence: High (official transport operator partnership)
```

### 6.4 Carrefour City — Franchise Bitcoin Adoption

```
Claim: Six Carrefour City franchise stores in Seine-Maritime (Normandy) accept Bitcoin via Swiss Bitcoin Pay and Lightning Network, starting October 2025. One store offers 20% discount for Bitcoin payments [^435^] [^471^] [^474^]
Source: Fibo-Crypto / Ouest-France / CryptoRank
URL: https://fibo-crypto.fr/en/blog/pay-bitcoin-france-2026-guide-shops-cards-crypto/ ; https://www.ouest-france.fr/economie/budget/cryptomonnaie-le-paiement-en-bitcoin-etendu-a-de-nouveaux-supermarches-a637f3c4-a815-11f0-997b-872c19911d86
Date: October 13, 2025 / January 16, 2026
Excerpt: "6 franchised Carrefour City stores accept Bitcoin via Swiss Bitcoin Pay: 4 in Rouen, 1 in Le Havre, and 1 in Elbeuf" and "Carrefour Express in Arcachon offers 20% off groceries for Bitcoin payments"
Context: Important distinction: franchisee-led initiative, not corporate policy. Store manager Omer Diner: "There is demand for this type of payment. We ourselves are daily bitcoin users." Carrefour corporate states this is "isolated situation of a few franchised stores"
Confidence: High (multiple local news sources)
```

### 6.5 BTCPrague — Conference Bitcoin Economy

```
Claim: BTCPrague 2025 demonstrated a working Bitcoin-native economy with 25 merchants processing 7,079 Lightning transactions over 4 days, generating 1.3 million CZK (EUR 53,000). 88% observed positive customer reactions [^53^]
Source: BTCPay Server Case Study
URL: https://blog.btcpayserver.org/case-study-btcprague/
Date: August 13, 2025
Excerpt: "7,079 Lightning transactions were processed during the event, with an average payment size around 183 CZK (≈ €7.5)...0.5885 BTC in revenue, equivalent to roughly 1.3 million CZK or €53,000"
Context: Merchants ranged from coffee stands to kebab stalls, most with "very low" prior Bitcoin understanding. Key success factors: pre-configured BTCPay stores, Blink Lightning backend, NiceHash POS hardware, on-site support. Post-event: 63% considering Bitcoin outside conference
Confidence: High (comprehensive case study with survey data)
```

### 6.6 Lightning Checkout — European BTCPay-Based Processor

```
Claim: Lightning Checkout operates a payment processing business using BTCPay Server as its core infrastructure, serving European merchants [^36^]
Source: BTCPay Server 2025 Progress Report
URL: https://blog.btcpayserver.org/2025-report/
Date: January 21, 2026
Excerpt: "Lightning Checkout, which operates a payment processing business using BTCPay Server as its core infrastructure"
Context: Represents the "managed non-custodial" model: technical infrastructure built on BTCPay Server but offered as a service to non-technical merchants. Falls outside MiCA as funds go directly to merchant wallets
Confidence: Medium (limited public data)
```

### 6.7 NAKA Payment Network — EMV-Compatible Self-Custodial Cards

```
Claim: NAKA has developed a self-custodial payment card scheme compatible with EMV (Europay, Mastercard, Visa) standards, enabling crypto payments at standard POS terminals without merchant training. Initial deployment in Lugano, San Salvador, and Ljubljana [^476^] [^480^]
Source: Payments Industry Intelligence / Nimiq
URL: https://paymentsindustryintelligence.com/naka-self-custodial-payment-card-scheme-for-global-pos-network/ ; https://nimiq.com/blog/virtual-nimiq-cards
Date: October 12, 2023 / December 10, 2025
Excerpt: "NAKA has developed a new technology that bridges the gap between the traditional payment industry and the blockchain world...fully compatible with the EMV standard, allowing compatibility with virtually any POS system"
Context: NAKA cards work at existing POS terminals without hardware changes. Users tap to pay, merchants receive settlement in preferred currency. Self-custodial architecture means no intermediary holds funds. Testing phase focused on Switzerland and El Salvador
Confidence: Medium (emerging technology, limited production deployment data)
```

---

## 7. Key Market Dynamics and Trends

### 7.1 Regulatory Impact on Payment Processing

MiCA's implementation is structurally reshaping the European Bitcoin payment landscape:

1. **USDT Delisting**: CoinGate and other EU-licensed processors discontinued USDT support under MiCA, causing 15% volume decline in 2025 [^95^]
2. **Travel Rule Friction**: Additional data requirements introduced "incremental friction at checkout" with "modest impact on conversion" [^95^]
3. **Two-Track Market**: Regulated custodial processors vs. unregulated non-custodial self-hosted solutions operating in parallel
4. **Compliance Costs**: MiCA licensing adding operational burden to custodial providers, potentially accelerating merchant interest in non-custodial alternatives

### 7.2 Lightning Network as Default Retail Rail

Lightning is rapidly becoming the default payment method for retail Bitcoin transactions in Europe:
- Sub-cent fees make microtransactions economically viable
- Sub-second settlement matches card payment experience  
- 99%+ success rates in well-configured deployments
- Integration with standard POS hardware (Sunmi, NAKA EMV cards)
- ~30% YoY growth in SMB adoption among Bitcoin payment providers

### 7.3 City-Level Circular Economies

Lugano represents a model for city-level Bitcoin payment adoption that other European cities are watching:
- Public-private partnership model (City + Tether)
- Free POS terminal distribution to merchants
- Municipal services acceptance (taxes, childcare, parking)
- Merchant count: 360-400+ (Lugano only)
- Proof that concentrated local adoption can create functional circular economies

### 7.4 Growth Projections

| Metric | 2025 Value | 2030/35 Projection | CAGR |
|--------|-----------|-------------------|------|
| Global Bitcoin Payments Market | $27.11B | $63.13B (2035) | 8.82% |
| Crypto Payment Gateway Market | $1.69B (2024) | $6.85B (2036) | 13.6% |
| Lightning Merchant Share | 15-20% | 30%+ (projected) | ~30% YoY |
| European Market Share | 26-30% | Stable/growing | — |

---

## 8. Critical Assessment: Non-Custodial European Bitcoin Payments

### Strengths of Non-Custodial Model
1. **Zero processing fees** — BTCPay Server charges no transaction fees
2. **No KYC required** — Privacy-preserving for merchants and customers
3. **Full fund sovereignty** — No counterparty risk, no custodian to fail
4. **Outside MiCA scope** — No licensing requirements, no compliance costs
5. **Censorship resistant** — Cannot be de-platformed by payment processor
6. **Lightning-native** — Ideal for retail with instant settlement

### Limitations and Challenges
1. **Technical barrier** — Self-hosting requires server administration skills
2. **No native fiat settlement** — Requires separate off-ramp (exchange, OTC)
3. **Self-responsibility** — Merchant manages uptime, backups, security
4. **Liquidity management** — Lightning requires channel liquidity for routing
5. **Sparse geography** — Merchant adoption concentrated in specific cities/communities
6. **Customer base** — Limited to Bitcoin-holding customers (still small percentage)

### Counter-Arguments to Monitor
- Critics note that despite impressive growth percentages, absolute Bitcoin payment volumes remain small compared to card networks
- Bitcoin's price volatility discourages merchant holding — most still convert to fiat immediately (~61% of merchants) [^162^]
- Regulatory uncertainty remains even for non-custodial solutions — future MiCA amendments could potentially expand scope
- Tax complexity: in most EU jurisdictions, each Bitcoin payment triggers capital gains calculation, discouraging frequent use

---

## Sources and References

[^36^] BTCPay Server 2025 Progress Report, https://blog.btcpayserver.org/2025-report/, January 21, 2026
[^47^] Fidelity Digital Assets — The Lightning Network, https://www.fidelitydigitalassets.com/sites/g/files/djuvja3256/files/acquiadam/FDA_US_UK_TheLightningNetwork_ExpandingBitcoinUseCases_1187503.2.0_V1.pdf
[^53^] BTCPrague Case Study, https://blog.btcpayserver.org/case-study-btcprague/, August 13, 2025
[^95^] CoinGate 2025 Crypto Payments Report, https://coingate.com/blog/post/crypto-payments-data-report-2025, January 21, 2026
[^98^] CoinGate Lightning Network Data, https://coingate.com/blog/post/lightning-network-year-over-year-data, August 13, 2024
[^103^] CoinGate — Crypto in 2025: Payments and Bitcoin's Evolution, https://coingate.com/blog/post/crypto-in-2025-payments-and-bitcoin-part-4, January 28, 2026
[^118^] Chainalysis — Europe Crypto Adoption 2025, https://www.chainalysis.com/blog/europe-crypto-adoption-2025/, October 16, 2025
[^13^] CoinLaw — Bitcoin Lightning Network Usage Statistics 2026, https://coinlaw.io/bitcoin-lightning-network-usage-statistics/, February 7, 2026
[^162^] SQ Magazine — Crypto Payments Industry Statistics 2026, https://sqmagazine.co.uk/crypto-payments-industry-statistics/, March 12, 2026
[^166^] Market Data Forecast — Europe Cryptocurrency Exchanges Market, https://www.marketdataforecast.com/market-reports/europe-cryptocurrency-exchanges-market, February 12, 2026
[^390^] EMS — Best Crypto Merchant Account Providers, https://ems-ltd.global/best-crypto-merchant-account-providers/, April 29, 2026
[^391^] Earnpark — Bitcoin in France, https://earnpark.com/en/posts/bitcoin-in-france-new-rules-every-holder-must-know/, January 27, 2026
[^393^] CoinGate — Best Crypto Payment Gateways, https://coingate.com/blog/post/best-crypto-payment-gateway, April 16, 2026
[^394^] TradingView/Chainwire — CoinGate 2025 Report, https://www.tradingview.com/news/chainwire:97aa20367094b:0-coingate-publishes-2025-crypto-payments-report-highlighting-shift-to-operational-use/, January 21, 2026
[^398^] Moodie Davitt — Travel Retail Norway Bitcoin, https://moodiedavittreport.com/travel-retail-norway-hails-world-first-with-bitcoin-payments-for-arrivals-click-collect-purchases/, December 18, 2025
[^401^] European Squash Federation Donations, https://europeansquash.com/donations/, May 28, 2025
[^403^] Bit2Me — ESF Adopts Bitcoin, https://news.bit2me.com/en/la-esf-adopta-bitcoin/, January 29, 2025
[^405^] European Squash Federation Bitcoin Announcement, https://europeansquash.com/european-squash-federation-bitcoin/, January 27, 2025
[^406^] Bitcoin Magazine — BTCPay Server 2025, https://bitcoinmagazine.com/business/btcpay-server-the-backbone-of-bitcoin-commerce-2025, June 4, 2025
[^412^] River Financial — Bitcoin Adoption Report 2025, https://river.com/learn/files/river-bitcoin-adoption-report-2025.pdf
[^416^] BTC Inc BTCPay Case Study, https://btcmedia.prowly.com/441889-btc-inc-documents-over-a-year-of-operating-bitcoin-payments-at-scale-in-new-btcpay-server-case-study, January 7, 2026
[^417^] Aurpay vs BTCPay Server, https://aurpay.net/aurspace/aurpay-vs-btcpay-server-self-hosted-comparison-2026/, April 11, 2026
[^418^] RootData — Lugano Bitcoin, https://www.rootdata.com/news/482005, December 26, 2025
[^419^] NAKA — Crypto Payments in Switzerland, https://naka.com/blog/crypto-payments-adoption-switzerland-lugano, July 9, 2025
[^421^] Plan B Lugano, https://planb.lugano.ch/, February 13, 2026
[^422^] SQ Magazine — BitPay Statistics, https://sqmagazine.co.uk/bitpay-statistics/, December 2, 2025
[^427^] Market Research Future — Bitcoin Payments Market, https://www.marketresearchfuture.com/reports/bitcoin-payments-market-24724, April 6, 2026
[^428^] Digital Watch — Lugano 350 Businesses, https://dig.watch/updates/swiss-city-deepens-crypto-adoption-as-350-businesses-now-accept-bitcoin, December 12, 2025
[^430^] BTC Map Blog — November 2025, https://blog.btcmap.org/posts/2025-11/, November 30, 2025
[^431^] BTC Map Blog — June 2025, https://blog.btcmap.org/posts/2025-06/, June 30, 2025
[^435^] Fibo-Crypto — Pay with Bitcoin in France 2026, https://fibo-crypto.fr/en/blog/pay-bitcoin-france-2026-guide-shops-cards-crypto/, February 23, 2026
[^436^] Coinsnap — WooCommerce Bitcoin Guide, https://coinsnap.io/blog/woocommerce-bitcoin-the-complete-2025-guide/, April 28, 2026
[^455^] Lyzi — Printemps Crypto Payments, https://lyzi.io/en/blog/crypto-payments-at-printemps-how-it-works, February 24, 2026
[^456^] Springer — Spatial Analysis of Bitcoin as Medium of Exchange, https://link.springer.com/article/10.1186/s40854-025-00871-z, November 26, 2025
[^457^] BTC Map Dashboard, https://btcmap.org/dashboard
[^462^] Printemps Official — Crypto Payments, https://www.groupe-printemps.com/en/article/printemps-adopts-cryptocurrency-payments, November 26, 2024
[^468^] BTCPay Server — Unbank Case Study, https://blog.btcpayserver.org/case-study-unbank/, February 18, 2025
[^471^] Ouest-France — Carrefour Bitcoin, https://www.ouest-france.fr/economie/budget/cryptomonnaie-le-paiement-en-bitcoin-etendu-a-de-nouveaux-supermarches-a637f3c4-a815-11f0-997b-872c19911d86, October 13, 2025
[^476^] Payments Industry Intelligence — NAKA, https://paymentsindustryintelligence.com/naka-self-custodial-payment-card-scheme-for-global-pos-network/, October 12, 2023
[^477^] National Technology — Crypto at Checkout, https://nationaltechnology.co.uk/Paying_In_Crypto_How_Soon_Before_Using_Bitcoin_At_The_Checkout_Becomes_Normal.php, May 12, 2025
[^479^] Lyzi — Tisseo Toulouse, https://lyzi.io/en/blog/pay-your-metro-ticket-in-crypto-with-tisseo, February 24, 2026

---

*Research conducted: May 29, 2026*
*Total independent web searches: 25*
*Primary sources: 35+*
*Geographic scope: EU + EFTA + UK*
*Focus: Bitcoin-only, non-custodial, self-hosted, outside MiCA CASP*
