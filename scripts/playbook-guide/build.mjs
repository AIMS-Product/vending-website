// Renders the LTF V2 $5 PDF ("The First Location Playbook") from
// src/lib/content/playbook-guide.ts, plus the page previews the offer page
// shows. Usage (needs network for fonts + YouTube thumbnails):
//   node scripts/playbook-guide/build.mjs            # build only
//   node --env-file=.env.local scripts/playbook-guide/build.mjs --upload
// The PDF is the paid product: it is written OUTSIDE public/ (gitignored
// scripts/playbook-guide/out/) and served only from the private
// `ltf-playbook` storage bucket. --upload puts it there as PLAYBOOK_PDF_OBJECT.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import {
  GUIDE,
  firstThirtyDays,
  guideOffer,
  plays,
} from "../../src/lib/content/playbook-guide.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const outDir = `${root}scripts/playbook-guide/out`;
const previewDir = `${root}public/images/playbook-guide`;
const SITE = "https://www.vendingpreneurs.com";
/** Pages rendered as offer-page images: cover, Play 03, Play 05, Play 06. */
const PREVIEW_PAGES = [1, 5, 7, 8];

const esc = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const wordmark = `data:image/png;base64,${(await readFile(`${root}public/brand/wordmark.png`)).toString("base64")}`;
const mike = `data:image/webp;base64,${(await readFile(`${root}public/images/playbook/mike-family.webp`)).toString("base64")}`;

const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

function runningHead(label) {
  return `<div class="run"><img src="${wordmark}" alt="Vendingpreneurs"><span>${esc(label)}</span></div>`;
}
function foot(n) {
  return `<div class="foot"><span><b>${esc(GUIDE.title)}</b> · ${esc(GUIDE.byline)}</span><span>${n}</span></div>`;
}

function playPage(play, pageNo) {
  const script = play.script
    ? `<div class="script"><span class="who">${esc(play.script.label)}</span>${play.script.lines
        .map((l) => `<p>${esc(l)}</p>`)
        .join("")}</div>`
    : "";
  return `<section class="page">
  ${runningHead(`Play ${play.number}`)}
  <div class="playhead"><span class="num">${play.number}</span><h2>${esc(play.title)}</h2></div>
  <p class="why">${esc(play.why)}</p>
  <div class="cols">
    <div>
      <h3>The play</h3>
      <ul class="ticks">${play.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      ${script}
    </div>
    <div>
      <h3>Watch first</h3>
      <a class="video" href="${watchUrl(play.video.id)}">
        <span class="thumb"><img src="https://i.ytimg.com/vi/${play.video.id}/hqdefault.jpg" alt=""><span class="playbtn"></span></span>
        <span class="vt">${esc(play.video.title)}</span>
        <span class="vm">Mike on YouTube · ${esc(play.video.minutes)} · tap to watch</span>
      </a>
      <div class="assign">
        <span class="k">Your assignment</span>
        <h4>${esc(play.assignment.title)}</h4>
        <ul>${play.assignment.tasks.map((t) => `<li><span class="box"></span>${esc(t)}</li>`).join("")}</ul>
        <p class="done">Done? Move to the next play.</p>
      </div>
    </div>
  </div>
  <blockquote class="quote"><p>&ldquo;${esc(play.quote.text)}&rdquo;</p><cite>${esc(play.quote.who)}</cite></blockquote>
  ${foot(pageNo)}
</section>`;
}

const cover = `<section class="page cover">
  <img class="logo" src="${wordmark}" alt="Vendingpreneurs">
  <div class="cover-body">
    <p class="eyebrow">${esc(GUIDE.byline)}&rsquo;s</p>
    <h1>The First<br><span class="hl">Location</span><br>Playbook</h1>
    <p class="sub">${esc(GUIDE.subtitle)}</p>
    <ul class="chips"><li>8 plays</li><li>8 videos</li><li>8 assignments</li><li>Scripts + contract terms</li></ul>
  </div>
  <div class="inside"><span class="k">Inside</span><ol>${plays
    .map((p) => `<li><span class="n">${p.number}</span>${esc(p.title)}</li>`)
    .join("")}</ol></div>
  <div class="cover-foot"><img src="${mike}" alt=""><div><b>${esc(GUIDE.byline)}</b><span>Founder, Vendingpreneurs</span></div></div>
</section>`;

const howTo = `<section class="page">
  ${runningHead("Start here")}
  <h2>How to use this playbook</h2>
  <ol class="how">
    <li><b>One play at a time, in order.</b> Each play builds on the last. Location comes before the machine.</li>
    <li><b>Watch the video first.</b> Every play links to the video where Mike (or Anthony) walks through it. Tap the thumbnail.</li>
    <li><b>Do the assignment before you move on.</b> Reading isn't the work. The assignment is.</li>
  </ol>
  <h3>The eight plays</h3>
  <ol class="toc">${plays
    .map((p, i) => `<li><span class="n">${p.number}</span><span><b>${esc(p.title)}</b><br>${esc(p.summary)}</span><span class="pg">${i + 3}</span></li>`)
    .join("")}</ol>
  <p class="fine">${esc(guideOffer.disclaimer)}</p>
  ${foot(2)}
</section>`;

const worksheet = `<section class="page">
  ${runningHead("Worksheet · Play 03")}
  <h2>Your 25 targets</h2>
  <p class="why">Fill one row per location. Star your top 5 (longest hours, most people on site) and pop in to those first.</p>
  <table class="sheet"><thead><tr><th>#</th><th>Location</th><th>Type</th><th>Decision-maker</th><th>Phone / email</th><th>Touches</th></tr></thead>
  <tbody>${Array.from({ length: 25 }, (_, i) => `<tr><td>${i + 1}</td><td></td><td></td><td></td><td></td><td class="t">○ ○ ○ ○ ○ ○ ○</td></tr>`).join("")}</tbody></table>
  ${foot(plays.length + 3)}
</section>`;

const plan = `<section class="page">
  ${runningHead("Your first 30 days")}
  <h2>Your first 30 days</h2>
  <div class="weeks">${firstThirtyDays.map((w) => `<div class="week"><span class="k">${esc(w.week)}</span><p>${esc(w.focus)}</p></div>`).join("")}</div>
  <div class="cta">
    <span class="k">Want a team in your corner?</span>
    <h4>Book a call with the Vendingpreneurs team</h4>
    <p>Members get coaching, the full contract template and help finding and closing locations.</p>
    <a href="${SITE}/contact?utm_source=playbook-pdf&utm_medium=pdf&utm_campaign=ltf-v2">vendingpreneurs.com/contact</a>
  </div>
  <p class="fine">${esc(guideOffer.disclaimer)}</p>
  ${foot(plays.length + 4)}
</section>`;

const css = `
@page { size: Letter; margin: 0; }
:root { --ink:#111111; --body:#2b2f36; --muted:#5b6270; --b50:#eaf6ff; --b100:#d2ecff; --b200:#b6e1ff; --b500:#3aa5e3; --b600:#2a8fcc; --b700:#1f72a5; --eyebrow:#066a99; }
* { box-sizing: border-box; }
html, body { margin:0; background:#fff; }
body { font-family: Inter, system-ui, sans-serif; color:var(--body); font-size:12.4px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
a { color:inherit; text-decoration:none; }
p { margin:0; }
.page { width:8.5in; height:11in; padding:0.55in 0.62in 0.45in; position:relative; overflow:hidden; break-after:page; display:flex; flex-direction:column; }
.page:last-child { break-after:auto; }
h1,h2,h3,h4 { color:var(--ink); margin:0; }
h2 { font-family: Anton, Impact, sans-serif; font-weight:400; text-transform:uppercase; font-size:34px; line-height:1.02; letter-spacing:.01em; }
h3 { font-size:10px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--eyebrow); margin:16px 0 8px; }
h4 { font-size:15px; font-weight:900; margin:4px 0 6px; }
.run { display:flex; align-items:center; justify-content:space-between; padding-bottom:10px; border-bottom:2px solid var(--ink); margin-bottom:18px; font-size:9.5px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--eyebrow); }
.run img { height:22px; }
.foot { margin-top:auto; padding-top:8px; border-top:2px solid var(--ink); display:flex; justify-content:space-between; font-size:9px; color:var(--muted); }
.foot b { color:var(--ink); }
.playhead { display:flex; align-items:flex-end; gap:14px; }
.playhead .num { font-family:Anton, Impact, sans-serif; font-size:74px; line-height:.8; color:transparent; -webkit-text-stroke:2px var(--ink); }
.why { font-size:13.6px; line-height:1.5; color:var(--ink); margin-top:12px; max-width:6.9in; }
.cols { display:grid; grid-template-columns:1.12fr .88fr; gap:22px; margin-top:4px; }
ul.ticks { list-style:none; padding:0; margin:0; }
ul.ticks li { position:relative; padding:5px 0 5px 22px; border-bottom:1px dashed #c9d3dd; }
ul.ticks li:last-child { border-bottom:0; }
ul.ticks li::before { content:""; position:absolute; left:0; top:8px; width:11px; height:6px; border-left:3px solid var(--b600); border-bottom:3px solid var(--b600); transform:rotate(-45deg); }
.script { margin-top:12px; background:var(--b50); border:2px solid var(--ink); padding:10px 13px; font-size:11.6px; color:var(--ink); }
.script .who { display:block; font-size:9px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--eyebrow); margin-bottom:5px; }
.script p + p { margin-top:5px; }
.video { display:block; border:2px solid var(--ink); background:#fff; box-shadow:5px 5px 0 var(--ink); }
.video .thumb { display:block; position:relative; aspect-ratio:16/9; overflow:hidden; border-bottom:2px solid var(--ink); background:#000; }
.video .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.video .playbtn { position:absolute; left:50%; top:50%; width:54px; height:54px; margin:-27px 0 0 -27px; border-radius:50%; background:var(--b500); border:2px solid var(--ink); }
.video .playbtn::after { content:""; position:absolute; left:21px; top:15px; border-left:16px solid var(--ink); border-top:11px solid transparent; border-bottom:11px solid transparent; }
.video .vt { display:block; padding:9px 11px 2px; font-weight:900; color:var(--ink); font-size:12.4px; line-height:1.3; }
.video .vm { display:block; padding:0 11px 9px; font-size:10px; color:var(--b700); font-weight:700; }
.assign { margin-top:16px; background:var(--ink); color:#fff; padding:12px 14px; box-shadow:5px 5px 0 var(--b500); }
.assign .k { font-size:9px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--b200); }
.assign h4 { color:#fff; }
.assign ul { list-style:none; padding:0; margin:0; }
.assign li { display:flex; gap:9px; padding:4px 0; font-size:11.6px; line-height:1.45; }
.assign .box { flex:none; width:13px; height:13px; border:2px solid #fff; margin-top:2px; }
.assign .done { margin-top:8px; font-size:10px; color:var(--b200); font-weight:700; }
.cover { padding:0; background:#fff; background-image:radial-gradient(#b6e1ff 2px, transparent 2px); background-size:24px 24px; }
.cover .logo { position:absolute; left:.62in; top:.55in; height:34px; }
.cover-body { margin:2.05in .62in 0; background:#fff; border:3px solid var(--ink); box-shadow:10px 10px 0 var(--ink); padding:.42in .45in; }
.cover .eyebrow { font-size:12px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; color:var(--eyebrow); }
.cover h1 { font-family:Anton, Impact, sans-serif; font-weight:400; text-transform:uppercase; font-size:82px; line-height:.98; margin-top:10px; }
.cover .hl { display:inline-block; background:var(--b600); color:#fff; padding:0 .08em; box-shadow:.07em .07em 0 var(--ink); }
.cover .sub { font-size:15px; line-height:1.5; color:var(--ink); margin-top:18px; max-width:5.6in; }
.chips { list-style:none; padding:0; margin:20px 0 0; display:flex; flex-wrap:wrap; gap:8px; }
.chips li { border:2px solid var(--ink); background:var(--b50); padding:5px 10px; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.06em; color:var(--ink); }
.quote { margin:auto 0 14px; padding:16px 20px 16px 64px; position:relative; border:2px solid var(--ink); background:var(--b50); }
.quote::before { content:"“"; position:absolute; left:16px; top:4px; font-family:Anton, Impact, sans-serif; font-size:64px; line-height:1; color:var(--b600); }
.quote p { font-family:Anton, Impact, sans-serif; text-transform:uppercase; font-size:19px; line-height:1.15; color:var(--ink); letter-spacing:.01em; }
.quote cite { display:block; margin-top:6px; font-style:normal; font-size:10px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--eyebrow); }
.inside { margin:.42in .62in 0; background:#fff; border:2px solid var(--ink); padding:12px 16px; }
.inside .k { font-size:9.5px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--eyebrow); }
.inside ol { list-style:none; padding:0; margin:6px 0 0; display:grid; grid-template-columns:1fr 1fr; column-gap:22px; }
.inside li { display:flex; gap:10px; align-items:baseline; padding:4px 0; border-bottom:1px dashed #c9d3dd; font-size:11.6px; font-weight:700; color:var(--ink); }
.inside .n { font-family:Anton, Impact, sans-serif; font-weight:400; font-size:15px; color:var(--b700); }
.cover-foot { position:absolute; left:.62in; bottom:.55in; display:flex; align-items:center; gap:12px; background:#fff; border:2px solid var(--ink); padding:8px 14px 8px 8px; }
.cover-foot img { width:52px; height:52px; object-fit:cover; object-position:top; border:2px solid var(--ink); }
.cover-foot b { display:block; color:var(--ink); font-size:14px; }
.cover-foot span { font-size:11px; color:var(--muted); }
ol.how { padding:0; margin:14px 0 0; list-style:none; counter-reset:h; }
ol.how li { counter-increment:h; position:relative; padding:0 0 12px 44px; font-size:13.4px; color:var(--ink); }
ol.how li::before { content:counter(h); position:absolute; left:0; top:-3px; width:30px; height:30px; border:2px solid var(--ink); background:var(--b500); color:var(--ink); font-weight:900; display:grid; place-items:center; }
ol.toc { list-style:none; padding:0; margin:0; border:2px solid var(--ink); }
ol.toc li { display:grid; grid-template-columns:52px 1fr 28px; gap:10px; align-items:center; padding:8px 12px; border-bottom:2px solid var(--ink); font-size:11.6px; }
ol.toc li:last-child { border-bottom:0; }
ol.toc .n { font-family:Anton, Impact, sans-serif; font-size:30px; color:transparent; -webkit-text-stroke:1.5px var(--ink); }
ol.toc b { color:var(--ink); font-size:12.6px; }
ol.toc .pg { text-align:right; font-weight:900; color:var(--ink); }
.fine { margin-top:14px; font-size:9.5px; color:var(--muted); line-height:1.45; }
table.sheet { width:100%; border-collapse:collapse; margin-top:14px; font-size:10.5px; }
table.sheet th { text-align:left; background:var(--ink); color:#fff; padding:6px 7px; font-size:9px; letter-spacing:.1em; text-transform:uppercase; }
table.sheet td { border:1.5px solid var(--ink); height:21.4px; padding:0 6px; }
table.sheet td:first-child { width:26px; font-weight:900; text-align:center; background:var(--b50); }
table.sheet td.t { width:118px; color:#9aa5b1; letter-spacing:1px; font-size:11px; white-space:nowrap; }
.weeks { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px; }
.week { border:2px solid var(--ink); background:#fff; box-shadow:5px 5px 0 var(--ink); padding:14px; min-height:120px; }
.week .k, .cta .k { font-size:9.5px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--eyebrow); }
.week p { margin-top:8px; font-size:13px; color:var(--ink); }
.cta { margin-top:28px; border:3px solid var(--ink); background:var(--b50); padding:18px 20px; box-shadow:8px 8px 0 var(--b500); }
.cta p { color:var(--ink); }
.cta a { display:inline-block; margin-top:12px; background:var(--b700); color:#fff; border:2px solid var(--ink); padding:9px 14px; font-weight:900; text-transform:uppercase; font-size:12px; }
`;

const pages = [cover, howTo, ...plays.map((p, i) => playPage(p, i + 3)), worksheet, plan];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(GUIDE.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>${css}</style></head><body>${pages.join("\n")}</body></html>`;

await mkdir(outDir, { recursive: true });
await mkdir(previewDir, { recursive: true });
await writeFile(`${outDir}/playbook-guide.html`, html);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  // Fail loudly instead of printing a play cut off at the bottom.
  const overflow = await page.$$eval("section.page", (els) =>
    els.flatMap((el, i) => (el.scrollHeight > el.clientHeight + 1 ? [`page ${i + 1}: ${el.scrollHeight - el.clientHeight}px over`] : [])),
  );
  if (overflow.length) throw new Error(`content overflows:\n${overflow.join("\n")}`);
  const broken = await page.$$eval("img", (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src.slice(0, 80)));
  if (broken.length) throw new Error(`images failed to load:\n${broken.join("\n")}`);

  const pdfPath = `${outDir}/${GUIDE.fileName}`;
  await page.pdf({ path: pdfPath, format: "Letter", printBackground: true });

  const sections = page.locator("section.page");
  for (const n of PREVIEW_PAGES) {
    const png = await sections.nth(n - 1).screenshot();
    await sharp(png).resize({ width: 800 }).webp({ quality: 84 }).toFile(`${previewDir}/page-${n}.webp`);
  }
  console.log(`wrote ${pdfPath} (${pages.length} pages) and ${PREVIEW_PAGES.length} previews`);

  if (process.argv.includes("--upload")) {
    const { createClient } = await import("@supabase/supabase-js");
    const objectPath = process.env.PLAYBOOK_PDF_OBJECT;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!objectPath || !url || !key) throw new Error("--upload needs PLAYBOOK_PDF_OBJECT, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await db.storage
      .from("ltf-playbook")
      .upload(objectPath, await readFile(pdfPath), { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`upload failed: ${error.message}`);
    console.log(`uploaded to ltf-playbook/${objectPath}`);
  }
} finally {
  await browser.close();
}
