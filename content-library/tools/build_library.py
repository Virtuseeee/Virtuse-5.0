"""Rebuild the article library: WordPress fetch -> master dataset -> CSV/XLSX/JSON + the Artifact page.

Usage (from the repo root):
    python3 content-library/tools/build_library.py            # full rebuild (fetches blog.virtuse.com)
    python3 content-library/tools/build_library.py --no-fetch # reuse content-library/data/posts_all.json

External platforms (Medium, HackerNoon, Denník N, SME, Trend, ...) are NOT fetched here; their
JSON lives in content-library/data/ext/ and is merged as-is. Refresh it by re-running the
scraping step (see README.md) and dropping the new files into that folder.
After a rebuild, republish content-library/kniznica-clankov.html to the existing Artifact URL
(the page's db keeps notes, statuses and the pipeline across versions).
"""
import json, re, html, collections, csv, difflib, unicodedata, sys, os, time, urllib.request
from datetime import datetime, date
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.path.dirname(HERE); ROOT = os.path.dirname(LIB)
DATA = f"{LIB}/data"; EXTD = f"{DATA}/ext"; os.makedirs(EXTD, exist_ok=True)
sys.path.insert(0, HERE); from xlsx_writer import write_xlsx
BASE = "https://blog.virtuse.com"
FIELDS = "id,date,modified,slug,link,title,excerpt,content,categories,tags,author,featured_media,yoast_head_json"

def fetch_all():
    def get(url):
        for i in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "virtuse-library/1.0"}), timeout=90) as r:
                    return json.load(r), r.headers
            except Exception as e:
                print("retry", i, url, e, file=sys.stderr); time.sleep(5 * (i + 1))
        raise SystemExit("fetch failed: " + url)
    out = {}
    for lang in ["en", "sk", "ru", "uk"]:
        page, allp = 1, []
        while True:
            data, h = get(f"{BASE}/wp-json/wp/v2/posts?per_page=100&page={page}&_fields={FIELDS}&lang={lang}&status=publish")
            if not isinstance(data, list) or not data: break
            allp += data; tot = int(h.get("X-WP-TotalPages", "1")); print(lang, page, "/", tot, file=sys.stderr)
            if page >= tot: break
            page += 1
        out[lang] = allp
    json.dump(out, open(f"{DATA}/posts_all.json", "w"), ensure_ascii=False)
    return out

def txt(h): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()
CAT = {13: "Blog", 15: "Media Columns", 36: "Guides", 1: "Uncategorized", 38: "Crypto News", 40: "Krypto novinky", 26: "Blog SK", 31: "Mediálne komentáre",
       131: "Bitcoin University", 37: "Návody", 30: "Oznamy", 23: "Uncategorized SK", 57: "Blog RU", 59: "RU", 61: "RU", 136: "Blog UK"}
NEWS = {38, 40}
AUTH = {36: "Ras Vasilisin", 30: "Ras Vasilisin", 25: "Ras Vasilisin", 3: "Ras Vasilisin", 26: "Virtusenews", 23: "Virtuse Admin", 24: "Virtuse Admin",
        2: "Virtuse Admin", 11: "Tomas Strbik", 6: "Tomas Kurtansky", 7: "Jan Simek", 1: "Peter Bujalko", 4: "Matej Demes"}
TOPICS = [("Bitcoin cena / trh", r"\b(price|cena|\$\d|rally|crash|pád|pad|volatil|ETF|halving|bull|bear|dip|\d{2,3}[ ,.]?000)"),
          ("Makro / inflácia / Fed", r"(inflat|inflác|infláci|fed\b|recess|reces|money print|tlač|dlhopis|bond|yield|výnos|sadzb|rates|jackson hole|dollar|dolár|euro\b)"),
          ("CBDC / digitálne euro", r"(cbdc|digital euro|digitáln\w* euro|digitálne mena|gulag|social credit)"),
          ("Inštitúcie / Saylor / BlackRock", r"(saylor|blackrock|jpmorgan|goldman|fidelity|institution|inštitúc|wall street|strc|strategy\b|treasur|pokladnic)"),
          ("Zlato / komodity", r"(gold|zlato|zlat|commodit|komodit|oil|ropa)"),
          ("Investičné lekcie / psychológia", r"(lesson|lekci|habit|strateg|portfolio|portfóli|buffett|dalio|legend|millionaire|milionár|invest(ing|ovať|or))"),
          ("Filozofia / spoločnosť", r"(schopenhauer|thoreau|camus|machiavelli|lucifer|náboženst|religion|kríž|ježiš|veľká noc|polariz|epstein|wokeism|rome\b|rím)"),
          ("Geopolitika / politika", r"(trump|iran|irán|rusk|russia|china|čín|davos|fico|šimečk|rubio|grónsk|greenland|musk|elon|tesla|spacex|sanctions|sankci)"),
          ("AI / technológie", r"(\bai\b|umel\w* inteligenc|metaverse|nft|web3|defi|blockchain)"),
          ("Krypto burzy / regulácia / riziko", r"(binance|exchange|burz|ico\b|sto\b|ieo\b|regulat|regulác|hack|heist|lúpež|terra|luna|ftx|mica)"),
          ("Virtuse / produkt", r"(virtuse|hub|partner|concierge|brief)"),
          ("Dane / dedičstvo / úschova", r"(tax|dan[eíi]\b|daň|inherit|dedič|custody|úschov|wallet|peňaženk|seed)"),
          ("Gambling / sociálne témy", r"(gambl|hazard|casino|kasín|lottery|lotéri)")]
def topics(t):
    s = t.lower(); return "; ".join([n for n, rx in TOPICS if re.search(rx, s)][:3])
def nums(t):
    return {re.sub(r"[,. ]", "", x) for x in re.findall(r"\d[\d,. ]*\d|\d", t.replace(" ", " "))}
def norm(t):
    t = unicodedata.normalize("NFKD", t.lower()); t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", t).strip()
LANG = {"en": "EN", "sk": "SK", "ru": "RU", "uk": "UK"}
TYPE = {"Media Columns": "Mediálny stĺpček", "Mediálne komentáre": "Mediálny stĺpček", "Bitcoin University": "Bitcoin University", "Guides": "Návod", "Návody": "Návod", "Oznamy": "Oznam"}
def typ(cats):
    cs = cats.split("; ")
    for p in TYPE:
        if p in cs: return TYPE[p]
    return "Nezaradené" if cs[0].startswith("Uncategorized") else "Blog"

def build(d):
    canon = json.load(open(f"{ROOT}/Kimi_Agent_Virtuse%20MiCA%20Partners/stories/wp-canonical.json"))["posts"]
    rows = []
    for lang in ["en", "sk", "ru", "uk"]:
        for p in d.get(lang, []):
            cats = p["categories"]; title = txt(p["title"]["rendered"]); content = p["content"]["rendered"]
            if 26 in cats and lang == "en": lang_ = "sk"
            else: lang_ = lang
            ext = [u for u in re.findall(r'href="(https?://[^"]+)"', content) if "virtuse" not in u]
            m = re.search(r"(?i)(originally published at|published (?:in|on)|článok publikovaný na|pôvodne (?:publikovan|uverejnen)\w* (?:v|na)|the article was published in)\s*([^.<]{3,60})", txt(content)[:600])
            rows.append(dict(id=p["id"], lang=lang_, date=p["date"][:10], title=title, url=p["link"], categories="; ".join(CAT.get(c, str(c)) for c in cats),
                             is_news=bool(set(cats) & NEWS), author=AUTH.get(p["author"], str(p["author"])), words=len(txt(content).split()),
                             fm=p["featured_media"], story=canon.get(str(p["id"]), ""), ext=ext[:3], orig=m.group(2).strip() if m else "",
                             topics=topics(title + " " + txt(p["excerpt"]["rendered"]))))
    main = [r for r in rows if not r["is_news"]]; news = [r for r in rows if r["is_news"]]
    pair = collections.defaultdict(set); by_fm = collections.defaultdict(list)
    for r in main:
        if r["fm"]: by_fm[r["fm"]].append(r)
    for grp in by_fm.values():
        for a in grp:
            for b in grp:
                if a["lang"] != b["lang"]: pair[a["id"]].add((b["lang"], b["id"], ""))
    en = [r for r in main if r["lang"] == "en"]
    for r in main:
        if r["lang"] == "sk" and not pair[r["id"]]:
            dt = datetime.fromisoformat(r["date"]); n = nums(r["title"])
            c = [e for e in en if not pair[e["id"]] and abs((datetime.fromisoformat(e["date"]) - dt).days) <= 4 and n and (n & nums(e["title"]))]
            if len(c) == 1: pair[r["id"]].add(("en", c[0]["id"], "?")); pair[c[0]["id"]].add(("sk", r["id"], "?"))
    ART = []
    for r in sorted(main, key=lambda r: r["date"], reverse=True):
        ART.append({"key": f"wp-{r['id']}", "id": r["id"], "d": r["date"], "t": r["title"], "l": LANG[r["lang"]], "ty": typ(r["categories"]),
                    "o": "blog.virtuse.com" + {"sk": " /sk", "ru": " /ru", "uk": " /uk"}.get(r["lang"], ""), "c": r["categories"], "u": r["url"], "s": r["story"],
                    "p": "; ".join(f'{LANG[l]} {i}{" (odhad)" if q else ""}' for l, i, q in sorted(pair[r["id"]])), "tp": r["topics"], "w": r["words"],
                    "orig": r["orig"], "a": r["author"], "ext": r["ext"], "x": []})
    NEWSR = [{"d": r["date"], "t": r["title"], "l": LANG[r["lang"]], "u": r["url"], "a": r["author"], "id": r["id"], "w": r["words"]} for r in sorted(news, key=lambda r: r["date"], reverse=True)]
    return ART, NEWSR

OUTLET_NAMES = {"TREND (trend.sk, Názory a komentáre)": "TREND.sk", "Denník N (blog)": "Denník N", "Hospodárske noviny (hnonline.sk)": "Hospodárske noviny",
                "TREND blog (blog.etrend.sk)": "TREND blog (etrend)", "SME (blog.sme.sk)": "SME blog", "Pravda (pravda.sk)": "Pravda", "TREND.sk podcast (SoundCloud)": "TREND.sk podcast",
                "Moonhill Cap. (CCC Crypto Coffee Cake podcast)": "Moonhill Cap. podcast (CCC)", "Podnicast (YouTube)": "Podnicast", "Talking Cryptocurrency (YouTube)": "Talking Cryptocurrency (YouTube)",
                "Substack (rasvasilisin.substack.com, 'Virtuse News')": "Substack (Virtuse News)", "Substack (rasvasilisin.substack.com, 'Virtuse Podcast')": "Substack (Virtuse Podcast)"}
METRIC = {"Denník N": "zobrazení", "SME blog": "prečítané", "TREND blog (etrend)": "čítanosť (Wayback)", "TREND.sk podcast": "plays", "Podnicast": "views (YouTube)", "Talking Cryptocurrency (YouTube)": "views (YouTube)"}
def externals(ART):
    EXT = []; notes = []
    def add(d, t, o, l, ty, u, views=None, vs="", n=""):
        if u and t: EXT.append({"d": (d or "")[:10], "t": t.strip(), "o": o, "l": l, "ty": ty, "u": u, "views": views, "vs": vs, "m": None, "n": n or ""})
    p = f"{EXTD}/medium_hackernoon.json"
    if os.path.exists(p):
        j = json.load(open(p))
        for m in j.get("medium", []):
            add(m.get("date"), m.get("title"), "Medium" + (f" ({m['publication']})" if m.get("publication") and "self" not in m["publication"].lower() else ""), "EN", "Blog", m.get("url"), m.get("claps"), "claps" if m.get("claps") is not None else "")
        for h in j.get("hackernoon", []):
            add(h.get("date"), h.get("title"), "HackerNoon", "EN", "Mediálny stĺpček", h.get("url"), h.get("reads"), "reads" if h.get("reads") is not None else "")
        if j.get("notes"): notes.append("Medium/HackerNoon: " + j["notes"])
    TY = {"column": "Mediálny stĺpček", "blog": "Blog", "interview": "Rozhovor", "podcast": "Podcast", "tv": "TV", "press": "Tlač / PR"}
    for fn, lang in [("slovak_media.json", "SK"), ("english_media.json", "EN")]:
        p = f"{EXTD}/{fn}"
        if os.path.exists(p):
            j = json.load(open(p))
            for it in j.get("items", []):
                if it.get("outlet", "").startswith("DataDrivenInvestor"): continue  # same stories as the Medium list
                o = OUTLET_NAMES.get(it.get("outlet", "?"), it.get("outlet", "?")); n = it.get("notes") or ""
                m = re.search(r"views = '([^']+)'", n); vs = it.get("views_label") or (m.group(1) if m else METRIC.get(o, "pozretia")) if it.get("views") is not None else ""
                n = re.sub(r"views = '[^']+'[^;.]*(on the (post|author) page)?,? ?read \d{4}-\d\d-\d\d;?\s*", "", n).strip(" ;")
                add(it.get("date"), it.get("title"), o, it.get("lang", lang), TY.get(it.get("type", ""), it.get("type", "")), it.get("url"), it.get("views"), vs, n)
            if j.get("notes"): notes.append(f"{fn.split('_')[0].title()} média: " + j["notes"])
    # drop boilerplate per-item notes (same text on 3+ items of one outlet); keep real per-item remarks
    cnt = collections.Counter((x["o"], x["n"]) for x in EXT if x["n"])
    for x in EXT:
        if x["n"] and cnt[(x["o"], x["n"])] >= 3: x["n"] = ""
        if x["vs"].lower().startswith("prečítané"): x["vs"] = "prečítané"
    seen, out = set(), []
    for x in EXT:
        k = x["u"].rstrip("/").lower()
        if k not in seen: seen.add(k); out.append(x)
    EXT = sorted(out, key=lambda x: x["d"], reverse=True)
    by_lang = collections.defaultdict(list)
    for i, a in enumerate(ART): by_lang[a["l"]].append((norm(a["t"]), i))
    for xi, x in enumerate(EXT):
        nt = norm(x["t"]); best = (0, None)
        for n2, i in by_lang.get(x["l"], []):
            r = difflib.SequenceMatcher(None, nt, n2).ratio()
            if r > best[0]: best = (r, i)
        if best[0] >= 0.82: x["m"] = ART[best[1]]["id"]; ART[best[1]]["x"].append(xi)
    return EXT, notes

def outlets(ART, EXT):
    AP = json.load(open(f"{EXTD}/author_pages.json")) if os.path.exists(f"{EXTD}/author_pages.json") else {}
    def rng(ds):
        ds = sorted(d for d in ds if d); return f"{ds[0][:4]}–{ds[-1][:4]}" if ds else ""
    OUT = []
    for name, l, items, note in [
        ("blog.virtuse.com (EN)", "EN", [a for a in ART if a["l"] == "EN"], "Hlavný archív. WordPress, kategórie Blog + Media Columns. Žiadne počítadlo pozretí; pozretia doplniť z GA4 alebo Search Console."),
        ("blog.virtuse.com/sk", "SK", [a for a in ART if a["l"] == "SK"], "Slovenský blog + Mediálne komentáre + Bitcoin University."),
        ("blog.virtuse.com/ru", "RU", [a for a in ART if a["l"] == "RU"], "Ruské preklady, nahrané naraz 3. 9. 2026."),
        ("blog.virtuse.com/uk", "UK", [a for a in ART if a["l"] == "UK"], "Ukrajinské preklady."),
        ("virtuse.com/stories", "EN/SK/RU", [a for a in ART if a["s"]], "Statické kópie článkov na virtuse.com (kanonická verzia od 7. 10. 2026). Kliky a zobrazenia sú v Search Console pre virtuse.com.")]:
        OUT.append({"name": name, "lang": l, "count": len(items), "range": rng([a["d"] for a in items]), "note": note, "url": AP.get(name, "")})
    for o, _ in sorted(collections.Counter(x["o"] for x in EXT).items(), key=lambda kv: -kv[1]):
        its = [x for x in EXT if x["o"] == o]; vs = sorted({x["vs"] for x in its if x["vs"]})
        OUT.append({"name": o, "lang": "/".join(sorted({x["l"] for x in its})), "count": len(its), "range": rng([x["d"] for x in its]),
                    "note": ("Metrika: " + ", ".join(vs) + ". " if vs else "Platforma pozretia nezverejňuje. ") + AP.get(o + "|note", ""), "url": AP.get(o, "")})
    return OUT

MAINT = open(f"{HERE}/maintenance.html").read() if os.path.exists(f"{HERE}/maintenance.html") else ""

def main():
    d = json.load(open(f"{DATA}/posts_all.json")) if "--no-fetch" in sys.argv else fetch_all()
    ART, NEWSR = build(d); EXT, notes = externals(ART); OUT = outlets(ART, EXT)
    gen = date.today().strftime("%-d. %-m. %Y") + f" · {len(ART)} článkov z WordPressu, {len(EXT)} externých položiek, {len(NEWSR)} archívnych správ"
    EXTN = open(f"{HERE}/ext_notes.txt").read().strip() if os.path.exists(f"{HERE}/ext_notes.txt") else " ".join(notes)
    DATAJ = {"articles": ART, "external": EXT, "news": NEWSR, "outlets": OUT, "generated": gen, "extNotes": EXTN, "maintenanceHtml": MAINT}
    js = json.dumps(DATAJ, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    open(f"{LIB}/kniznica-clankov.html", "w").write(open(f"{HERE}/template.html").read().replace("__DATA__", js))
    H1 = ["Dátum", "Názov", "Jazyk", "Typ", "Kde publikované", "Kategória (WP)", "URL", "Story na virtuse.com", "Preklad / dvojička", "Témy", "Počet slov", "Pozretia", "Zdroj pozretí", "Pôvodne publikované", "Autor (WP)", "WP ID", "Externé verzie", "Odkazy v texte"]
    R1 = [[a["d"], a["t"], a["l"], a["ty"], a["o"], a["c"], a["u"], a["s"], a["p"], a["tp"], a["w"], "", "", a["orig"], a["a"], a["id"], "; ".join(EXT[i]["u"] for i in a["x"]), "; ".join(a["ext"])] for a in ART]
    H2 = ["Dátum", "Názov", "Outlet", "Jazyk", "Typ", "URL", "Pozretia", "Metrika", "WP ID (dvojička na blogu)", "Poznámka"]
    R2 = [[x["d"], x["t"], x["o"], x["l"], x["ty"], x["u"], x["views"], x["vs"], x["m"], x["n"]] for x in EXT]
    H3 = ["Outlet", "Jazyk", "Počet", "Roky", "Autorská stránka", "Poznámka"]; R3 = [[o["name"], o["lang"], o["count"], o["range"], o["url"], o["note"]] for o in OUT]
    H4 = ["Dátum", "Názov", "Jazyk", "URL", "Autor (WP)", "WP ID", "Počet slov"]; R4 = [[n["d"], n["t"], n["l"], n["u"], n["a"], n["id"], n["w"]] for n in NEWSR]
    for fn, h, r in [("clanky.csv", H1, R1), ("externe-publikacie.csv", H2, R2), ("media-outlety.csv", H3, R3), ("archiv-crypto-news.csv", H4, R4)]:
        with open(f"{LIB}/{fn}", "w", newline="") as f: w = csv.writer(f); w.writerow(h); w.writerows(r)
    write_xlsx(f"{LIB}/kniznica-clankov.xlsx", {"Články": [H1] + R1, "Externé publikácie": [H2] + R2, "Médiá a outlety": [H3] + R3, "Archív Crypto News": [H4] + R4})
    json.dump(DATAJ, open(f"{LIB}/library.json", "w"), ensure_ascii=False)
    print("articles", len(ART), "ext", len(EXT), "matched", sum(1 for x in EXT if x["m"]), "news", len(NEWSR), "outlets", len(OUT))
if __name__ == "__main__": main()
