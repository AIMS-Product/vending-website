#!/usr/bin/env python3
"""Subset the site's web fonts and write the committed font files + CSS.

Run by hand (never from the build):

    python3 -m venv ~/.venvs/fonts && ~/.venvs/fonts/bin/pip install fonttools brotli uharfbuzz
    npm run build && npm run start                        # any build of the site
    node scripts/fonts/audit-usage.mjs http://localhost:3000 > /tmp/font-usage.json
    ~/.venvs/fonts/bin/python scripts/fonts/subset-fonts.py --usage /tmp/font-usage.json

Without --usage it reuses the committed scripts/fonts/usage-summary.json.

Rerun it when: content (CMS pages included) starts using a character outside
the files' unicode-range, a new font weight or OpenType feature (e.g.
`diagonal-fractions`, `hyphens: auto`) appears, or a font source is upgraded.
Output: public/fonts/<family>/*.woff2 and src/fonts/*.css + src/fonts/files.ts.

Rules (see README.md next to this file):
- A character is kept only if today's site draws it with this face: the
  allowed set mirrors the Google Fonts subsets the site used to load (Latin +
  Latin Extended) so nothing that rendered in a fallback starts rendering in
  the web font. Within that: used characters + Latin-1 + Latin Extended-A.
- Variable axes are limited to the range in use; an axis is pinned only if a
  single value is used everywhere (opsz is pinned at 14, which is what Google
  served).
- Only default-on OpenType features plus features the site turns on are kept.
  Hinting is dropped.
- Each face is split into a preloaded core (ASCII, common punctuation and
  every character the site draws) and an extended file (the rest of Latin-1
  and Latin Extended-A), which only downloads when a page needs one of its
  characters. Each file's unicode-range lists exactly the code points it
  contains.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
from collections import Counter, defaultdict
from io import BytesIO
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
SUMMARY = HERE / "usage-summary.json"
PUBLIC = ROOT / "public" / "fonts"
GENERATED = ROOT / "src" / "fonts"

# Google Fonts' "latin" + "latin-ext" unicode-ranges, which is what
# next/font/google declared for Inter and Anton before this script existed.
GOOGLE_LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
GOOGLE_LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF"

ASCII = set(range(0x20, 0x7F))
LATIN_1 = set(range(0xA0, 0x100))
LATIN_EXT_A = set(range(0x100, 0x180))
# Curly quotes, dashes, ellipsis, nbsp, plus zero-width characters, which sit
# between letters and would otherwise split a shaping run across two files.
CORE_PUNCTUATION = {0xA0, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026,
                    0xAD, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF}

# Features browsers apply by default (horizontal Latin) plus required ones.
# locl is left out unless the crawl finds a non-English lang attribute.
DEFAULT_ON = ["rvrn", "ccmp", "rlig", "liga", "clig", "calt", "kern", "mark", "mkmk"]
# CSS that turns on a feature -> the tag it needs.
CSS_FEATURES = {"tabular-nums": "tnum", "oldstyle-nums": "onum", "lining-nums": "lnum",
                "proportional-nums": "pnum", "slashed-zero": "zero", "diagonal-fractions": "frac",
                "stacked-fractions": "afrc", "ordinal": "ordn", "small-caps": "smcp"}

FACES = [
    {
        "key": "inter", "dir": "inter", "family": "Inter", "usage_family": "Inter",
        "source": {"url": "https://github.com/google/fonts/raw/e1d6480102fed30739fead0faee463101f892c8f/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
                   "sha256": "29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031"},
        "pin": {"opsz": 14},
        "allowed": [GOOGLE_LATIN, GOOGLE_LATIN_EXT],
        "display": "optional", "style": "normal", "weight": "variable",
        # Copied verbatim from what next/font/google generated, so the
        # fallback metrics (and therefore CLS behaviour) are unchanged.
        "fallback": 'font-family:"Inter Fallback";src:local("Arial");ascent-override:90.44%;descent-override:22.52%;line-gap-override:0.0%;size-adjust:107.12%',
        "variable": ("--font-inter", ":root", '"Inter", "Inter Fallback"'),
        # Admin screens render in Inter and are not crawled, so characters in
        # src/ string literals (§ × ÷ − ↓ ...) go in the core too.
        "literals_in_core": True,
        # Chrome on macOS rounds anti-aliasing with the font-wide head bbox, so
        # each file keeps the bbox of the Google-served subset it replaces
        # (latin for the core, latin-ext for the extended file). A bbox
        # recomputed from the subset differs from Google's by 1/255 on a few
        # pixels per page.
        "head_bbox": {"core": (-400, -480, 5290, 2263), "ext": (-209, -546, 2744, 2269)},
    },
    {
        "key": "anton", "dir": "anton", "family": "Anton", "usage_family": "Anton",
        "source": {"url": "https://github.com/google/fonts/raw/e0a8124cf36bb7c32ca68e5d46d6acdbc3df866a/ofl/anton/Anton-Regular.ttf",
                   "sha256": "a4ba3a92350ebb031da0cb47630ac49eb265082ca1bc0450442f4a83ab947cab"},
        "allowed": [GOOGLE_LATIN, GOOGLE_LATIN_EXT],
        "display": "swap", "style": "normal", "weight": "400",
        "fallback": 'font-family:"Anton Fallback";src:local("Arial");ascent-override:129.7%;descent-override:36.29%;line-gap-override:0.0%;size-adjust:90.69%',
        "variable": ("--font-anton", ".anton-font", '"Anton", "Anton Fallback"'),
    },
    *[
        {
            "key": f"geist-bio-{w}", "dir": "geist-bio", "family": "GeistBio", "usage_family": "GeistBio", "css": "geist-bio",
            "source": {"path": f"scripts/fonts/sources/geist/geist-{name}.ttf"},
            "allowed": None,  # served whole before, so its own cmap is the limit
            "display": "swap", "style": None, "weight": str(w),
        }
        for w, name in [(400, "regular"), (500, "medium"), (600, "semibold"), (700, "bold")]
    ],
]


def parse_ranges(spec: str) -> set[int]:
    out: set[int] = set()
    for part in spec.split(","):
        part = part.strip().removeprefix("U+")
        lo, _, hi = part.partition("-")
        out.update(range(int(lo, 16), int(hi or lo, 16) + 1))
    return out


def format_ranges(cps: set[int]) -> str:
    runs, start, prev = [], None, None
    for cp in sorted(cps):
        if start is None:
            start = prev = cp
        elif cp == prev + 1:
            prev = cp
        else:
            runs.append((start, prev))
            start = prev = cp
    if start is not None:
        runs.append((start, prev))
    return ",".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in runs)


def load_source(face: dict) -> bytes:
    src = face["source"]
    if "path" in src:
        return (ROOT / src["path"]).read_bytes()
    CACHE.mkdir(exist_ok=True)
    cached = CACHE / f"{src['sha256']}.ttf"
    if not cached.exists():
        with urllib.request.urlopen(src["url"]) as r:
            cached.write_bytes(r.read())
    data = cached.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != src["sha256"]:
        cached.unlink()
        sys.exit(f"{face['key']}: source sha256 {digest} != pinned {src['sha256']}; "
                 "update the pin only after re-running the pixel diff")
    return data


def summarize(crawl: dict) -> dict:
    """Reduce an audit-usage.mjs crawl to what the subsetter needs."""
    fams: dict = defaultdict(lambda: {"pages": 0, "chars": Counter(), "weights": Counter(), "features": Counter()})
    for page in crawl["pages"]:
        for fam, u in page["usage"].items():
            f = fams[fam]
            f["pages"] += 1
            for ch in u["chars"]:
                f["chars"][ch] += 1  # pages drawing the character
            for st, n in u["styles"].items():
                f["weights"][st.split()[0]] += n
            for feat, n in u["features"].items():
                if feat.startswith(("num:", "caps:", "ffs:", "lang:")):
                    f["features"][feat] += n
            if u["hyphensAuto"]:
                f["chars"]["‐"] += 1
    return {"source": crawl.get("base"), "crawledAt": crawl.get("crawledAt"),
            "pageCount": len(crawl["pages"]),
            "families": {k: {"pages": v["pages"], "weights": dict(v["weights"]),
                             "features": dict(v["features"]),
                             "chars": {f"{ord(c):04X}": n for c, n in sorted(v["chars"].items())}}
                         for k, v in fams.items()}}


def source_literal_chars() -> set[int]:
    """Characters in src/ string literals: covers admin screens and UI states
    the crawler never renders (errors, chat replies, form steps)."""
    out: set[int] = set()
    for p in (ROOT / "src").rglob("*"):
        if p.suffix in {".ts", ".tsx", ".css", ".json", ".md", ".mdx"} and ".test." not in p.name and p.parent != GENERATED:
            out.update(ord(c) for c in p.read_text(errors="ignore") if ord(c) >= 0xA0)
    return out


def css_features(usage: dict) -> set[str]:
    tags = set()
    for feat in usage.get("features", {}):
        kind, _, value = feat.partition(":")
        if kind == "lang":
            tags.add("locl")
        elif kind == "ffs":
            tags.update(t.strip().strip('"')[:4] for t in value.split(",") if not t.strip().endswith((" 0", " off")))
        else:
            tags.update(CSS_FEATURES[v] for v in value.split() if v in CSS_FEATURES)
    return tags


def check_license(font: TTFont, key: str) -> None:
    name = font["name"]
    text = " ".join(filter(None, (name.getDebugName(i) for i in (0, 13))))
    if "reserved font name" in text.lower():
        sys.exit(f"{key}: the OFL Reserved Font Name clause applies; a subset must be renamed "
                 "(name IDs 1/3/4/6/16) before it can ship. Add the rename, then rerun.")


# recalcBBoxes=False everywhere: some sources store a glyph xMin that differs
# from its outline (Geist's composites: xMin 40, outline 41). Rasterizers
# shift the outline by lsb - xMin, so "fixing" the box moves the glyph a unit.
def subset_to(font_bytes: bytes, cps: set[int], features: list[str]) -> TTFont:
    # recalcTimestamp=False: same input, same bytes, same hashed file name.
    font = TTFont(BytesIO(font_bytes), recalcBBoxes=False, recalcTimestamp=False)
    opts = subset.Options()
    opts.layout_features = features
    opts.hinting = False
    opts.drop_tables += ["DSIG", "hdmx", "VDMX", "LTSH", "gasp", "meta"]
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opts.name_languages = [0x409]
    # Keep glyph names (post format 2). Dropping them (format 3) is smaller
    # but changes anti-aliasing in Chrome on macOS: measured 2026-10-29, a
    # Google Inter file re-saved without names diffed on 81,870 pixels.
    opts.glyph_names = True
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=cps)
    sub.subset(font)
    return font


def instance(font_bytes: bytes, face: dict, weights: set[int]) -> bytes:
    font = TTFont(BytesIO(font_bytes), recalcBBoxes=False, recalcTimestamp=False)
    if "fvar" not in font:
        return font_bytes
    limits = dict(face.get("pin", {}))
    if "wght" in {a.axisTag for a in font["fvar"].axes}:
        lo, hi = min(weights), max(weights)
        limits["wght"] = lo if lo == hi else (lo, hi)
    font = instancer.instantiateVariableFont(font, limits)
    out = BytesIO()
    font.save(out)
    return out.getvalue()


def shape_check(reference: bytes, built: bytes, text_sets: list[str], features: dict, weights: list[int], variable: bool) -> int:
    """Shape the same text with the instanced source and the built file and
    compare glyph outlines, advances and offsets. Returns mismatch count."""
    import uharfbuzz as hb

    def setup(data: bytes):
        return hb.Font(hb.Face(data))

    from fontTools.pens.recordingPen import RecordingPen

    cache: dict = {}

    def outline(font, gid, w):
        key = (id(font), gid, w)
        if key not in cache:
            pen = RecordingPen()
            font.draw_glyph_with_pen(gid, pen)
            cache[key] = tuple((op, tuple(map(tuple, pts))) for op, pts in pen.value)
        return cache[key]

    ref, new = setup(reference), setup(built)
    bad = 0
    for w in weights:
        if variable:
            for f in (ref, new):
                f.set_variations({"wght": w})
        for text in text_sets:
            for feats in (features, {**features, "tnum": True}) if "tnum" in features else (features,):
                res = []
                for f in (ref, new):
                    buf = hb.Buffer()
                    buf.add_str(text)
                    buf.guess_segment_properties()
                    hb.shape(f, buf, feats)
                    res.append([(outline(f, i.codepoint, w), p.x_advance, p.x_offset, p.y_offset)
                                for i, p in zip(buf.glyph_infos, buf.glyph_positions)])
                if res[0] != res[1]:
                    bad += 1
                    if bad <= 5:
                        print(f"    shape mismatch wght={w} feats={feats} text={text[:40]!r}")
    return bad


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--usage", help="crawl JSON from audit-usage.mjs (default: committed summary)")
    args = ap.parse_args()
    if args.usage:
        summary = summarize(json.loads(Path(args.usage).read_text()))
        SUMMARY.write_text(json.dumps(summary, indent=1, ensure_ascii=False) + "\n")
    summary = json.loads(SUMMARY.read_text())
    literal = source_literal_chars()

    css: dict[str, list[str]] = defaultdict(list)
    files: dict[str, dict] = {}
    report = []
    for face in FACES:
        usage = summary["families"].get(face["usage_family"])
        if usage is None:
            sys.exit(f"{face['key']}: no page uses {face['usage_family']}; remove the face instead")
        raw = load_source(face)
        src_font = TTFont(BytesIO(raw))
        check_license(src_font, face["key"])
        cmap = set(src_font.getBestCmap())
        allowed = set().union(*(parse_ranges(r) for r in face["allowed"])) if face["allowed"] else cmap

        used = {int(k, 16) for k in usage["chars"]}
        wanted = (ASCII | LATIN_1 | LATIN_EXT_A | used | literal) & allowed & cmap
        # Everything the site draws goes in the core: a character served from
        # the extended file splits its word into two shaping runs, which moved
        # the rest of the line by a sub-pixel in the pixel diff ("cafés").
        drawn = used | (literal if face.get("literals_in_core") else set())
        core = wanted & (ASCII | CORE_PUNCTUATION | drawn)
        ext = wanted - core

        gsub_gpos = set()
        for t in ("GSUB", "GPOS"):
            if t in src_font:
                gsub_gpos |= {r.FeatureTag for r in src_font[t].table.FeatureList.FeatureRecord}
        features = sorted((set(DEFAULT_ON) | css_features(usage)) & gsub_gpos)

        weights = {int(w) for w in usage["weights"]} if face["weight"] == "variable" else {int(face["weight"])}
        instanced = instance(raw, face, weights)
        weight_desc = face["weight"] if face["weight"] != "variable" else (
            f"{min(weights)} {max(weights)}" if min(weights) != max(weights) else str(min(weights)))

        family_dir = PUBLIC / face["dir"]
        family_dir.mkdir(parents=True, exist_ok=True)
        files[face["key"]] = {}
        for part, cps in (("core", core), ("ext", ext)):
            if not cps:
                continue
            font = subset_to(instanced, cps, features)
            got = set(font.getBestCmap())
            missing = cps - got
            if missing:
                sys.exit(f"{face['key']} {part}: subsetter dropped {format_ranges(missing)}")
            if any(t in font for t in ("fpgm", "prep", "cvt ")):
                sys.exit(f"{face['key']} {part}: hinting tables survived")
            if face.get("head_bbox"):
                head = font["head"]
                head.xMin, head.yMin, head.xMax, head.yMax = face["head_bbox"][part]
            font.flavor = "woff2"
            buf = BytesIO()
            font.save(buf)
            data = buf.getvalue()
            if data[:4] != b"wOF2":
                sys.exit(f"{face['key']} {part}: output is not WOFF2")
            reread = TTFont(BytesIO(data), recalcBBoxes=False)
            if set(reread.getBestCmap()) != got:
                sys.exit(f"{face['key']} {part}: cmap changed on re-read")
            digest = hashlib.sha256(data).hexdigest()[:10]
            name = f"{face['key']}-{part}.{digest}.woff2"
            for old in family_dir.glob(f"{face['key']}-{part}.*.woff2"):
                old.unlink()
            (family_dir / name).write_bytes(data)
            url = f"/fonts/{family_dir.name}/{name}"
            files[face["key"]][part] = url

            # Self-check: same shaping and outlines as the instanced source.
            plain = BytesIO(); reread.flavor = None; reread.save(plain)
            text = "".join(chr(c) for c in sorted(got) if c >= 0x20)
            ascii_text = "".join(chr(c) for c in sorted(got & ASCII))
            pairs = [a + b for a in ascii_text for b in ascii_text] if part == "core" else []
            sample_w = sorted(weights | ({(min(weights) + max(weights)) // 2} if len(weights) > 1 else set()))
            bad = shape_check(instanced, plain.getvalue(), [text, *pairs, *[chr(c) for c in got]],
                              {f: True for f in features if f != "tnum"} | ({"tnum": False} if "tnum" in features else {}),
                              sample_w, face["weight"] == "variable")
            if bad:
                sys.exit(f"{face['key']} {part}: {bad} shaping mismatches against the source")

            axes = [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in reread["fvar"].axes] if "fvar" in reread else []
            report.append(f"{face['key']:<14} {part:<4} {len(data):>7}B glyphs={reread['maxp'].numGlyphs:<4} cps={len(got):<4} axes={axes} features={features}")
            style = f"font-style:{face['style']};" if face["style"] else ""
            css[face.get("css", face["key"])].append(
                f'@font-face{{font-family:"{face["family"]}";{style}font-weight:{weight_desc};'
                f'font-display:{face["display"]};src:url("{url}") format("woff2");'
                f"unicode-range:{format_ranges(got)}}}")
        if face.get("fallback"):
            css[face.get("css", face["key"])].append(f"@font-face{{{face['fallback']}}}")
        if face.get("variable"):
            var, selector, value = face["variable"]
            css[face.get("css", face["key"])].append(f"{selector}{{{var}:{value}}}")

    GENERATED.mkdir(exist_ok=True)
    header = "/* Generated by scripts/fonts/subset-fonts.py. Do not edit; rerun the script. */\n"
    for name, rules in css.items():
        (GENERATED / f"{name}.css").write_text(header + "\n".join(rules) + "\n")
    (GENERATED / "files.ts").write_text(
        "// Generated by scripts/fonts/subset-fonts.py. Do not edit; rerun the script.\n"
        f"export const fontFiles = {json.dumps(files, indent=2)} as const;\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
