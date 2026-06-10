// Build a self-contained, plain-English HTML version of the UX review.
import fs from "node:fs";

const D = "reports/ux-persona-review/";
const SEV_RANK = { blocker: 5, critical: 4, high: 3, medium: 2, low: 1 };
let all = JSON.parse(fs.readFileSync(D + "final-findings.json", "utf8"));

// same folds as the markdown report
const FOLD = { C005: "C030", C044: "C030", C009: "C030", C070: "C076", C002: "C076", C021: "C007", C042: "C014", C022: "C006" };
const byId = Object.fromEntries(all.map((c) => [c.cid, c]));
for (const [src, dst] of Object.entries(FOLD)) {
  const s = byId[src], d = byId[dst];
  if (!s || !d || s.__discarded) continue;
  d.personas = [...new Set([...(d.personas || []), ...(s.personas || [])])];
  d.personaCount = d.personas.length;
  s.__folded = dst;
}
all = all.filter((c) => !c.__discarded && !c.__folded);
for (const c of all) {
  const s = c.severity, f = c.personaCount;
  c.band = s === "blocker" || (s === "critical" && f >= 5) ? "P0" : s === "critical" || (s === "high" && f >= 5) ? "P1" : s === "high" || (s === "medium" && f >= 3) ? "P2" : "P3";
}
all.sort((a, b) => a.band.localeCompare(b.band) || SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.personaCount - a.personaCount);
const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
all.forEach((c) => counts[c.band]++);

const escH = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const img64 = (file) => {
  try {
    return `data:image/png;base64,${fs.readFileSync(D + "screenshots/" + file).toString("base64")}`;
  } catch {
    return null;
  }
};
const figure = (file, caption) => {
  const src = img64(file);
  return src ? `<figure><img src="${src}" alt="${escH(caption)}" loading="lazy"><figcaption>${escH(caption)}</figcaption></figure>` : "";
};

const sevChip = (s) => `<span class="chip sev-${s}">${s}</span>`;
const row = (c, i) =>
  `<tr><td>${i + 1}</td><td class="page">${escH(c.page).slice(0, 50)}</td><td>${escH(c.category).replace(" & ", " &amp; ")}</td><td>${escH(c.finding)}${c.suggested_fix ? `<div class="fix"><strong>Fix:</strong> ${escH(c.suggested_fix.proposed).slice(0, 200)}</div>` : ""}</td><td>${sevChip(c.severity)}</td><td class="num">${c.personaCount}</td></tr>`;
const table = (band) =>
  `<table><thead><tr><th>#</th><th>Where</th><th>Type</th><th>Issue &amp; suggested fix</th><th>Severity</th><th>Found&nbsp;by</th></tr></thead><tbody>${all
    .filter((c) => c.band === band)
    .map(row)
    .join("")}</tbody></table>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vendingpreneurs — UX Review (10 June 2026)</title>
<style>
  :root{--ink:#1a2230;--soft:#5b6575;--line:#e4e8ee;--bg:#fafbfc;--card:#fff;
    --p0:#c62828;--p1:#e65100;--p2:#b8860b;--p3:#607d8b;--good:#1b7f4d;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
  main{max-width:880px;margin:0 auto;padding:48px 24px 96px;}
  h1{font-size:2rem;line-height:1.2;margin:0 0 4px}
  h2{font-size:1.45rem;margin:56px 0 12px;padding-top:24px;border-top:1px solid var(--line)}
  h3{font-size:1.1rem;margin:28px 0 8px}
  p,li{color:var(--ink)} .muted{color:var(--soft)}
  .statgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:28px 0}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
  .stat b{display:block;font-size:1.7rem;line-height:1.2}
  .stat span{color:var(--soft);font-size:.85rem}
  .chip{display:inline-block;padding:2px 10px;border-radius:99px;font-size:.75rem;font-weight:600;color:#fff;white-space:nowrap}
  .sev-blocker{background:var(--p0)} .sev-critical{background:var(--p1)} .sev-high{background:#bf6900}
  .sev-medium{background:var(--p2)} .sev-low{background:var(--p3)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin:18px 0}
  .card.p0{border-left:5px solid var(--p0)} .card.p1{border-left:5px solid var(--p1)}
  .card h3{margin-top:0}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:.9rem;margin:14px 0}
  th{background:#f1f4f8;text-align:left;padding:10px 12px;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:var(--soft)}
  td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:top}
  td.page{font-family:ui-monospace,Menlo,monospace;font-size:.8rem;white-space:nowrap}
  td.num{text-align:center}
  .fix{margin-top:6px;color:var(--good);font-size:.85rem}
  figure{margin:18px 0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
  figure img{display:block;width:100%;height:auto}
  figcaption{padding:10px 14px;font-size:.83rem;color:var(--soft);border-top:1px solid var(--line)}
  details{margin:16px 0;border:1px solid var(--line);border-radius:12px;background:var(--card)}
  summary{cursor:pointer;padding:16px 20px;font-weight:600;font-size:1.05rem}
  details > div{padding:0 20px 16px}
  .journey{display:flex;gap:14px;align-items:baseline;margin:10px 0;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:12px}
  .journey .score{font-weight:700;font-size:1.15rem;min-width:54px}
  .ok{color:var(--good)} .warn{color:var(--p1)} .bad{color:var(--p0)}
  blockquote{margin:10px 0;padding:10px 16px;border-left:4px solid var(--line);color:var(--soft);font-style:italic}
  code{background:#eef1f5;border-radius:5px;padding:1px 6px;font-size:.85em;font-family:ui-monospace,Menlo,monospace}
  .toc{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 22px;margin:24px 0}
  .toc a{color:#0b5cad;text-decoration:none} .toc a:hover{text-decoration:underline}
</style>
</head>
<body><main>

<h1>Vendingpreneurs — UX Review</h1>
<p class="muted">10 June 2026 · Local dev build · The whole site was tested by automation, then reviewed by 15 simulated users — from a 78-year-old grandparent to a screen-reader user to an impatient developer. Every serious finding was double-checked against screenshots and the actual code before it made this report.</p>

<div class="statgrid">
  <div class="stat"><b>28</b><span>pages tested</span></div>
  <div class="stat"><b>8</b><span>user journeys walked</span></div>
  <div class="stat"><b>254</b><span>screenshots taken</span></div>
  <div class="stat"><b>143</b><span>unique issues found</span></div>
  <div class="stat"><b class="bad">3</b><span>must-fix (P0)</span></div>
  <div class="stat"><b>2.6<span style="font-size:1rem">/5</span></b><span>average "gut feel"</span></div>
</div>

<div class="toc"><strong>Jump to:</strong> &nbsp;<a href="#big">The big picture</a> · <a href="#journeys">Can people actually use it?</a> · <a href="#p0">Fix these first</a> · <a href="#p1">Fix these next</a> · <a href="#rest">Everything else</a> · <a href="#pages">Page report card</a> · <a href="#personas">What each reviewer said</a> · <a href="#cleanup">Housekeeping</a></div>

<h2 id="big">The big picture</h2>
<p>The good news: the site looks professional, the pages all load, the legal pages are real, and the admin page-builder genuinely impressed the reviewer who compares everything to Webflow. Nobody hit a dead end on the main public paths.</p>
<p>The bad news comes down to three themes:</p>
<ol>
<li><strong>The most important moment on the site is silent.</strong> When someone submits an application — the entire point of the site — the only feedback is one small line of green text next to the button. The form stays filled in, the button stays clickable, and there's no new page. 13 of the 15 reviewers flagged it. Even our testing robot couldn't tell it had worked and submitted the same application six times. (Only one lead was recorded, so your server-side duplicate protection works — but real people will also click twice, or walk away thinking it failed.)</li>
<li><strong>There's no human to reach.</strong> No phone number or email address anywhere — not in the footer, not on the contact page. Everything funnels into a web form. For a business asking people to invest thousands of dollars, several reviewers said this alone would stop them.</li>
<li><strong>Good things are hidden.</strong> The admin's Blog/News section exists and works — but its menu item never shows up in the sidebar, so you can only get there by typing the address. (We found the exact cause: it's literally one line of code that defines the menu item but never adds it to the menu.) Same story for the Redirects manager, which nothing links to at all.</li>
</ol>

<h2 id="journeys">Can people actually use it? (the 8 journeys)</h2>
<p>Each journey is a real task a user would attempt, walked step by step using only what's visible on screen. Scores are averaged across the reviewers (1 = hostile, 5 = excellent).</p>

<div class="journey"><span class="score warn">2.3</span><div><strong>Find the site &amp; apply</strong> — Works, but ends in the silent confirmation described above. There's even a ready-made "thank you for applying" page in the codebase that the form never sends people to.</div></div>
<div class="journey"><span class="score warn">2.5</span><div><strong>Contact the team</strong> — The form fills in fine (we didn't actually send, to avoid emailing you). But "Contact Us" only exists as a small footer link — it's not in the top menu — and the page offers a form and nothing else.</div></div>
<div class="journey"><span class="score warn">2.8</span><div><strong>Read a news article</strong> — Works. Two oddities: the menu says <em>NEWS</em> but the page is titled <em>BLOG</em>, and one article thumbnail showed up as a broken image during testing.</div></div>
<div class="journey"><span class="score ok">3.0</span><div><strong>Check the company out before committing</strong> — About, case studies, privacy and terms are all reachable and real. Two trust dents: the headline stats can show as "0+" (more below), and there's no price anywhere on the site.</div></div>
<div class="journey"><span class="score ok">3.4</span><div><strong>Pre-call resources</strong> — The best journey. Loads fine, clear heading, 14 working links.</div></div>
<div class="journey"><span class="score warn">2.0</span><div><strong>Admin: write a news draft</strong> — The flow itself works end-to-end (create → save → appears in list). But you can only find it by typing <code>/admin/news</code>, because the sidebar menu item is missing.</div></div>
<div class="journey"><span class="score warn">2.4</span><div><strong>Admin: build an SEO page</strong> — The 3-step wizard and editor work, and the draft saved properly. Friction: a "Quick Tour" pop-up covers the very panel it's explaining, and we couldn't find any way to archive or delete a page from inside the editor.</div></div>
<div class="journey"><span class="score warn">2.6</span><div><strong>Admin: find your way around</strong> — Media library and Settings are in the sidebar. The Redirects manager and content Libraries are not — they're orphaned or buried.</div></div>

<h2 id="p0">Fix these first (3 must-fix issues)</h2>

<div class="card p0">
<h3>1. Applying feels like shouting into the void ${sevChip("blocker")}</h3>
<p><strong>Flagged by 13 of 15 reviewers.</strong> After clicking SUBMIT APPLICATION, the only confirmation is the small green line you can see below — easy to miss entirely. The form keeps all its values and the button stays active, inviting double-submits.</p>
<p><strong>The fix is easy:</strong> after a successful submit, send people to the <code>/thank-you-for-applying</code> page that already exists in the site (or show a big, obvious success banner and clear the form).</p>
${figure("journey-discover-and-apply-004-04-submit-continue-round-1-.png", "After submitting: the green text beside the button is the entire confirmation. No redirect, form still filled, button still active.")}
</div>

<div class="card p0">
<h3>2. The admin's Blog/News section is invisible ${sevChip("blocker")}</h3>
<p>The Blog/News CMS works fine — but its sidebar menu item never appears, so the whole section is unreachable unless you type <code>/admin/news</code> by hand.</p>
<p><strong>We found the exact cause:</strong> in <code>src/components/admin/AdminShell.tsx</code>, the menu item (<code>blogSection</code>) is defined but never added to the menu list (<code>contentSections</code>). Adding it is a one-line change.</p>
${figure("journey-admin-create-news-draft-s02-02-look-for-news-in-studio-nav.png", "The studio sidebar: only 'SEO pages' and 'Media library' under CONTENT — no Blog/News anywhere.")}
</div>

<div class="card p0">
<h3>3. There's no way to reach a human ${sevChip("blocker")}</h3>
<p>No phone number or email anywhere on the site. The footer has only navigation links; the contact page has only the form. The address <code>support@vendingpreneurs.com</code> does exist — but only buried inside the Terms page. The "angry customer" reviewer called this a wall; the skeptical-buyer reviewer said it's the kind of thing that makes a company look like it doesn't want to be found.</p>
<p><strong>The fix:</strong> put the support email (and a phone number if you have one) in the footer and on the contact page.</p>
</div>

<h2 id="p1">Fix these next (7 high-priority issues)</h2>

<div class="card p1"><h3>The apply form asks for decisions people haven't made ${sevChip("critical")}</h3>
<p>"Business stage", "Available startup budget" and "Launch timeline" are all <em>required</em>. Someone who's just curious — which is most applicants — is forced to invent answers or give up. Make them optional, or add "Not sure yet" options.</p></div>

<div class="card p1"><h3>The menu says NEWS, the page says BLOG ${sevChip("high")}</h3>
<p>Flagged by 13 reviewers. You click <em>NEWS</em> in the menu and land on a page shouting <em>BLOG</em> — several reviewers' first thought was "did I click the wrong thing?" The breadcrumbs on articles also say Blog, and in the admin it's called "Blog CMS". Pick one name and use it everywhere.</p></div>

<div class="card p1"><h3>The headline numbers can read as zero ${sevChip("high")}</h3>
<p>Your proof stats are real — 500+ entrepreneurs, $3M+ sales, 3,000+ locations — but they're revealed by a count-up animation that only starts when scrolled into view. Until then (and permanently for search engines, link previews, and anyone whose JavaScript hiccups) the page literally says <strong>"0+ entrepreneurs launched · $0M+ sales · 0+ locations"</strong>. The skeptical reviewer called it "the most damaging thing on the site: your headline evidence is zero." Render the real numbers first and let the animation be a bonus, not a requirement.</p>
${figure("home-002-full.png", "The homepage as captured: note the stat block showing 0+ / $0M+ / 0+ before the animation fires.")}
</div>

<div class="card p1"><h3>No Contact link in the top menu ${sevChip("high")}</h3>
<p>11 reviewers looked for Contact in the header (About · Resources · Case Studies · News) and didn't find it. It only lives in the footer. Add it to the top menu.</p></div>

<div class="card p1"><h3>Form errors are browser pop-up bubbles only ${sevChip("high")}</h3>
<p>Submit the apply form empty and you get the browser's default "Please fill out this field" bubble on one field at a time — which vanishes in a second, can point at an off-screen field, and is never read out properly to screen-reader users. The form already has custom error styling built; it just never triggers on an empty submit. Show real inline messages under each field.</p></div>

<div class="card p1"><h3>The page-builder's welcome tour covers what it's pointing at ${sevChip("high")}</h3>
<p>First time you open the editor, a "Quick Tour" pop-up appears on top of the exact panel it's describing, and you can't touch anything until you dismiss it. Reposition the tour card beside (not over) its target.</p></div>

<div class="card p1"><h3>The Redirects manager is unreachable ${sevChip("high")}</h3>
<p>The page at <code>/admin/pages/redirects</code> works, but nothing anywhere links to it — we searched every admin screen. Anyone who doesn't know the URL doesn't know it exists. Add a link from the SEO pages screen or the sidebar.</p></div>

<h2 id="rest">Everything else</h2>
<p>These are real but smaller: visual polish, wording, accessibility contrast, mobile niggles. Open each section to read through.</p>

<details><summary>Medium priority — ${counts.P2} issues (worth scheduling)</summary><div>
<p class="muted">Highlights: the homepage side-scrolls on small phones; an article headline overflows the screen at phone width; news thumbnails have no fallback if an image fails (one did during testing); the homepage visibly jumps as it loads (layout-shift score 0.26 — Google's "good" bar is 0.10); the testimonial videos can't be seen by keyboard users (no focus outline); legacy <code>/blog/…</code> links show a 404 instead of redirecting to the same article at <code>/news/…</code>; the stat labels fail color-contrast guidelines; "STEP INSIDE" doesn't say what the button does (it's the apply button).</p>
${table("P2")}
</div></details>

<details><summary>Low priority — ${counts.P3} issues (polish &amp; nice-to-haves)</summary><div>
${table("P3")}
</div></details>

<h2 id="pages">Page report card</h2>
<p>Average "gut feel" score per page across reviewers (1–5). Anything under 3 felt confusing or unfinished to most reviewers.</p>
<table><thead><tr><th>Page</th><th>Average</th><th>Reviewers</th><th>Range</th></tr></thead><tbody>
<tr><td class="page">/ (homepage)</td><td><strong>2.2</strong></td><td class="num">11</td><td>2 – 3</td></tr>
<tr><td class="page">/news</td><td><strong>2.3</strong></td><td class="num">11</td><td>2 – 3</td></tr>
<tr><td class="page">/contact</td><td><strong>2.4</strong></td><td class="num">8</td><td>1 – 3</td></tr>
<tr><td class="page">/apply</td><td><strong>2.5</strong></td><td class="num">11</td><td>2 – 3</td></tr>
<tr><td class="page">404 page</td><td><strong>2.5</strong></td><td class="num">4</td><td>2 – 4</td></tr>
<tr><td class="page">/case-studies</td><td><strong>2.8</strong></td><td class="num">5</td><td>2 – 3</td></tr>
</tbody></table>
<p class="muted">The admin studio scored higher with the reviewers who assessed it in depth — the executive reviewer called it "genuinely excellent" — its problems are findability, not quality.</p>

<h2 id="personas">What each reviewer cared about most</h2>
<table><thead><tr><th>Reviewer</th><th>Gut feel</th><th>Their #1 issue</th></tr></thead><tbody>
<tr><td>Betty, 78 — cautious beginner</td><td class="num">2.5</td><td>"I can't tell my application worked."</td></tr>
<tr><td>Marcus, 34 — impatient power user</td><td class="num">3.0</td><td>Invisible success states; zero keyboard shortcuts; forced tour.</td></tr>
<tr><td>Sam, 28 — first-time visitor</td><td class="num">3.0</td><td>Got the value proposition in 5 seconds (rare praise) — then nearly bounced at the "0+" stats.</td></tr>
<tr><td>David, 45 — screen-reader &amp; keyboard user</td><td class="num">2.0</td><td>Video tiles trap keyboard focus with no visible outline; no skip-link; low-contrast text.</td></tr>
<tr><td>Yuki, 31 — English as a second language</td><td class="num">3.0</td><td>Idioms everywhere ("escape the rat race"); vague success message.</td></tr>
<tr><td>Rachel, 42 — skeptical buyer</td><td class="num">2.0</td><td>Headline proof reads zero; no price anywhere on the site.</td></tr>
<tr><td>Jake, 22 — phone-only user</td><td class="num">2.5</td><td>Three pages side-scroll on a phone; confirmation invisible on mobile.</td></tr>
<tr><td>Claire, 37 — design perfectionist</td><td class="num">2.5</td><td>Public site and admin look like two unrelated products.</td></tr>
<tr><td>Tom, 50 — no-nonsense tradesman</td><td class="num">2.5</td><td>"STEP INSIDE" says nothing; no price, no phone, zeros in the headline.</td></tr>
<tr><td>Zoe, 16 — digital native</td><td class="num">2.5</td><td>"Talks like a LinkedIn ad"; long form; broken image.</td></tr>
<tr><td>Priya, 39 — overwhelmed business owner</td><td class="num">2.5</td><td>Form demands budget/timeline decisions she hasn't made.</td></tr>
<tr><td>Alex, 29 — judgmental developer</td><td class="num">2.5</td><td>Image-server error, layout jumping, browser-only validation.</td></tr>
<tr><td>Victoria, 55 — executive, 30 seconds</td><td class="num">3.5</td><td>Loved the admin studio; the homepage proof block reads zero at a glance.</td></tr>
<tr><td>Mike, 33 — switching from a competitor</td><td class="num">3.0</td><td>Editor rivals Webflow; but two disconnected CMSes and no bulk actions.</td></tr>
<tr><td>Karen, 47 — already angry</td><td class="num">2.0</td><td>"You cannot phone anyone, you cannot email anyone."</td></tr>
</tbody></table>

<h2 id="cleanup">Housekeeping &amp; what we deliberately didn't do</h2>
<ul>
<li>For safety, we never sent the contact form (it would email you), never clicked Publish (it would put test content live), never touched real users in Settings, and never deleted anything we didn't create ourselves.</li>
<li>Two clearly-labelled test records remain for you to remove: a test lead in the database (<code>test+ux-review-1781052054170@example.com</code>) and a draft page called <strong>"UX Review Test Page 1781052712783"</strong> in the admin pages list (archive it via the row's ⋮ menu). A test news draft was already archived through the admin UI.</li>
<li>One finding was thrown out during fact-checking (the news cards aren't animation-hidden — that was a slow image in dev), and a few were softened after we traced the real cause in the code (e.g. the "0+" stats and the pages-list row menu, which actually does contain Duplicate and Archive).</li>
</ul>

<h2>Suggested next step</h2>
<p>The three must-fixes are all small: redirect the apply form to the thank-you page, add the one-line sidebar menu item, and put an email address in the footer. After that, the high-priority seven are mostly copy and form-behaviour changes. Full machine-readable data and all 254 screenshots live in <code>reports/ux-persona-review/</code>.</p>

<p class="muted" style="margin-top:48px">Generated 10 June 2026 · 15 persona reviews, 3 independent fact-checking passes · vending-website</p>
</main></body></html>`;

fs.writeFileSync(D + "ux-review.html", html);
console.log("HTML written:", (fs.statSync(D + "ux-review.html").size / 1024 / 1024).toFixed(2), "MB");
