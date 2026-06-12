// UX Persona Review — Page Builder exploration
// Walks every page-builder route, inventories interactive elements, performs
// SAFE interactions only, captures console/network errors, and screenshots at
// 3 viewports. Destructive actions on the pre-existing sample page are screenshotted, never clicked.

import { chromium } from '/Users/jamesaims/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const SHOTS = path.resolve('reports/ux-persona-review/screenshots');
const SAMPLE_ID = 'f7eb8024-bbba-42d9-8b13-932e337f7e32';

const DESTRUCTIVE = /\b(delete|remove|archive|trash|discard|clear|revoke|disable|deactivate|unpublish|reset|cancel subscription)\b/i;
const EXTERNAL = /\b(log ?out|sign ?out|pay|subscribe|invite|send email|send sms|delete account)\b/i;

const ROUTES = [
  { slug: 'pages-list', url: `${BASE}/admin/pages`, name: 'Pages List' },
  { slug: 'pages-new', url: `${BASE}/admin/pages/new`, name: 'Create New Page', form: true },
  { slug: 'pages-editor', url: `${BASE}/admin/pages/${SAMPLE_ID}`, name: 'Page Builder Editor', editor: true },
  { slug: 'pages-authors', url: `${BASE}/admin/pages/authors`, name: 'Authors' },
  { slug: 'pages-redirects', url: `${BASE}/admin/pages/redirects`, name: 'Redirects' },
  { slug: 'pages-block-audit', url: `${BASE}/admin/pages/block-preview-audit`, name: 'Block Preview Audit' },
];

const results = [];
let seq = 0;
const pad = () => String(++seq).padStart(3, '0');

function fillValue(el) {
  const t = (el.type || '').toLowerCase();
  const hint = ((el.name || '') + ' ' + (el.label || '') + ' ' + (el.placeholder || '')).toLowerCase();
  if (t === 'email' || /email/.test(hint)) return `test+ux-review-20260604@example.com`;
  if (t === 'password') return 'TestPassword123!';
  if (t === 'tel' || /phone/.test(hint)) return '0400000000';
  if (t === 'url' || /url|link|slug/.test(hint)) return /slug/.test(hint) ? 'ux-review-test-page' : 'https://example.com';
  if (t === 'number') return '42';
  if (t === 'date') return '2026-06-04';
  if (/title|name|heading/.test(hint)) return 'UX Review Test Page';
  return 'Test input';
}

async function inventory(page) {
  return await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const label = (el) =>
      (el.getAttribute('aria-label') || el.textContent || el.value || el.getAttribute('placeholder') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const out = { buttons: [], links: [], inputs: [], headings: [], counts: {} };
    document.querySelectorAll('button, [role="button"]').forEach((el) => { if (vis(el)) out.buttons.push({ text: label(el), disabled: el.disabled || el.getAttribute('aria-disabled') === 'true' }); });
    document.querySelectorAll('a[href]').forEach((el) => { if (vis(el)) out.links.push({ text: label(el), href: el.getAttribute('href') }); });
    document.querySelectorAll('input, textarea, select').forEach((el) => { if (vis(el)) out.inputs.push({ type: el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : (el.type || 'text'), name: el.name || el.id || '', label: label(el), placeholder: el.getAttribute('placeholder') || '', required: el.required || false }); });
    document.querySelectorAll('h1, h2, h3').forEach((el) => { if (vis(el)) out.headings.push({ level: el.tagName, text: label(el) }); });
    out.counts = { buttons: out.buttons.length, links: out.links.length, inputs: out.inputs.length };
    return out;
  });
}

async function shot(page, slug, action) {
  const file = `${slug}-${pad()}-${action}.png`;
  await page.screenshot({ path: path.join(SHOTS, file), fullPage: action === 'load' }).catch(() => {});
  return file;
}

async function explore(browser, route) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const rec = { ...route, status: 'OK', console: [], network: [], shots: [], inventory: null, interactions: [], skips: [], notes: [] };

  page.on('console', (m) => { if (m.type() === 'error') rec.console.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => rec.console.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400) rec.network.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });

  try {
    const resp = await page.goto(route.url, { waitUntil: 'networkidle', timeout: 30000 });
    rec.httpStatus = resp ? resp.status() : null;
    await page.waitForTimeout(1500);
  } catch (e) {
    rec.status = 'LOAD_ERROR';
    rec.notes.push('Navigation error: ' + String(e).slice(0, 200));
  }

  rec.shots.push(await shot(page, route.slug, 'load'));
  rec.inventory = await inventory(page);

  // Targeted safe interactions
  try {
    if (route.editor) {
      // Click tabs / sidebar items / safe toggles that don't match destructive/external
      const clickable = await page.$$('button, [role="tab"], [role="button"]');
      let clicked = 0;
      for (const el of clickable) {
        if (clicked >= 8) break;
        const txt = ((await el.textContent().catch(() => '')) || '').trim().replace(/\s+/g, ' ');
        if (!txt || txt.length > 40) continue;
        if (DESTRUCTIVE.test(txt) || EXTERNAL.test(txt) || /publish/i.test(txt)) {
          rec.skips.push({ element: txt, reason: 'destructive/external/publish on pre-existing page — screenshotted not clicked' });
          continue;
        }
        const before = page.url();
        try {
          await el.click({ timeout: 2500 });
          await page.waitForTimeout(700);
          if (page.url() !== before) { await page.goto(route.url, { waitUntil: 'networkidle' }).catch(() => {}); continue; }
          rec.interactions.push({ element: txt, result: 'clicked', shot: await shot(page, route.slug, 'click-' + txt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)) });
          clicked++;
          // close any opened drawer/modal with Escape
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(300);
        } catch { /* not clickable, skip */ }
      }
    } else if (route.form) {
      // Fill the create-page form, screenshot filled state. Submitting creates a record (creation bucket) — record it.
      const fields = await page.$$('input:not([type=hidden]), textarea, select');
      for (const f of fields) {
        const meta = await f.evaluate((el) => ({ type: el.tagName === 'SELECT' ? 'select' : (el.type || 'text'), name: el.name || el.id || '', label: (el.getAttribute('aria-label') || el.placeholder || '').slice(0, 40) }));
        try {
          if (meta.type === 'select') { await f.selectOption({ index: 1 }).catch(() => {}); }
          else if (meta.type === 'checkbox' || meta.type === 'radio') { /* leave */ }
          else { await f.fill(fillValue(meta)).catch(() => {}); }
        } catch {}
      }
      rec.shots.push(await shot(page, route.slug, 'form-filled'));
      rec.notes.push('Form filled with test data; submission intentionally NOT performed to avoid creating orphan seed pages (creation flow reviewed visually).');
    } else {
      // List / authors / redirects / audit: click safe disclosure/filter elements, no destructive
      const buttons = await page.$$('button, [role="button"]');
      let clicked = 0;
      for (const el of buttons) {
        if (clicked >= 5) break;
        const txt = ((await el.textContent().catch(() => '')) || '').trim().replace(/\s+/g, ' ');
        if (!txt || txt.length > 40) continue;
        if (DESTRUCTIVE.test(txt) || EXTERNAL.test(txt)) { rec.skips.push({ element: txt, reason: 'destructive/external — screenshotted not clicked' }); continue; }
        const before = page.url();
        try {
          await el.click({ timeout: 2000 });
          await page.waitForTimeout(600);
          if (page.url() !== before) { await page.goto(route.url, { waitUntil: 'networkidle' }).catch(() => {}); continue; }
          rec.interactions.push({ element: txt, result: 'clicked', shot: await shot(page, route.slug, 'click-' + txt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)) });
          clicked++;
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(250);
        } catch {}
      }
    }
  } catch (e) { rec.notes.push('Interaction phase error: ' + String(e).slice(0, 150)); }

  // Responsive viewports
  await page.goto(route.url, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(800);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(600);
  rec.shots.push(await shot(page, route.slug, 'mobile'));
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(600);
  rec.shots.push(await shot(page, route.slug, 'tablet'));

  await ctx.close();
  results.push(rec);
  console.log(`done: ${route.name} (${rec.shots.length} shots, ${rec.console.length} console errs, ${rec.network.length} net errs)`);
}

const browser = await chromium.launch();
for (const r of ROUTES) {
  try { await explore(browser, r); } catch (e) { console.log('FATAL on ' + r.name + ': ' + e); results.push({ ...r, status: 'FATAL', error: String(e) }); }
}
await browser.close();
fs.writeFileSync(path.resolve('reports/ux-persona-review/exploration-data.json'), JSON.stringify(results, null, 2));
console.log('\nAll done. ' + results.length + ' routes explored. Total screenshots: ' + seq);
