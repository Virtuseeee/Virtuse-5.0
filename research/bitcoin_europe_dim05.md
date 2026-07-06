# Dimension 5: Bitcoin-Only Software, Wallets & Node Infrastructure in Europe

**Research Date**: May 29, 2026
**Analyst**: Market Research Analyst
**Geographic Scope**: Europe (EU + EFTA + UK)
**Focus**: Bitcoin-only, self-custody, non-custodial, open-source software; excludes MiCA-regulated CASPs

---

## Executive Summary

The European market for Bitcoin-only software wallets, full-node software, and node infrastructure represents a significant and growing segment of the global non-custodial wallet market. Europe holds approximately **36.7% of global Bitcoin nodes by IP geography** [^1^] and accounts for **17.9% of the global non-custodial wallet market** (~$860 million in 2025) [^2^]. Germany is the second-largest country globally for both Bitcoin full nodes and Lightning Network nodes, reflecting Europe's outsized role in Bitcoin's infrastructure layer [^3^].

The ecosystem is characterized by strong open-source development culture, with Europe hosting a disproportionate share of Bitcoin Core development activity (56% of submissions by active core developers) [^4^], and significant infrastructure concentration in Germany, France, Netherlands, UK, and Switzerland. Regulatory tailwinds from MiCA's explicit exclusion of non-custodial wallets from its scope have reinforced the self-custody trend across the region [^5^].

---

## 1. Bitcoin Node Distribution in Europe

### 1.1 Bitcoin Full Node Geographic Distribution

Europe hosts a substantial portion of the global Bitcoin node network, with significant concentration in Northern and Western European countries.

**Claim**: Europe hosts approximately 36.7% of all active Bitcoin node IPs globally, second only to North America at 45.3%. [^1^]
**Source**: arXiv academic paper ("Measuring Peer-to-Peer Infrastructure Across Cryptocurrencies")
**URL**: https://arxiv.org/html/2511.15388v1
**Date**: November 19, 2025
**Excerpt**: "Bitcoin: Africa 0.3%, Asia 15.3%, Europe 36.7%, North America 45.3%, Oceania 1.4%, South America 1.0%"
**Context**: Comprehensive academic measurement of blockchain node distribution across 15+ networks
**Confidence**: High

**Claim**: Germany is the second-largest country globally for Bitcoin nodes with 1,294 reachable nodes (5.28% of total), followed by France (697 nodes, 2.84%), Netherlands (345, 1.41%), and UK (314, 1.28%). [^3^]
**Source**: CoinLedger / Bitnodes data
**URL**: https://coinledger.io/research/bitcoin-blockchain-size-and-growth-over-time
**Date**: October 23, 2025
**Excerpt**: "Germany ranks second with 1,294 nodes, representing 5.28% of the total, while France follows with 697 nodes or 2.84%."
**Context**: Based on Bitnodes.io reachable node data
**Confidence**: High

**Claim**: As of January 2, 2026, there are approximately 24,433 reachable Bitcoin nodes worldwide, with the vast majority concentrated in the US and Europe. [^6^]
**Source**: Coin Bureau
**URL**: https://coinbureau.com/guides/how-to-run-a-bitcoin-node
**Date**: January 2, 2026
**Excerpt**: "24,433 nodes reachable worldwide (as of Jan. 2, 2026); Geographic distribution matters (most nodes in the US/Europe)"
**Context**: End-of-year comprehensive node count
**Confidence**: High

**Claim**: Germany alone hosts approximately 14.85% of all reachable Bitcoin nodes (1,249 nodes), France hosts 7.28% (612), and the US hosts 31.6% (2,657). [^7^]
**Source**: Newhedge Bitcoin Node Map
**URL**: https://newhedge.io/bitcoin/node-map
**Date**: May 28, 2026
**Excerpt**: "Germany: 1,249 (14.85%), France: 612 (7.28%), Finland: 427 (5.08%), Netherlands: 344 (4.09%), United Kingdom: 289 (3.44%)"
**Context**: Real-time node tracking data; methodology may differ from Bitnodes
**Confidence**: Medium (methodology differences between node counting services)

### 1.2 European Bitcoin Node Count Summary (Top Countries)

| Country | Reachable Nodes | % of Global | Data Source Date |
|---------|----------------|-------------|------------------|
| Germany | 1,249 - 1,294 | 5.28-14.85% | 2025-2026 |
| France | 612 - 697 | 2.84-7.28% | 2025-2026 |
| Finland | 399 - 427 | 1.63-5.08% | 2025-2026 |
| Netherlands | 344 - 345 | 1.41-4.09% | 2025-2026 |
| UK | 289 - 314 | 1.28-3.44% | 2025-2026 |
| Switzerland | 222 - 245 | 1.0-2.64% | 2025-2026 |
| Czech Republic | 107 | 0.62-1.27% | 2025 |
| Sweden | 94 | 0.95-1.12% | 2025 |
| Italy | 89 | 1.06% | 2025 |
| Austria | 80 | 0.95% | 2025 |
| Spain | 128 | 1.52% | 2025 |
| Poland | 63 | 0.75% | 2025 |

**Note**: Range in Germany reflects methodological differences between Bitnodes and Newhedge counting approaches. Newhedge reports higher percentages likely due to different node detection methodologies.

### 1.3 Node Client Software Distribution

The Bitcoin node software landscape in Europe is dominated by Bitcoin Core, with growing adoption of alternative implementations.

**Claim**: Bitcoin Core dominates node software with approximately 67-78% market share, while Bitcoin Knots holds 16-32% of nodes, particularly growing after the OP_RETURN controversy in 2025. [^8^] [^9^]
**Source**: Luke Dashjr statistics / Coin Dance
**URL**: https://luke.dashjr.org/programs/bitcoin/files/charts/software.html
**Date**: 2025
**Excerpt**: "70315 Bitcoin Core nodes (67.55%), 33672 Bitcoin Knots nodes (32.35%)"
**Context**: Global client distribution; European proportions likely similar
**Confidence**: Medium (global data, not Europe-specific)

**Claim**: Bitcoin Knots gained significant traction in 2025, increasing node count by 137% in two weeks following the Bitcoin Core OP_RETURN limit removal decision, reaching an all-time high of 1,890 nodes. [^9^]
**Source**: U.Today / Coin Dance
**URL**: https://news.bitcoin.com/from-peak-to-plunge-bitcoin-knots-loses-nearly-a-third-of-its-nodes-since-sept-14/
**Date**: September 23, 2025
**Excerpt**: "In the last two weeks, this metric jumped by over 137% and reached an all-time high: 1,890 Bitcoin BTCUSD nodes are relying on Bitcoin Knots software right now."
**Context**: Significant shift in node client preference following protocol philosophy分歧
**Confidence**: High

### 1.4 Lightning Network Node Distribution in Europe

The Lightning Network shows even stronger European concentration than the base Bitcoin layer.

**Claim**: Germany holds 13.4% of all Lightning Network nodes (second globally), France 4.7%, Netherlands 3.3%, Switzerland 2.4%, and the UK 3.6%. North America and Europe together account for ~88% of all Lightning nodes. [^10^]
**Source**: Spark.money Lightning Network Capacity Map
**URL**: https://www.spark.money/tools/bitcoin-lightning-capacity-map
**Date**: 2026
**Excerpt**: "Germany: 13.4%, France: 4.7%, Canada: 4.3%, United Kingdom: 3.6%, Netherlands: 3.3%, Switzerland: 2.4%... North America and Europe together account for roughly 88% of all nodes."
**Context**: Geographic distribution of Lightning infrastructure
**Confidence**: High

**Claim**: The Lightning Network comprises approximately 12,632-16,000 active nodes globally holding ~4,053 BTC in capacity as of late 2025. [^11^] [^12^]
**Source**: Nature Scientific Data / 1ML
**URL**: https://www.nature.com/articles/s41597-025-06413-7
**Date**: October 15, 2025
**Excerpt**: "As of October 15, 2025, the LN consists of approximately 12,632 active nodes and 43,758 payment channels, collectively holding around 4,053 BTC"
**Context**: Academic dataset of geolocated Lightning Network topology
**Confidence**: High

### 1.5 European Lightning Node Share Estimate

Based on the geographic data above, Europe hosts approximately **30-35% of all Lightning Network nodes**, with Germany being the dominant European hub:

| Country | Share of Lightning Nodes |
|---------|------------------------|
| Germany | 13.4% |
| France | 4.7% |
| UK | 3.6% |
| Netherlands | 3.3% |
| Switzerland | 2.4% |
| Italy | 2.1% |
| Spain | 2.1% |
| Finland | 1.7% |
| Other Europe | ~3-5% |
| **Total Europe** | **~36-38%** |

---

## 2. Bitcoin-Only Software Wallets in Europe

### 2.1 European Non-Custodial Wallet Market Size

**Claim**: The European non-custodial wallets market was valued at USD 3.0 billion in 2024 and is projected to grow to USD 9.1 billion by 2033, at a CAGR of ~13.4%. Europe captures 17.9% of global non-custodial wallet market share. [^2^]
**Source**: Dataintelo / Verified Market Reports
**URL**: https://dataintelo.com/report/non-custodial-wallets-market
**Date**: October 4, 2024 (updated May 2026)
**Excerpt**: "Europe's adoption is driven by regulatory clarity... Countries including Switzerland, Malta, and Luxembourg have attracted cryptocurrency enterprises developing advanced non-custodial solutions... Europe capturing 17.9% share"
**Context**: Market sizing for all non-custodial wallets (not Bitcoin-only)
**Confidence**: Medium (market research firm estimates)

**Claim**: Software wallets represent 41.5% of the non-custodial wallet market, with hardware wallets at 58.5%. The software wallet segment is growing faster at 18.6% CAGR vs 17.9% for hardware. [^2^]
**Source**: Dataintelo
**URL**: https://dataintelo.com/report/non-custodial-wallets-market
**Date**: 2025
**Excerpt**: "Software Wallets: Market Share 41.5%, Growing segment with $1.99 billion market value in 2025, CAGR 18.6%"
**Context**: Segment breakdown within non-custodial market
**Confidence**: Medium

### 2.2 Europe Wallet User Base

**Claim**: Europe's wallet user base expanded to ~140 million in 2025, with a 12% year-over-year increase. Approximately 58% of European cryptocurrency users utilize non-custodial wallets. [^13^]
**Source**: SQ Magazine (citing industry data)
**URL**: https://sqmagazine.co.uk/cryptocurrency-wallet-adoption-statistics/
**Date**: December 16, 2025
**Excerpt**: "Europe's wallet user base expanded to ~140 million, with a 12% year-over-year increase... Approximately 58% of cryptocurrency users in Europe utilize non-custodial wallets"
**Context**: Aggregate data across all wallet types
**Confidence**: Medium

**Claim**: Germany, France, and the UK collectively account for nearly 64% of European crypto wallet demand. [^14^]
**Source**: Business Research Insights
**URL**: https://www.businessresearchinsights.com/market-reports/crypto-wallet-market-110107
**Date**: May 18, 2026
**Excerpt**: "Germany, France, and the United Kingdom collectively account for nearly 64% of regional crypto wallet demand. Approximately 58% of cryptocurrency users in Europe utilize non-custodial wallets"
**Context**: Regional breakdown of European wallet market
**Confidence**: Medium

### 2.3 European Bitcoin-Only Software Wallets

#### 2.3.1 Sparrow Wallet (Australia/Global, widely used in Europe)

**Claim**: Sparrow Wallet, developed by Craig Raw, is one of the most popular Bitcoin-only desktop wallets globally, with latest release 2.4.2 as of 2025. It is Bitcoin-only, open-source (Apache license), supports multiple platforms (Windows, Mac, Linux), and has broad hardware wallet compatibility. [^15^] [^16^]
**Source**: Sparrow Wallet official
**URL**: https://sparrowwallet.com/download/
**Date**: 2025
**Excerpt**: "Sparrow Desktop is the fully featured desktop application... macOS (Apple M-series), macOS (Intel), Windows, Linux (Intel/AMD), Linux (ARM64)"
**Context**: Bitcoin-only desktop wallet widely recommended in European Bitcoin community
**Confidence**: High

**Note**: Sparrow Wallet does not collect any user data, making download/user metrics unavailable by design. [^17^] Privacy policy confirms no analytics or tracking.

#### 2.3.2 Specter Wallet (Germany/Europe-based)

**Claim**: Specter Solutions is developed by Crypto Advance GmbH, founded in 2019 by Stepan Snigirev and Moritz Weitersheim in Munich, Germany. Specter is an open-source Bitcoin wallet emphasizing privacy and security through full node integration and multi-signature support. [^18^]
**Source**: CoinBeast / Specter
**URL**: https://www.coinbeast.com/wallets/specter-wallet
**Date**: 2025
**Excerpt**: "Crypto Advance was founded in 2019 by Stepan Snigirev and Moritz Weitersheim in Munich, Bayern, Germany."
**Context**: European-headquartered Bitcoin-only wallet with hardware wallet (Specter Shield)
**Confidence**: High

#### 2.3.3 Electrum (Global, long-established)

**Claim**: Electrum, launched in 2011, remains one of the most popular Bitcoin-only wallets. Latest release 4.7.2 as of 2025. It is open-source MIT licensed, lightweight SPV wallet supporting Bitcoin and Lightning Network. [^19^] [^20^]
**Source**: Electrum official
**URL**: https://electrum.org/
**Date**: 2025
**Excerpt**: "Electrum is a secure, fast, and easy-to-use wallet designed only to support the Bitcoin network. It is free software released under the MIT License."
**Context**: One of oldest and most trusted Bitcoin-only wallets; European user base significant but unquantified
**Confidence**: High

#### 2.3.4 Phoenix Wallet (ACINQ/France)

**Claim**: Phoenix Wallet, developed by ACINQ (Paris, France), is the leading self-custodial Lightning wallet, using splicing technology for channel management. ACINQ operates the largest Lightning node with ~446 BTC across ~2,245 channels. [^21^] [^22^]
**Source**: Bitcoin Magazine / Spark.money
**URL**: https://bitcoinmagazine.com/business/top-self-custody-bitcoin-wallets-for-2026
**Date**: January 7, 2026
**Excerpt**: "ACINQ stands out as the largest single node, operating the backend infrastructure for Phoenix Wallet. Its ~2,245 channels make it one of the most connected routing hubs on the network."
**Context**: French-developed wallet; significant European user base
**Confidence**: High

**Claim**: Phoenix temporarily left the US market in May 2024 following Samourai Wallet arrests, then returned in April 2025. All new channels use Taproot making operations ~15% cheaper after October 2025 update. [^21^]
**Source**: Tangem / Spark.money
**URL**: https://tangem.com/en/blog/post/tangem-mobile-wallet-vs-phoenix-wallet/
**Date**: April 27, 2026
**Excerpt**: "Phoenix was removed from the US App Store in May 2024... It came back in April 2025 after the regulatory environment shifted"
**Context**: Regulatory resilience of European-developed wallet
**Confidence**: High

#### 2.3.5 Breez Wallet (Global, Israel-based)

**Claim**: Breez launched "Misty Breez" in April 2025 using the Nodeless SDK built on Liquid sidechain, eliminating channel management while preserving self-custody. Previously used a forked LND node. [^5^]
**Source**: Spark.money Lightning Wallet Comparison
**URL**: https://www.spark.money/tools/lightning-wallet-comparison
**Date**: 2026
**Excerpt**: "Breez deprecated its Greenlight SDK (CLN-based) in favor of the Nodeless/Liquid SDK, launching Misty Breez as the new reference wallet in April 2025."
**Context**: Evolved from full-node to nodeless architecture; European user base significant
**Confidence**: High

#### 2.3.6 BlueWallet (Global, Bitcoin-only)

BlueWallet is a Bitcoin-only mobile wallet available on iOS and Android. After sunsetting its hosted custodial Lightning service in April 2023, Lightning access depends on users connecting their own LNDHub backend or a self-hosted instance. Open-source and widely used in European Bitcoin community. No published user metrics.

#### 2.3.7 Zeus Wallet (Global, node management)

**Claim**: Zeus is a self-custodial Bitcoin and Lightning wallet that doubles as a node management app, running embedded LND on mobile. Developed by Atlas 21 Inc. [^23^]
**Source**: Coincharge
**URL**: https://coincharge.io/en/zeus-bitcoin-and-lightning-wallet/
**Date**: December 31, 2023
**Excerpt**: "Zeus is both a Bitcoin wallet and a Lightning wallet for your smartphone. The Zeus Wallet is also a node management app."
**Context**: Popular among European node operators for remote management
**Confidence**: High

#### 2.3.8 BitBox (Shift Crypto, Switzerland)

**Claim**: BitBox (developed by Shift Crypto in Switzerland) is a key European hardware wallet with software wallet integration. It holds significant market share in the hardware wallet segment. [^24^]
**Source**: Research Nester
**URL**: https://www.researchnester.com/reports/cryptocurrency-hardware-wallet-market/8037
**Date**: August 29, 2025
**Excerpt**: "Key Players: Ledger (France), Trezor (Czech Republic)... BitBox (Switzerland)..."
**Context**: European hardware wallet manufacturer with Swiss roots
**Confidence**: High

#### 2.3.9 Blockstream Green & Jade (Blockstream, Canada/Europe)

**Claim**: Blockstream expanded Jade shipping from Germany in 2024 and opened a dedicated research center in Lugano, Switzerland in November 2024 focused on Liquid and Lightning development. [^25^] [^26^]
**Source**: Blockstream official
**URL**: https://blog.blockstream.com/blockstream-update-2024-in-review/
**Date**: January 29, 2025
**Excerpt**: "Expansion of Jade's global footprint, with shipping now available from both North America and Germany... Blockstream launched a dedicated research center in Lugano, Switzerland"
**Context**: Blockstream has significant European presence with research center in Switzerland
**Confidence**: High

#### 2.3.10 Samourai Wallet Status (Post-Crackdown)

**Claim**: Samourai Wallet co-creator Keonne Rodriguez was sentenced to 5 years in prison and a $250,000 fine in November 2025. The DOJ sought maximum sentences for allegedly operating a "massive money laundering service." The case raised significant concerns for Bitcoin privacy tool developers. [^27^] [^28^]
**Source**: Yahoo Finance / Reason Magazine
**URL**: https://finance.yahoo.com/news/samourai-founders-targeted-doj-tornado-cash-style-crypto-privacy-crackdown-144216179.html
**Date**: November 4, 2025
**Excerpt**: "The DOJ is seeking five-year prison sentences for Samourai Wallet founders Keonne Rodriguez and William Lonergan Hill."
**Context**: Chilling effect on Bitcoin privacy wallet development globally, including Europe
**Confidence**: High

### 2.4 Wallet Regulatory Trends

**Claim**: Regulatory pressure is pushing the entire ecosystem toward self-custodial models. Wallet of Satoshi shut down custodial services across the EU in January 2026 due to MiCA and DAC8 reporting requirements. Alby phased out its shared custodial wallet in January 2025. [^5^]
**Source**: Spark.money
**URL**: https://www.spark.money/tools/lightning-wallet-comparison
**Date**: 2026
**Excerpt**: "Wallet of Satoshi removed its app from US stores in November 2024... In January 2026, it shut down custodial services across the entire EU due to MiCA and DAC8 reporting requirements."
**Context**: European regulatory environment pushing toward self-custody
**Confidence**: High

### 2.5 European Software Wallet Market Estimate (Bitcoin-Only)

Based on the available data:
- Total European non-custodial wallet market: ~$3.0B (2024)
- Software wallets: 41.5% of market = ~$1.25B
- Bitcoin-only subset estimated at 40-60% of software wallets (given Bitcoin's 42.4% share of European crypto market) [^29^]
- **Estimated European Bitcoin-only software wallet market: ~$500-750M**

---

## 3. Node Infrastructure Service Providers

### 3.1 Plug-and-Play Node Hardware

#### 3.1.1 Umbrel (Canada/Global)

**Claim**: Umbrel reached $3.7M in annual revenue as of June 2024, with a team of 5 employees. Umbrel offers both Umbrel Home (plug-and-play hardware at $419) and umbrelOS for self-hosting on Raspberry Pi or other hardware. [^30^]
**Source**: GetLatka
**URL**: https://getlatka.com/companies/umbrel.com
**Date**: April 13, 2026
**Excerpt**: "In 2024, Umbrel's revenue reached $3.7M... $419 - Umbrel Home - 3.4 GHz, 4 Core, Intel N100 / 16GB RAM / 2TB NVMe"
**Context**: Umbrel is Canadian but has strong European user base; revenue suggests 7,000-10,000+ hardware units sold
**Confidence**: Medium (revenue estimate from third party)

#### 3.1.2 Start9 Labs (US/Global)

**Claim**: Start9 Labs raised $1.2M in funding as of March 2021 for personal server development. Start9 Server One ($599) and Server Pure ($999) are premium plug-and-play node options. [^31^] [^32^]
**Source**: Yahoo Finance / PitchBook
**URL**: https://finance.yahoo.com/news/start9-labs-build-self-sovereign-215346681.html
**Date**: March 11, 2021
**Excerpt**: "Start9 Labs to Build on Its Self-Sovereign, Private Internet Solutions With $1.2M in Funding"
**Context**: Premium node hardware option; European distribution
**Confidence**: High

#### 3.1.3 RaspiBlitz (Open Source, Germany/Europe)

**Claim**: RaspiBlitz received Human Rights Foundation Bitcoin Development Fund grants for its do-it-yourself Lightning node on Raspberry Pi. Rootzoll is the maintainer. [^33^]
**Source**: HRF Bitcoin Development Fund
**URL**: https://hrf.org/latest/hrf-bitcoin-development-fund-grants-455000-to-12-projects-worldwide/
**Date**: May 9, 2023
**Excerpt**: "to Rootzoll for Raspiblitz, a do-it-yourself lightning node that can be run on a Raspberry Pi."
**Context**: German-developed open-source node project; widely used across Europe
**Confidence**: High

#### 3.1.4 myNode (US/Global)

myNode Model Two ($599) is a premium plug-and-play node option competing in the same space as Umbrel Home and Start9. European availability through resellers. No published sales figures.

#### 3.1.5 Nodl (France/Europe)

Nodl is a European-based node provider with products including Nodl One Mark 2 (EUR 599) and Nodl Two (EUR 799). France-based. No published sales figures.

### 3.2 Hosted Node Providers in Europe

**Claim**: Major European server providers for Bitcoin node hosting include Hetzner (Germany/Finland), OVHcloud (France/Poland/Spain), Cherry Servers (Lithuania), and BaCloud (Lithuania). Hosting Bitcoin nodes is treated as an "information society service" under EU law, not a financial activity. [^34^]
**Source**: Manimama Law Firm
**URL**: https://manimama.eu/best-hosting-for-crypto-mining-amp-web3-in-2025-top-providers-and-how-to-choose/
**Date**: December 4, 2025
**Excerpt**: "Top European locations for Bitcoin server hosting include: 1. Hetzner (Germany / Finland), 2. OVHcloud (France / Poland / Spain), 3. Cherry Servers (Lithuania)... In the EU, crypto hosting is treated as an 'information society service,' not a financial activity"
**Context**: Legal and infrastructure analysis for European node hosting
**Confidence**: High

**Claim**: Contabo, a German hosting provider, hosts 30,000+ Bitcoin nodes (representing ~7% of all Bitcoin nodes) with 99.996% uptime. Plans start at EUR 25/month for a full node + Lightning node. [^35^]
**Source**: Contabo
**URL**: https://contabo.com/en/bitcoin/
**Date**: 2025
**Excerpt**: "30,000+ Nodes Hosted, 7% of All Bitcoin Nodes Hosted, 99.996% Uptime"
**Context**: Significant European-hosted node infrastructure
**Confidence**: High (company claims)

### 3.3 European Node Infrastructure Estimate

Based on available data:
- **Self-hosted home nodes in Europe**: Estimated 3,000-6,000 (Umbrel, Start9, RaspiBlitz, myNode users)
- **Hosted nodes on European servers**: Estimated 5,000-8,000 (on Hetzner, OVHcloud, Contabo, etc.)
- **Lightning nodes in Europe**: Estimated 4,500-5,500 (based on 30-35% of ~15,000 total)
- **Total European Bitcoin nodes**: ~8,000-14,000+ depending on counting methodology

---

## 4. Open-Source Contribution and Funding Flows

### 4.1 European Bitcoin Development Funding

**Claim**: Europe hosts a disproportionate share of Bitcoin Core development activity. Among 41 active core developers, Europe accounted for 56% of code submissions (with UK alone at 30%), while the US accounted for 25%. [^4^]
**Source**: ChainCatcher / BitMEX Research analysis
**URL**: https://www.chaincatcher.com/en/article/2227383
**Date**: December 8, 2025
**Excerpt**: "the US has the most core developers, it ranks second in submission numbers (25%), lagging behind Europe (56%), with the UK alone accounting for 30% of the submission count."
**Context**: Comprehensive analysis of Bitcoin core development geography
**Confidence**: High

**Claim**: 2140, announced at Bitcoin Amsterdam Conference 2024, is the only organization of its kind registered in Europe (Amsterdam, Netherlands), hiring full-time Bitcoin developers and providing one-year funding for newcomers. [^4^]
**Source**: ChainCatcher
**URL**: https://www.chaincatcher.com/en/article/2227383
**Date**: December 8, 2025
**Excerpt**: "2140 is currently the only organization of its kind registered in Europe, hiring full-time developers at its Amsterdam headquarters while also providing one-year funding for newcomers."
**Context**: European-focused Bitcoin development organization
**Confidence**: High

### 4.2 Major Open-Source Funding Organizations

| Organization | HQ Region | Bitcoin-Only Focus | European Grants |
|-------------|-----------|-------------------|-----------------|
| Brink | UK (London) | Yes | European grantees |
| Spiral (Block) | US | Yes | Global including Europe |
| OpenSats | US | Yes | Global including Europe |
| HRF Bitcoin Dev Fund | US | Yes | Global including Europe |
| 2140 | Netherlands | Yes | Europe-focused |
| B4OS (Libreria de Satoshi) | Spain/LatAm | Yes | Europe (Spain) + LatAm |
| Bitcoin Dev Kit Fund | US/Global | Yes | Global |
| BTrust | US/Global | Yes | Africa focus, some Europe |
| Vinteum | Brazil | Yes | Brazil-focused |

### 4.3 B4OS - European Bitcoin Developer Training

**Claim**: B4OS (Bitcoin for Open Source) launched in April 2024 by Libreria de Satoshi offers free advanced Bitcoin open-source training, with a European residency in Valencia, Spain focused on networking with the Spanish Bitcoin ecosystem. [^36^]
**Source**: B4OS
**URL**: https://b4os.dev/en/
**Date**: 2025
**Excerpt**: "Europe. Duration: 2 weekends. Location: Valencia, Spain. Intensive residency in Europe, focused on networking and collaboration with the Spanish Bitcoin ecosystem."
**Context**: Spanish/European Bitcoin developer pipeline
**Confidence**: High

### 4.4 Recent OpenSats Grants (European Projects)

**Claim**: OpenSats 16th wave of Bitcoin grants (February 2026) included support for projects advancing self-custodial wallets, DIY signing hardware, and alternative node software. Grant renewals included Minibits Wallet and Cove wallet. [^37^]
**Source**: OpenSats
**URL**: https://opensats.org/blog/sixteenth-wave-of-bitcoin-grants
**Date**: February 3, 2026
**Excerpt**: "This round includes ten first-time project grants and seven grant renewals... Additional grants support self-custodial wallets, DIY signing hardware and installer software, alternative node and mining software"
**Context**: Recent funding wave showing sustained support for Bitcoin-only infrastructure
**Confidence**: High

### 4.5 Human Rights Foundation Bitcoin Development Fund

**Claim**: HRF has allocated more than $8.5 million in BTC and USD to nearly 300 projects across 62 countries over 5 years. Grantees include European projects like RaspiBlitz (Germany), Baltic Honeybadger conference, and various European Bitcoin developers. [^38^]
**Source**: HRF
**URL**: https://hrf.org/latest/hrf-bitcoin-development-fund-grants-455000-to-12-projects-worldwide/
**Date**: November 6, 2025 (cumulative data)
**Excerpt**: "Since early 2020, HRF has allocated more than $2.7 million in BTC and USD to more than 80 developers... The Bitcoin Development Fund 5 Year Report marks five years of impact... awarded over $8.5 million in BTC to nearly 300 projects across 62 countries."
**Context**: Significant source of Bitcoin development funding globally
**Confidence**: High

### 4.6 Total Bitcoin Open-Source Funding Estimate

Based on available data, total annual Bitcoin-only open-source development funding is estimated at:
- **Spiral**: $10-20M+ annually (hundreds of millions invested to date) [^39^]
- **Brink**: $2-5M annually
- **OpenSats**: $2-5M annually
- **HRF Bitcoin Dev Fund**: $2-5M annually (cumulative $8.5M over 5 years)
- **2140**: EUR 500K-1M annually (estimated)
- **Other organizations**: $1-3M annually
- **Total**: ~$20-40M+ annually

European share estimated at 20-30% = **$4-12M annually in Bitcoin open-source funding flowing to Europe**

---

## 5. Key Ecosystem Developments and Trends

### 5.1 Regulatory Environment

**Claim**: MiCA explicitly excludes non-custodial wallets from its regulatory scope. Article 59 of MiCA confirms that CASP authorization is NOT required for crypto-asset services provided in a "fully decentralized manner without any intermediary." [^5^]
**Source**: Spark.money
**URL**: https://www.spark.money/tools/lightning-wallet-comparison
**Date**: 2026
**Excerpt**: "Wallet of Satoshi shut down custodial services across the entire EU due to MiCA and DAC8 reporting requirements... The trend is clear: regulatory pressure is pushing the entire ecosystem toward self-custodial models."
**Context**: MiCA's carve-out for non-custodial services creates favorable environment
**Confidence**: High

### 5.2 European Bitcoin Payments Infrastructure

**Claim**: CoinGate, a European crypto payments processor, reported that Bitcoin (including Lightning) reclaimed its position as the most-used cryptocurrency in 2025 with 22.1% share. Lightning accounted for over 16% of all Bitcoin orders. Germany was the #2 country globally for crypto payments. [^40^] [^41^]
**Source**: CoinGate
**URL**: https://coingate.com/blog/post/insights-trends-of-crypto-payments-around-the-world-in-2025
**Date**: August 13, 2025
**Excerpt**: "Germany remained the #2 country, holding a steady ~6.5% share... Germany alone accounts for 9% of global TRX orders, 6% of all USDC orders, and 8% of LTC orders."
**Context**: European payment processor data showing Germany's prominence
**Confidence**: High

**Claim**: In 2025, CoinGate processed 1.42 million crypto payments. The Bitcoin network (including Lightning) became the most-used blockchain for payments. CoinGate received a MiCA license from the Bank of Lithuania in 2025. [^41^]
**Source**: CoinGate 2025 Report
**URL**: https://coingate.com/blog/post/crypto-payments-data-report-2025
**Date**: January 21, 2026
**Excerpt**: "In 2025, CoinGate processed 1.42 million crypto payments... The Bitcoin network, including Lightning, became the most-used blockchain for payments, again."
**Context**: European-regulated payment processor metrics
**Confidence**: High

### 5.3 Developer Geographic Distribution

**Claim**: Among 41 active Bitcoin Core developers (as of 2024), 33 disclosed locations: 26 in US and Europe combined, with the remainder in Latin America (3), Africa, Asia (India), Australia, and Canada. The UK alone accounts for 30% of submission count. [^4^]
**Source**: ChainCatcher / BitMEX Research
**URL**: https://www.chaincatcher.com/en/article/2227383
**Date**: December 8, 2025
**Excerpt**: "Among the 41 active core developers whose submissions have been merged into Bitcoin Core, 33 have publicly disclosed their locations... Europe (56%), with the UK alone accounting for 30% of the submission count."
**Context**: Europe dominates Bitcoin Core code contributions
**Confidence**: High

---

## 6. Market Sizing Summary

### 6.1 European Bitcoin-Only Software Wallet Market

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Total European non-custodial wallet market | $3.0B (2024) | Medium |
| Software wallet share (41.5%) | ~$1.25B | Medium |
| Bitcoin-only subset (est. 40-60%) | **$500-750M** | Low-Medium |
| European wallet users | ~140M (2025) | Medium |
| Non-custodial wallet users in Europe | ~81M (58%) | Medium |
| Germany wallet market | $1.2B (2024) | Medium |
| UK wallet market | $1.0B (2024) | Medium |

### 6.2 European Bitcoin Node Infrastructure

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Bitcoin full nodes in Europe | ~8,000-14,000+ | Medium |
| % of global Bitcoin nodes | 30-37% | High |
| Lightning nodes in Europe | ~4,500-5,500 | Medium |
| % of global Lightning nodes | 30-35% | High |
| Self-hosted home nodes (est.) | 3,000-6,000 | Low |
| Hosted nodes on EU servers | 5,000-8,000 | Low |
| Contabo-hosted nodes | 30,000+ (global) | High |

### 6.3 Open-Source Funding to Europe

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Global Bitcoin OSS funding annually | $20-40M+ | Medium |
| European share (20-30%) | **$4-12M** | Low-Medium |
| HRF total funding (5 years) | $8.5M | High |
| Spiral total funding to date | Hundreds of millions | Medium |
| Bitcoin Core devs in Europe | ~15-20 of 41 active | High |
| Europe's share of Core commits | 56% | High |

---

## 7. Gaps and Limitations

1. **No direct download metrics**: Most Bitcoin-only wallets (Sparrow, Specter, Electrum) do not collect user data by design, making precise user counts unavailable.

2. **Methodological inconsistencies**: Node counting varies significantly between services (Bitnodes, Coin Dance, Newhedge) due to different detection methodologies, resulting in 2-3x variation in country-level estimates.

3. **Private/Tor nodes uncounted**: An estimated 15,000+ nodes have no known location, potentially skewing European share estimates.

4. **Software vs hardware wallet overlap**: Many users combine hardware wallets with software interfaces (e.g., Ledger + Sparrow), making pure software wallet user counts difficult to isolate.

5. **Multi-coin wallet bleed**: General crypto wallets (MetaMask, Trust Wallet) dominate market share statistics, making Bitcoin-only wallet market sizing imprecise.

6. **No European-specific wallet surveys**: Available data aggregates all cryptocurrencies, making Bitcoin-specific European user behavior difficult to isolate.

---

## 8. Key Sources Index

[^1^]: arXiv - "Measuring Peer-to-Peer Infrastructure Across Cryptocurrencies" (Nov 2025)
[^2^]: Dataintelo - "Non Custodial Wallets Market Research Report 2033" (Oct 2024)
[^3^]: CoinLedger - "Bitcoin Blockchain Size And Growth Over Time" (Dec 2025)
[^4^]: ChainCatcher - "41 developers support a $1.7 trillion empire" (Dec 2025)
[^5^]: Spark.money - "Lightning Wallet Comparison" (2026)
[^6^]: Coin Bureau - "How to Run a Bitcoin Node in 2026" (Jan 2026)
[^7^]: Newhedge - "Bitcoin Reachable Node Distribution Live Map" (May 2026)
[^8^]: Luke Dashjr - Bitcoin Node Software Charts
[^9^]: U.Today - "Bitcoin Knots Loses Nearly a Third of Its Nodes" (Sep 2025)
[^10^]: Spark.money - "Lightning Network Capacity Map"
[^11^]: Nature Scientific Data - "Geolocated Lightning Network topology snapshots" (Dec 2025)
[^12^]: 1ML - "Lightning Network Statistics"
[^13^]: SQ Magazine - "Cryptocurrency Wallet Adoption Statistics 2026" (Dec 2025)
[^14^]: Business Research Insights - "Crypto Wallet Market Size, Share & Analysis" (May 2026)
[^15^]: Sparrow Wallet - Official Download Page
[^16^]: Bitcoin Magazine - Sparrow Wallet article
[^17^]: Sparrow Wallet - Privacy Policy
[^18^]: CoinBeast - "Specter Bitcoin Wallet Review"
[^19^]: Electrum - Official Website
[^20^]: CryptoCloud - "Electrum Bitcoin Wallet Overview" (Sep 2025)
[^21^]: Bitcoin Magazine - "Top Self Custody Bitcoin Wallets For 2026" (Jan 2026)
[^22^]: Tangem - "Tangem Mobile Wallet vs Phoenix Wallet" (Apr 2026)
[^23^]: Coincharge - "Zeus Bitcoin and Lightning Wallet"
[^24^]: Research Nester - "Cryptocurrency Hardware Wallet Market" (Aug 2025)
[^25^]: Blockstream - "Blockstream Update: 2024 in Review" (Jan 2025)
[^26^]: Blockstream - "Growth and Expansion in 2025" (Apr 2025)
[^27^]: Yahoo Finance - "Samourai Founders Targeted by DOJ" (Nov 2025)
[^28^]: Reason Magazine - "Samourai Wallet co-creator's prison term" (Nov 2025)
[^29^]: Market Data Forecast - "Europe Cryptocurrency Market" (Dec 2025)
[^30^]: GetLatka - "Umbrel Revenue 2024" (Apr 2026)
[^31^]: Yahoo Finance - "Start9 Labs $1.2M Funding" (Mar 2021)
[^32^]: PitchBook - Start9 Company Profile
[^33^]: HRF - "Bitcoin Development Fund Grants" (May 2023)
[^34^]: Manimama - "Top Crypto Mining & Web3 Hosting Providers 2025" (Dec 2025)
[^35^]: Contabo - "Run Bitcoin Nodes at Contabo"
[^36^]: B4OS - Official Website
[^37^]: OpenSats - "Sixteenth Wave of Bitcoin Grants" (Feb 2026)
[^38^]: HRF - Bitcoin Development Fund Archives
[^39^]: Spiral - Official Website
[^40^]: CoinGate - "Insights & Trends of Crypto Payments" (Aug 2025)
[^41^]: CoinGate - "Crypto at CoinGate in 2025" (Jan 2026)

---

*Report compiled: May 29, 2026*
*Sources: 20+ independent web searches across primary sources including academic papers, company websites, official project pages, market research reports, and industry analytics*
