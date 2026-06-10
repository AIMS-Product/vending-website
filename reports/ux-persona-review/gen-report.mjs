// Step 5: generate UX-REVIEW.md from final-findings.json + scores.json + authored analysis.
import fs from "node:fs";

const D = "reports/ux-persona-review/";
const SEV_RANK = { blocker: 5, critical: 4, high: 3, medium: 2, low: 1 };
let all = JSON.parse(fs.readFileSync(D + "final-findings.json", "utf8"));

// fold residual duplicate clusters into their verified parents
const FOLD = { C005: "C030", C044: "C030", C009: "C030", C070: "C076", C002: "C076", C021: "C007", C042: "C014", C022: "C006" };
const byId = Object.fromEntries(all.map((c) => [c.cid, c]));
for (const [src, dst] of Object.entries(FOLD)) {
  const s = byId[src], d = byId[dst];
  if (!s || !d || s.__discarded) continue;
  d.personas = [...new Set([...(d.personas || []), ...(s.personas || [])])];
  d.personaCount = d.personas.length;
  s.__folded = dst;
}
const discarded = all.filter((c) => c.__discarded);
all = all.filter((c) => !c.__discarded && !c.__folded);

// recompute bands after folds
for (const c of all) {
  const s = c.severity, f = c.personaCount;
  c.band = s === "blocker" || (s === "critical" && f >= 5) ? "P0" : s === "critical" || (s === "high" && f >= 5) ? "P1" : s === "high" || (s === "medium" && f >= 3) ? "P2" : "P3";
}
all.sort((a, b) => a.band.localeCompare(b.band) || SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.personaCount - a.personaCount);
const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
all.forEach((c) => counts[c.band]++);

const esc = (s) => String(s || "").replace(/\|/g, "/").replace(/\n/g, " ").trim();
const fixOf = (c) => (c.suggested_fix ? `${esc(c.suggested_fix.current).slice(0, 90)} → ${esc(c.suggested_fix.proposed).slice(0, 110)}` : "—");
const evOf = (c) => (c.evidence || []).slice(0, 2).map((e) => esc(e.ref)).join("; ");

function bandTable(band, includePersonas = true) {
  const rows = all.filter((c) => c.band === band);
  let md = `| # | Page | Category | Issue | Sev | Personas | Evidence | Suggested Fix |\n|---|------|----------|-------|-----|----------|----------|---------------|\n`;
  rows.forEach((c, i) => {
    md += `| ${i + 1} | ${esc(c.page).slice(0, 45)} | ${esc(c.category)} | ${esc(c.finding).slice(0, 220)} | ${c.severity} | ${c.personaCount}/15 | ${evOf(c).slice(0, 80)} | ${fixOf(c)} |\n`;
  });
  return md;
}

// category breakdown
const cats = {};
for (const c of all) (cats[c.category] = cats[c.category] || []).push(c);

// scores
const scores = JSON.parse(fs.readFileSync(D + "scores.json", "utf8"));
const pageAgg = {};
for (const [p, d] of Object.entries(scores)) for (const [r, s] of Object.entries(d.pages)) (pageAgg[r] = pageAgg[r] || []).push({ p, s });
const avg = (a) => Math.round((a.reduce((x, y) => x + y.s, 0) / a.length) * 10) / 10;
let pageTable = `| Page | Avg | n | Min | Max | Lowest Persona | Highest Persona |\n|------|-----|---|-----|-----|----------------|------------------|\n`;
Object.entries(pageAgg)
  .filter(([, a]) => a.length >= 3)
  .sort((a, b) => avg(a[1]) - avg(b[1]))
  .forEach(([r, a]) => {
    const mn = a.reduce((m, x) => (x.s < m.s ? x : m)), mx = a.reduce((m, x) => (x.s > m.s ? x : m));
    pageTable += `| ${r} | ${avg(a)} | ${a.length} | ${mn.s} | ${mx.s} | ${mn.p.replace(/^\d+-/, "")} | ${mx.p.replace(/^\d+-/, "")} |\n`;
  });

const catSection = Object.entries(cats)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([cat, items]) => {
    const top = items.sort((a, b) => a.band.localeCompare(b.band) || b.personaCount - a.personaCount).slice(0, 8);
    return `### ${cat} (${items.length} issues)\n\n${top.map((c) => `- **[${c.band}]** ${esc(c.page).slice(0, 40)} — ${esc(c.finding).slice(0, 170)} *(${c.personaCount} personas)*`).join("\n")}${items.length > 8 ? `\n- …and ${items.length - 8} more (see final-findings.json)` : ""}`;
  })
  .join("\n\n");

const report = `# UX Persona Review

App: Vendingpreneurs (vending-website) — public marketing site + admin content studio
URL: http://localhost:3000 (dev server; custom domain not yet cut over)
Date: 2026-06-10
Pages tested: 28 | Journeys executed: 8 | Interactions: ~340 | Screenshots: 254
Personas: 15 | Verifiers: 3 (all P0/P1 findings evidence-checked, several root-caused to source)

---

## Executive Summary

- Total unique issues (after dedup + verification folds): **${all.length}**
- **P0 Critical: ${counts.P0}** | **P1 High: ${counts.P1}** | P2 Medium: ${counts.P2} | P3 Low: ${counts.P3}
- Blockers: 3 | Discarded in verification: 1 (plus 8 duplicate clusters folded into verified parents)
- Average overall gut feel: **2.6 / 5** (range 2.0 accessibility/skeptic/angry-user → 3.5 executive)

The site is visually strong and structurally sound — semantic landmarks, labelled form fields, real legal pages, and an admin page-builder that genuinely impressed the competitor persona. But the single most important moment on the public site (submitting an application) ends in a whisper: a small line of green text, no redirect, no cleared form — 13 of 15 personas flagged it, and the exploration bot itself resubmitted 6 times because it couldn't tell it had succeeded. In the admin studio, the Blog/News CMS is invisible: the nav item exists in code but is never rendered. And for a business asking people to invest thousands, there is no human contact channel anywhere — no phone, no email, forms only.

---

## Journey Results

| Journey | Status | Avg Score | Biggest Friction Point |
|---------|--------|-----------|------------------------|
| Discover & Apply | completed-with-friction | 2.3/5 (n=12) | Success state is a tiny inline message; no redirect to the existing /thank-you-for-applying page; form stays filled and enabled |
| Contact the Team | blocked (safety: send skipped) | 2.5/5 (n=11) | Contact is footer-only (not in header nav); page offers a form and nothing else |
| Read a News Article | completed | 2.8/5 (n=11) | Nav says NEWS, page says BLOG; one card thumbnail rendered broken (no image fallback) |
| Evaluate Trust | completed | 3.0/5 (n=11) | Pages all reachable, but hero stats can read "0+ / $0M+ / 0+" and no pricing exists anywhere |
| Pre-Call Resources | completed | 3.4/5 (n=11) | Solid; links-only (no embedded media) |
| Admin: Create News Draft | completed-with-friction | 2.0/5 (n=3) | News CMS unreachable from sidebar — flow only works by typing /admin/news |
| Admin: Create SEO Page | completed-with-friction | ~2.4/5 (n=3) | Quick Tour overlay covers the panel it explains; wizard works, draft persisted |
| Admin: Ops Walkthrough | completed-with-friction | 2.6/5 (n=6) | Redirects manager has zero inbound links; Libraries only via Media page |

**Verdict:** Every public journey is completable, but the two conversion journeys (apply, contact) leak trust at the exact moment of commitment. Both admin creation flows work end-to-end once you know the URLs — discoverability, not capability, is the studio's problem.

---

## Blockers

| # | Page/Feature | What's Broken | Personas |
|---|-------------|----------------|----------|
| 1 | /apply submit | Success is one small green line ("Thanks. We received your details and will follow up shortly."); no redirect, form stays filled/enabled. Server-side dedupe is the only thing preventing duplicate leads. | 13/15 |
| 2 | Admin sidebar | Blog/News CMS not rendered in nav. Root cause found: \`blogSection\` is defined in src/components/admin/AdminShell.tsx:28-35 but never included in \`contentSections\` (line 36). One-line fix. | betty, marcus, mike + journey evidence |
| 3 | Site-wide contact | No phone or email anywhere (footer has nav links only; /contact is form-only; support@vendingpreneurs.com exists but only buried inside /terms). | karen, rachel, tom + verified |

---

## P0 — Critical (${counts.P0})

${bandTable("P0")}

## P1 — High Priority (${counts.P1})

${bandTable("P1")}

## P2 — Medium Priority (${counts.P2})

${bandTable("P2")}

## P3 — Low Priority (${counts.P3})

${bandTable("P3")}

---

## Page-by-Page Gut Feel (pages scored by ≥3 personas)

${pageTable}
Admin pages were scored by fewer personas in parseable form; per-persona admin commentary is in the individual reviews (personas/).

---

## Category Breakdown

${catSection}

---

## Persona Highlights

| Persona | Findings | Gut Feel | Most Concerned About |
|---------|----------|----------|----------------------|
| Betty (grandparent) | 21 | 2.5 | Can't tell the application worked; "0+" stats look broken |
| Marcus (power user) | 24 | 3.0 | Invisible success states, zero keyboard shortcuts, forced tour |
| Sam (first-timer) | 14 | 3.0 | Value prop lands in 5s (rare praise) but "0+" stats nearly made him bounce |
| David (accessibility) | 18 | 2.0 | Video tab stops with no focus indicator; no skip link; contrast failures on stats/errors |
| Yuki (non-native) | 20 | 3.0 | Idiom-heavy copy ("escape the rat race"); vague success message; NEWS/BLOG mismatch |
| Rachel (skeptic) | 17 | 2.0 | Headline proof reads zero; no price anywhere; single first-name founder |
| Jake (mobile) | 12 | 2.5 | Horizontal scroll on 3 pages at 375px; article H1 overflows; invisible mobile confirmation |
| Claire (perfectionist) | 22 | 2.5 | Two unrelated design systems (brutalist public vs generic SaaS admin) |
| Tom (pragmatist) | 11 | 2.5 | "STEP INSIDE" says nothing; no price, no phone, zeros in the headline |
| Zoe (teenager) | 12 | 2.5 | "Talks like a LinkedIn ad"; long form; broken image on news |
| Priya (business owner) | 18 | 2.5 | Apply requires budget/timeline decisions she hasn't made; can't tell it worked |
| Alex (developer) | 18 | 2.5 | Image-optimizer 500, CLS 0.263, native-only validation, dual error pages |
| Victoria (executive) | 14 | 3.5 | Admin studio "genuinely excellent"; homepage proof block reads zero at a glance |
| Mike (competitor) | 24 | 3.0 | Editor rivals Webflow; split CMSes with no nav bridge; missing bulk ops |
| Karen (angry user) | 18 | 2.0 | No human contact channel anywhere; recovery paths dead-end into the same form |

---

## Skipped Destructive Actions (safety policy)

59 elements were intentionally not actioned. Categories: outbound share links (X/LinkedIn/Facebook on every article), "SEND MESSAGE" on /contact (outbound email), "Sign out" (until end), "Publish" buttons in admin (would go live publicly), "Invite user"/password-email actions in settings (outbound email to real users), file-upload controls (no fixture). Destructive actions WERE performed on session-created records: the test news draft was archived via the editor's Archive button (confirmation flow worked).

Full list: exploration-log.md § "Skipped destructive actions".

---

## Discarded in Verification

| Finding | Why Discarded |
|---------|---------------|
| "/news cards are scroll-reveal animated and render as empty boxes until scrolled" (C024) | Wrong mechanism: NewsList is a server component with no animation; cards render fully server-side. The "blank cards" observation was image-load latency in dev plus one genuinely failed thumbnail — that residue is tracked as the image-fallback finding (C030). |

Also demoted with corrected root causes: hero "0+" stats (real values 500+/$3M+/3,000+ exist; count-up animation has no SSR fallback — C076), pages-list row actions ("⋮" menu is a native \`<details>\` that automation couldn't open; Duplicate/Archive DO exist — C138 → P3), news thumbnail 500 (transient upstream; host already whitelisted; missing onError fallback — C030).

---

## Session Artifacts & Cleanup Notes

- Test lead row in \`lead_submissions\`: **test+ux-review-1781052054170@example.com** (form_type=apply) — left in DB (delete manually if unwanted; matches earlier smoke-test rows).
- News draft "UX Review Test 1781052712783" — **archived** via the admin UI.
- SEO page draft "UX Review Test Page 1781052712783" (/resources/ux-review-test-1781052712783) — **still in /admin/pages as a draft**; archive it via the row ⋮ menu. (No archive control exists inside the editor — that's finding-worthy in itself.)

---

## Next Steps

1. Review P0s — all three are cheap fixes with outsized impact (redirect to /thank-you-for-applying; add \`blogSection\` to \`contentSections\` in AdminShell.tsx; put an email/phone in the footer).
2. Run \`/grill-me\` on this report to interview through fix priorities.
3. Implement via \`/safe-feature-slice\` or \`/feature-orchestrator\` depending on scope.

Raw data: consolidated-findings.json (machine-readable, all ${all.length} issues), final-findings.json (verified), personas/*.md (15 narrative reviews), journeys.md (canonical journey verdicts), exploration-log.md, axe-results.json, screenshots/ (254 files), text/ (28 extracts).
`;

fs.writeFileSync(D + "UX-REVIEW.md", report);
console.log("REPORT WRITTEN:", counts, "total", all.length, "discarded", discarded.length);
