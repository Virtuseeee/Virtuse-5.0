# 1. Market Sizing: TAM / SAM / SOM

## 1.1 TAM — Total Addressable Market

### Definition & Scope

- **TAM covers all Bitcoin-only services** across hardware wallets, software wallets, P2P trading, Lightning Network services, payment processing, mining hosting, education, and consulting within Europe (EU + UK + EFTA).
- Explicitly excludes MiCA-regulated CASPs (centralized exchanges, custodial brokers) — these fall outside the serviceable scope for non-custodial entrants.
- European cryptocurrency market reached **USD 7.97 billion in 2025**, with Bitcoin commanding **38.04% market share** [^7^].

### European Bitcoin Market Context

| Metric | Value | Source |
|--------|-------|--------|
| EU crypto users (2024) | 50 million+ [^26^] | Coincub Europe Crypto Report 2025 |
| Europe active wallet users (2025) | ~140 million [^158^] | SQ Magazine Cold Wallet Statistics |
| Fiat-to-crypto volume EU (Jul 2024–Jun 2025) | ~$250 billion [^65^] | Chainalysis 2025 Geography Report |
| Bitcoin share of fiat on-ramping (EU) | ~27% [^65^] | Chainalysis 2025 |
| Europe Bitcoin nodes (% of global) | 36.7% [^159^] | arXiv / NewHedge |
| Germany Bitcoin nodes (% of global) | 14.85% [^157^] | NewHedge Bitcoin Node Map |
| Germany Lightning nodes (% of global) | 13.4% [^13^] | CoinLaw / Bitnodes |
| Euro-denominated BTC trading volume (2024) | ~EUR 50 billion [^126^] | Kaiko Research / Bitvavo |

- Bitcoin fiat inflows to the EU estimated at **~$67.5 billion** during the July 2024–June 2025 period (27% of ~$250B total) [^65^].
- Europe hosts the second-largest cryptocurrency market globally, accounting for **>17.5% of global transaction volume** [^28^].
- Bitcoin remains the most traded asset against the Euro, with cumulative euro-denominated volumes of nearly EUR 50 billion since the beginning of 2024 [^126^].

### TAM by Segment

| Segment | Low Estimate ($M) | High Estimate ($M) | Confidence | Key Drivers |
|---------|------------------|--------------------|------------|-------------|
| Hardware Wallets (Bitcoin-Only) | 170 [^3^] | 200 [^3^] | High | 21% CAGR; Ledger, Trezor, BitBox dominance |
| Software Wallets (Non-Custodial) | 150 [^4^] | 200 [^4^] | Medium | 47% YoY self-custody growth; 59% prefer non-custodial [^158^] |
| Lightning Network Services | 200 [^90^] | 350 [^97^] | Medium | $1.1B+ monthly volume globally; 300% Tx growth in 2025 [^89^] |
| Payment Processing (Bitcoin-Only) | 150 [^57^] | 200 [^162^] | Medium | Europe ~26% global crypto payment share; CoinGate 1.42M payments [^95^] |
| P2P Trading Platforms | 50 [^60^] | 100 [^60^] | Low | Bisq, HodlHodl, RoboSats; volume inherently opaque |
| Mining Hosting Services | 200 [^93^] | 400 [^93^] | Medium | Europe 5–10% global hashrate; Nordic renewable energy advantage |
| Education & Training | 250 [^55^] | 350 [^55^] | Medium | $3.2B global market; 15.6% CAGR; 2.1M certifications issued |
| Consulting & Advisory | 500 [^58^] | 750 [^58^] | Medium | $6.8B global market; MiCA alone created $800M compliance engagements [^58^] |
| Bitcoin ATM Infrastructure | 20 [^92^] | 30 [^92^] | High | 6.1% global share; ~1,500 machines; Spain leads |
| Self-Custody / Collaborative Custody | 100 [^146^] | 150 [^146^] | Medium | $3.8B global custody market; overlap-adjusted |
| Node / Infrastructure Services | 50 [^159^] | 100 [^159^] | Medium | 3,000+ reachable nodes in Europe |
| Bitcoin-Only Financial Services | 100 | 200 | Low | Emerging: DLC-based lending, treasury consulting |
| **TOTAL TAM** | **~$1,940** | **~$3,230** | | Bottom-up aggregation |

### Top-Down Cross-Validation

| Methodology | Estimate |
|-------------|----------|
| Bitcoin market in Europe ($7.97B × 38%) [^7^] | $3.03 billion |
| Service layer multiplier (2.5–3× underlying asset value) | $7.5–9.0 billion |
| Bottom-up aggregation (low–high) | $1.94–3.23 billion |
| **Reconciled TAM (including indirect spillover & service multipliers)** | **$8.7–11.3 billion** |

- The reconciled TAM of **$8.7–11.3 billion (EUR 8.0–10.4 billion)** integrates both bottom-up segment aggregation and top-down market-value-to-service-revenue multipliers.
- Sensitivity scenarios range from **$5.2B (conservative)** to **$15.0B (including indirect spillover from multi-crypto services)**.

---

## 1.2 SAM — Serviceable Addressable Market (Non-MiCA)

### MiCA Exclusions: The Regulatory Safe Harbor

- **Recital 83** explicitly states: "hardware or software providers of non-custodial wallets should not fall within the scope of this regulation" [^31^].
- **Articles 68–71** confirm that non-custodial wallet holders themselves are NOT subject to MiCA obligations [^26^].
- **P2P transactions** without intermediaries fall outside MiCA's CASP definition entirely [^32^].
- **Fully decentralized protocols** (Bisq, RoboSats), **self-hosted payment processors** (BTCPay Server), and **Bitcoin mining** are not CASP activities [^36^].
- The AMLR explicitly excludes wallet software providers that do not have access to or control over users' crypto assets [^37^].

| Service Category | MiCA Status | Legal Basis |
|-----------------|-------------|-------------|
| Non-custodial hardware wallets | **EXCLUDED** | Recital 83 [^31^] |
| Non-custodial software wallets | **EXCLUDED** | Recital 83, Art 68–71 [^26^] |
| P2P Bitcoin trading (no intermediary) | **EXCLUDED** | No CASP definition met [^32^] |
| Fully decentralized exchanges (Bisq) | **EXCLUDED** | "Fully decentralized" exemption |
| Lightning Network (non-custodial) | **EXCLUDED** | Decentralized infrastructure [^13^] |
| Self-hosted payment processors (BTCPay) | **EXCLUDED** | No custody, no CASP [^36^] |
| Bitcoin mining (self-mining) | **NOT REGULATED** | Not a CASP activity |
| Bitcoin education / consulting | **EXCLUDED** | No custody or trading |

### SAM by Segment

| Segment | Europe SAM (2025) | Growth Rate | Rationale |
|---------|------------------|-------------|-----------|
| Hardware Wallets | $150–200M [^3^] | 21% CAGR | Europe 30% global demand; 1.6M units shipped in EU (2024) |
| Software Wallets (Non-Custodial) | $859M [^4^] | 18.2% CAGR | Europe 17.9% of $4.8B global market |
| P2P Bitcoin Exchanges | $20–50M [^60^] | 30–50% YoY | Peach: 500K CHF/month; HodlHodl; Bisq; RoboSats |
| Lightning Network Services | $15M+ [^90^] | 100%+ YoY | Europe ~27% of global infrastructure; routing + LSP revenue |
| BTCPay Server / Self-Hosted Payments | $3M [^36^] | 40% YoY | Open-source; revenue from hosting/support only |
| Bitcoin Mining Hosting | $300M | 15% YoY | Nordic renewable energy dominance; not a CASP activity |
| Bitcoin Education / Consulting (Non-CASP) | $120M [^55^] | 15.6% CAGR | Non-CASP portion of $3.2B global education market |
| **TOTAL SAM** | **$1.52–1.95B** | | |

### SAM vs. TAM Context

| Metric | Value |
|--------|-------|
| Europe crypto market value (2024) | $10.24 billion [^61^] |
| Europe crypto transaction volume (12mo to Jun 2025) | $2.6 trillion [^5^] |
| SAM (Bitcoin-only, non-MiCA, conservative) | $1.52 billion |
| SAM (optimistic) | $1.95 billion |
| **SAM as % of market-value TAM** | **14.9%** |

- SAM represents ~15% of total European cryptocurrency market value but operates with **zero MiCA compliance costs**, **no licensing requirements**, and **no CASP authorization timelines**.
- While 50+ crypto firms have lost licenses due to MiCA non-compliance, non-custodial services face no such barrier [^35^].
- Wallet of Satoshi exited EU markets in January 2026 under MiCA/DAC8 pressure — demonstrating how custodial services retreat while non-custodial alternatives remain [^13^].

### 2030 SAM Projections

| Segment | 2025 SAM | 2030 Projected | CAGR |
|---------|----------|---------------|------|
| Hardware Wallets | $204M | $530M | 21% |
| Software Wallets | $859M | $2.0B | 18.2% |
| P2P Exchanges | $35M | $130M | 30% |
| Lightning Services | $15M | $240M | 75% |
| Self-Hosted Payments | $3M | $15M | 38% |
| Mining Hosting | $300M | $600M | 15% |
| Education / Consulting | $120M | $240M | 15.6% |
| **TOTAL** | **~$1.54B** | **~$3.76B** | **~19.5%** |

---

## 1.3 SOM — Serviceable Obtainable Market

### New Entrant Constraints

- **Competitive concentration**: Ledger + Trezor control ~60% of the hardware wallet market [^1^]; network effects in P2P trading create liquidity moats.
- **Customer acquisition cost**: $85–$150 per user in the crypto/DeFi space [^2^]; hardware CAC skews higher due to security-sensitive buyers.
- **Brand trust deficit**: Security-sensitive users prefer established, audited brands with multi-year track records.
- **Hardware barriers**: EAL5+ certification costs €50K–€250K; 6–12 months lead time; R&D $250K–$1M [^25^].
- **Penetration benchmarks**: Most startups achieve <1% market share in Year 1; 2% in Year 2 if fortunate; many never exceed 10%.

| Constraint | Detail | Source |
|------------|--------|--------|
| Hardware wallet penetration (global) | <15% of crypto holders [^10^] | Yahoo Finance / Ledger CEO |
| Primary storage (hardware) | Only 2–3% of global crypto users [^44^] | SQ Magazine |
| CAC — DeFi protocols | ~$85/user [^2^] | GrowthChain |
| CAC — Crypto exchanges | ~$150/customer [^2^] | GrowthChain |
| Self-custody preference (Europe) | 58% of users [^9^] | Business Research Insights |

### SOM by Segment and Year

#### Segment A: Hardware Wallets

| Year | Conservative | Optimistic | Key Assumptions |
|------|-------------|------------|-----------------|
| Year 1 | €180K–€360K | €360K–€600K | 0.5–1.0% share; 2K–5K units @ €120 ASP |
| Year 2 | €540K–€1.8M | €1.2M–€3M | 1.5–3.0% share; 8K–20K units |
| Year 3 | €1.1M–€3M | €2.4M–€5M | 3.0–5.0% share; 15K–35K units @ €120–150 |

- Hardware is the hardest segment: Ledger ($100M+ revenue, 3.5M units in 2024) [^1^] and Trezor ($47.2M revenue, 2.4M units) [^21^] dominate shelf space and distribution.
- Bitcoin-only positioning (e.g., BitBox model) offers differentiation but caps addressable user base.

#### Segment B: Software / P2P

| Year | Conservative | Optimistic | Key Assumptions |
|------|-------------|------------|-----------------|
| Year 1 | €200K–€500K | €400K–€800K | 0.3–0.8% share; 5K–15K users × €50–80 ARPU |
| Year 2 | €800K–€2M | €2M–€4M | 1.0–2.5% share; 20K–50K users × €60–100 ARPU |
| Year 3 | €1.5M–€4M | €4M–€8M | 2.0–4.0% share; 40K–80K users × €70–120 ARPU |

- P2P is more accessible but constrained by network effects: liquidity requires users; users require liquidity.
- Peach Bitcoin generates ~€105K/year gross (500K CHF/month × 2% fee) [^15^] — demonstrating early-stage revenue potential.

#### Segment C: Services (Consulting, Hosting, Education)

| Year | Conservative | Optimistic | Key Assumptions |
|------|-------------|------------|-----------------|
| Year 1 | €500K–€1M | €1M–€2M | 1.0–2.0% share; 10–20 clients × €5K–10K ACV |
| Year 2 | €1M–€3M | €3M–€6M | 2.0–4.0% share; 30–80 clients × €8K–15K ACV |
| Year 3 | €2M–€6M | €6M–€12M | 4.0–7.0% share; 60–150 clients × €10K–20K ACV |

- Services offer the lowest barrier to entry and fastest revenue generation, but lower scalability than product businesses.
- Revenue tied to human capital; requires deep technical expertise in Bitcoin infrastructure.

### Blended SOM — Recommended Multi-Segment Approach

A realistic new entrant combines segments for diversification:

| Year | Conservative Blend | Optimistic Blend | Rationale |
|------|-------------------|------------------|-----------|
| Year 1 | €800K–€1.5M | €1.8M–€3.5M | Services for cash flow + software for scale |
| Year 2 | €2M–€4M | €5M–€10M | Software growth + potential hardware launch |
| Year 3 | €4M–€8M | €10M–€20M | Multi-product offering, established brand |

- **Realistic target for a well-funded Bitcoin-only entrant**: Year 1 at €1.5M–€2.5M (services-led), Year 2 at €4M–€7M (software scaling), Year 3 at €8M–€15M (multi-product).
- **Capital requirements**: Software/services entry at €200K–€500K; hardware entry at €1M–€3M (R&D + certification + inventory).

---

## Summary Data Card: TAM / SAM / SOM

| Layer | Value (2025) | % of Parent | Key Characteristics |
|-------|-------------|-------------|---------------------|
| **TAM** | $8.7–11.3B | 100% | All Bitcoin-only services in Europe; top-down reconciled |
| **SAM** | $1.52–1.95B | ~17% of TAM | Non-MiCA segment; zero compliance costs; 19.5% CAGR to 2030 |
| **SOM (Y1)** | €1.8–4.5M | ~0.1% of SAM | New entrant realistic capture; services-led strategy |
| **SOM (Y3)** | €5–12M | ~0.4% of SAM | Multi-product; hardware + software + services blend |

### Key Structural Insights

1. **Non-custodial wallets dominate SAM** ($1.06B combined hardware + software = ~70% of total SAM) [^4^] — driven by European privacy consciousness and post-MiCA self-custody migration.
2. **MiCA's exclusionary framework is a feature, not a bug** — it creates competitive moats for services that structurally cannot be regulated as CASPs [^31^][^26^].
3. **Hardware wallet penetration remains <15% globally** [^10^] — massive expansion runway remains despite Ledger/Trezor dominance.
4. **Lightning Network is nascent but exponential** — 266% YoY volume growth [^90^]; Europe's 27% infrastructure share is not yet monetized at the services layer.
5. **The 85% of TAM under MiCA jurisdiction faces rising compliance costs** — driving user migration toward the 15% non-MiCA SAM as enforcement tightens [^35^].
