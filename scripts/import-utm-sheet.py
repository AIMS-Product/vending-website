#!/usr/bin/env python3
"""
Move the UTM master sheet ("MARKETING SALES OPS") into the link registry, and
give every registry link a funnel where the evidence is clear.

  python3 -I scripts/import-utm-sheet.py "<sheet.xlsx>"           # dry run
  python3 -I scripts/import-utm-sheet.py "<sheet.xlsx>" --apply   # writes

Reads the link tabs (Owned UTMS, Webinar, Meta Ads, VSL, both ManyChat tabs).
The tags come from each row's finished "utm link", never the typed columns, so
the registry holds what was actually posted. Rows with no tagged link (fbclid
ads, headers, blanks) are skipped. Content calendars and the HubSpot export
(PII) are not links and are never read.

Funnel, first match wins:
  sheet  the row's own Funnel Name, mapped onto Close's choices
  close  what Close recorded for the people the link brought in (>= 2 people,
         >= 60% agree; Reactivation Scrapers / No Attribution are lead relabels,
         not link funnels, so they never count)
  rule   youtube -> YouTube, google + cpc -> Google Ads
Otherwise the link stays "No funnel" for a person to set at /admin/links.

Never overwrites: new links are inserted as `backfill:sheet`; on an existing
row only an empty funnel, owner or note is filled. Undo the inserts with
  delete from marketing_links where created_by = 'backfill:sheet';
Needs openpyxl and the 20261014130000 migration.
"""

import collections
import json
import re
import sys
import urllib.request
from urllib.parse import parse_qs, quote, urlencode, urlparse, urlunparse

import openpyxl

APPLY = "--apply" in sys.argv
PLAN_FILE = "utm-sheet-import-plan.tsv"
UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
LINK_TABS = [
    "Owned UTMS",
    "Webinar",
    "Meta Ads",
    "VSL",
    "Mike ManyChat Lead Mags",
    "Anthony ManyChat Lead Mags",
]
# Sheet "Funnel Name" (lowercased) -> Close "Funnel Name DEAL (Opp)" choice.
SHEET_TO_CLOSE = {
    "internal webinar": "Internal Webinar",
    "website": "Website",
    "vsl": "VSL",
    "meta ads": "Meta Ads",
    "meta": "Meta Ads",
    "mike instagram": "Instagram",
    "mike's instagram": "Instagram",
    "instagram": "Instagram",
    "mike manychat lead mags": "Instagram",
    "anthony ig": "Anthony IG",
    "anthony instagram": "Anthony IG",
    "anthony manychat lead mags": "Anthony IG",
    "mike x": "X",
    "x": "X",
    "anthony x": "Anthony X",
    "linkedin": "Linkedin",
    "mike li": "Linkedin",
    "anthony linkedin": "Linkedin",
    "anthony li": "Linkedin",
    "tiktok": "TikTok",
    "anthony tiktok": "TikTok",
    "passivepreneurs": "Passivepreneurs",
    "mike newsletter": "Mike Newsletter",
    "wwws": "WWWS",
    "reactivation email": "Reactivation Email",
    "internal ltf": "LTF - In-House",
}
NOT_LINK_FUNNELS = {"Reactivation Scrapers", "No Attribution"}


def load_env():
    env = {}
    for line in open(".env.local"):
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            env[m[1]] = m[2].strip("\"'")
    return env


ENV = load_env()
BASE = ENV["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/"
HEADERS = {
    "apikey": ENV["SUPABASE_SERVICE_ROLE_KEY"],
    "Authorization": "Bearer " + ENV["SUPABASE_SERVICE_ROLE_KEY"],
}


def rest(method, path, body=None, prefer=None):
    headers = dict(HEADERS, **({"Prefer": prefer} if prefer else {}))
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as res:
        raw = res.read()
        return json.loads(raw) if raw else None


def read_all(table, select, order):
    rows, offset = [], 0
    while True:
        page = rest("GET", f"{table}?select={select}&order={order}&offset={offset}&limit=1000")
        rows += page
        if len(page) < 1000:
            return rows
        offset += 1000


def text(value):
    return "" if value is None else str(value).strip()


def clean_tag(value):
    """Mirror of cleanTag: blank, `_____` and `{{merge}}` are not tags."""
    value = text(value)
    return "" if not value or re.fullmatch(r"_+", value) or "{{" in value else value


def key_of(tags):
    return tuple(clean_tag(tags.get(k)).lower() for k in UTM)


def owner_of(*values):
    joined = " ".join(text(v).lower() for v in values)
    if "mike" in joined:
        return "Mike"
    if "anthony" in joined or re.search(r"(^|[\s-])ak[-\s]", joined + " "):
        return "Anthony"
    return None


def sheet_rows(path):
    book = openpyxl.load_workbook(path, data_only=True)
    for tab in LINK_TABS:
        rows = book[tab].iter_rows(values_only=True)
        header = [text(c).lower() for c in next(rows)]
        for number, values in enumerate(rows, start=2):
            row = dict(zip(header, values))
            link = text(row.get("utm link"))
            if not link.startswith("http"):
                continue
            url = urlparse(link)
            query = parse_qs(url.query)
            tags = {k: clean_tag((query.get(k) or [""])[0]) for k in UTM}
            if not tags["utm_source"]:
                continue
            kept = [(k, v) for k, v in query.items() if k.lower() not in UTM]
            base = urlunparse(url._replace(query=urlencode(kept, doseq=True)))
            keyword = text(row.get("term")) if "ManyChat" in tab else ""
            date = text(row.get("webinar date"))[:10]
            bits = [
                text(row.get("source")),
                text(row.get("resource")),
                f"ManyChat keyword {keyword}" if keyword and keyword != "-" else "",
                f"Webinar {date}" if date else "",
                text(row.get("objective")),
            ]
            short = text(row.get("bitly short link"))
            yield {
                "where": f"{tab}!{number}",
                "url": link,
                "base_url": base,
                "tags": tags,
                "sheet_funnel": text(row.get("funnel name")) or tab,
                "label": " · ".join(dict.fromkeys(b for b in bits if b and b != "None")) or None,
                "owner": owner_of(row.get("source"), row.get("funnel name"), tags["utm_source"], tab),
                "bitly_url": short if short.startswith("http") else None,
            }


def close_evidence():
    """Five-tag key -> Counter of the Close funnels its people carry."""
    funnel_by_email = {
        r["email"].strip().lower(): r["funnel"]
        for r in read_all("close_lead_funnel", "lead_id,email,funnel", "lead_id")
        if r["email"] and r["funnel"] and r["funnel"] not in NOT_LINK_FUNNELS
    }
    evidence = collections.defaultdict(collections.Counter)
    sources = [
        ("lead_submissions", "id,email," + ",".join(UTM), "email"),
        ("calendly_bookings", "id,invitee_email," + ",".join(UTM), "invitee_email"),
    ]
    for table, select, email_col in sources:
        for row in read_all(table, select, "id"):
            funnel = funnel_by_email.get(text(row[email_col]).lower())
            key = key_of(row)
            if funnel and key[0]:
                evidence[key][funnel] += 1
    return evidence


def funnel_for(key, sheet_funnel, evidence):
    if sheet_funnel:
        return sheet_funnel, "sheet"
    seen = evidence.get(key)
    if seen:
        top, count = seen.most_common(1)[0]
        if count >= 2 and count / sum(seen.values()) >= 0.6:
            return top, "close"
    if key[0] in ("youtube", "yt"):
        return "YouTube", "rule"
    if key[0] == "google" and key[1] in ("cpc", "ppc", "paid"):
        return "Google Ads", "rule"
    return None, None


def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith("--"):
        sys.exit(__doc__)
    registry = read_all(
        "marketing_links",
        "id,created_by,funnel_name,owner,label,bitly_id," + ",".join(UTM),
        "id",
    )
    by_key = {key_of(r): r for r in registry}
    used_bitly = {r["bitly_id"] for r in registry if r["bitly_id"]}
    evidence = close_evidence()

    plan = collections.OrderedDict()
    for row in sheet_rows(sys.argv[1]):
        key = key_of(row["tags"])
        if key in plan:
            plan[key]["where"] += ", " + row["where"]
            continue
        plan[key] = row

    inserts, updates, report = [], [], []
    for key, row in plan.items():
        mapped = SHEET_TO_CLOSE.get(row["sheet_funnel"].lower())
        funnel, basis = funnel_for(key, mapped, evidence)
        seen = evidence.get(key)
        disagrees = bool(mapped and seen and seen.most_common(1)[0][0] != mapped and seen.most_common(1)[0][1] >= 2)
        existing = by_key.get(key)
        if existing:
            patch = {}
            if not existing["funnel_name"] and funnel:
                patch.update(funnel_name=funnel, funnel_set_by=basis)
            if not existing["owner"] and row["owner"]:
                patch["owner"] = row["owner"]
            if not existing["label"] and row["label"]:
                patch["label"] = row["label"]
            if patch:
                updates.append((existing["id"], patch))
            action = "update" if patch else "keep"
        else:
            bitly_id = None
            if row["bitly_url"]:
                short = urlparse(row["bitly_url"])
                candidate = (short.netloc + short.path).rstrip("/")
                if candidate not in used_bitly:
                    bitly_id = candidate
                    used_bitly.add(candidate)
            inserts.append({
                "url": row["url"],
                "base_url": row["base_url"],
                **row["tags"],
                "label": row["label"],
                "owner": row["owner"],
                "funnel_name": funnel,
                "funnel_set_by": basis,
                "bitly_id": bitly_id,
                "bitly_url": row["bitly_url"] if bitly_id else None,
                "created_by": "backfill:sheet",
            })
            action = "insert"
        report.append([action, funnel or "", basis or "", "DISAGREES " + json.dumps(dict(seen)) if disagrees else "",
                       *key, row["where"]])

    # Registry rows the sheet never mentions: fill an empty funnel from Close or a rule.
    for key, existing in by_key.items():
        if key in plan or existing["funnel_name"]:
            continue
        funnel, basis = funnel_for(key, None, evidence)
        if funnel:
            updates.append((existing["id"], {"funnel_name": funnel, "funnel_set_by": basis}))
            report.append(["fill", funnel, basis, "", *key, existing["created_by"]])

    with open(PLAN_FILE, "w") as out:
        out.write("\t".join(["action", "funnel", "basis", "note", *UTM, "where"]) + "\n")
        for line in report:
            out.write("\t".join(text(v) for v in line) + "\n")

    counts = collections.Counter((r[0], r[2] or "none") for r in report)
    print(f"sheet links: {len(plan)} distinct | inserts {len(inserts)} | updates {len(updates)}")
    for (action, basis), n in sorted(counts.items()):
        print(f"  {action:7} funnel from {basis:6} {n}")
    for line in report:
        if line[3]:
            print("  sheet vs Close:", " | ".join(line[4:9]), "->", line[1], line[3])
    print(f"plan written to {PLAN_FILE}")

    if not APPLY:
        print("dry run: nothing written. Re-run with --apply.")
        return
    for start in range(0, len(inserts), 200):
        rest("POST", "marketing_links", inserts[start:start + 200], prefer="return=minimal")
    for link_id, patch in updates:
        # Guarded on the column still being empty, so a value someone set in the
        # meantime is never overwritten.
        guard = "&funnel_name=is.null" if "funnel_name" in patch else ""
        rest("PATCH", f"marketing_links?id=eq.{quote(link_id)}{guard}", patch, prefer="return=minimal")
    print(f"applied: {len(inserts)} inserted, {len(updates)} updated")


if __name__ == "__main__":
    main()
