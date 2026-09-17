#!/usr/bin/env python3
"""One-shot import of MTD_CAC_Tracker.xlsx into cac_months + cac_routes.

Reads every month tab, not only the current one: May through September each hold their
own inputs and the page shows the trend, not one snapshot. The unnamed working tab is
skipped -- it is a duplicate of whichever month was last edited and would collide.

Idempotent by (month, route), so re-running after a workbook edit updates rather than
duplicating. Dry-run by default; --apply writes.

Python over a Node script only because openpyxl is already here and the repo has no
xlsx reader; this is a one-shot importer, not app code.

Usage: seed_cac_tracker.py [path/to/MTD_CAC_Tracker.xlsx] [--apply]
"""
import json, os, sys, urllib.request
from pathlib import Path
import openpyxl

MONTHS = ["january","february","march","april","may","june","july","august",
          "september","october","november","december"]
GROUPS = {"EXTERNAL ROUTES", "IN-HOUSE ROUTES", "OTHER"}
# Routes whose spend the channel spine can actually observe. Everything else stays
# manual: naming a channel that carries no spend would publish a confident $0.
SPEND_CHANNEL = {
    "Internal Webinar": "Webinar|meta_ads",
    "Retargeting Meta Ads": "Meta Ads|meta_ads",
    "Website / SEO / PPC": "Google Ads|google",
}


def env(name):
    for line in Path(".env.local").read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit(f"{name} not in .env.local")


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def parse(ws):
    rows = list(ws.iter_rows(values_only=True))
    month = days_in = days_elapsed = None
    for r in rows:
        label = str(r[1]).strip() if len(r) > 1 and r[1] else ""
        if label == "Month": month = r[2]
        elif label == "Days in Month": days_in = num(r[2])
        elif label == "Days Elapsed": days_elapsed = num(r[2])
    routes, group, order = [], None, 0
    for r in rows:
        name = str(r[1]).strip() if len(r) > 1 and r[1] else ""
        if not name:
            continue
        if name in GROUPS:
            group = name
            continue
        if not group or name.startswith(("TOTALS", "HOW TO USE", "Notes:")) or name[0].isdigit():
            continue
        order += 1
        routes.append({
            "group_label": group,
            "route": name,
            "owner": str(r[2]).strip() if r[2] else None,
            "sort_order": order,
            "fixed_monthly_cost": num(r[3]),
            "variable_spend": num(r[5]),
            "spend_channel": SPEND_CHANNEL.get(name),
            "spend_source": "manual",
            "closed_won": int(r[7]) if num(r[7]) is not None else None,
            "march_cac": num(r[9]),
            "notes": None,
        })
    return month, days_in, days_elapsed, routes


def month_iso(tab, month_cell):
    if hasattr(month_cell, "strftime"):
        return month_cell.strftime("%Y-%m-01")
    word = tab.split()[0].lower()
    if word in MONTHS:
        return f"2026-{MONTHS.index(word) + 1:02d}-01"
    return None


def post(path, rows, conflict, base, key):
    body = json.dumps(rows).encode()
    req = urllib.request.Request(
        f"{base}/rest/v1/{path}?on_conflict={conflict}", data=body, method="POST",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "content-type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


def main(argv):
    apply = "--apply" in argv
    path = next((a for a in argv if a.endswith(".xlsx")),
                str(Path.home() / "Desktop" / "MTD_CAC_Tracker.xlsx"))
    wb = openpyxl.load_workbook(path, data_only=True)
    months, all_routes = [], []
    for tab in wb.sheetnames:
        if not tab.endswith("MTD CAC Tracker") or tab == "MTD CAC Tracker":
            continue
        month_cell, days_in, days_elapsed, routes = parse(wb[tab])
        month = month_iso(tab, month_cell)
        if not month or not days_in:
            print(f"skip {tab}: no month or day count", file=sys.stderr)
            continue
        months.append({"month": month, "days_in_month": int(days_in),
                       "days_elapsed": int(days_elapsed) if days_elapsed else None,
                       "note": f"Imported from {tab}"})
        all_routes.extend({**r, "month": month} for r in routes)
        print(f"{tab} -> {month}: {len(routes)} routes, {days_elapsed}/{days_in} days")
    print(f"\n{len(months)} months, {len(all_routes)} route rows")
    if not apply:
        print("Dry run. Add --apply to write.")
        return 0
    base, key = env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")
    post("cac_months", months, "month", base, key)
    post("cac_routes", all_routes, "month,route", base, key)
    print("written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
