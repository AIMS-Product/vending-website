// Automated QA for Round 3 SEO-builder fixes (R3-1..R3-7).
// Usage: node scripts/qa-round-3.mjs [baseUrl]   (default http://localhost:3000)
//
// Asserts rendered outcomes (computed styles, live DOM behavior), not class
// names. Editor checks run on /admin/pages/new WITHOUT saving, so nothing is
// persisted. The only writes are in the I6 settings check (adds then deletes
// a throwaway prefix) — skipped automatically when the page is read-only.
// Screenshots land in /tmp/qa-r3/.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = "/tmp/qa-r3";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const record = (id, name, pass, detail) => {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch();
// QA_BYPASS: Vercel "Protection Bypass for Automation" secret for protected previews.
const extraHTTPHeaders = process.env.QA_BYPASS
  ? { "x-vercel-protection-bypass": process.env.QA_BYPASS, "x-vercel-set-bypass-cookie": "true" }
  : {};
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders });
const page = await ctx.newPage();

const domClick = (txt) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => (x.textContent || "").trim().includes(t) && x.offsetParent !== null,
    );
    if (b) { b.click(); return true; }
    return false;
  }, txt);

const setNativeValue = `(el, val) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}`;

// ---------- I1: published bullets render visually ----------
try {
  await page.goto(`${BASE}/resources/vending-in-colleges`, { waitUntil: "networkidle" });
  const lists = await page.evaluate(() => {
    return [...document.querySelectorAll("main ul")]
      .filter((ul) => !ul.closest("nav") && ul.querySelector("li"))
      .map((ul) => {
        const li = ul.querySelector("li");
        const ulStyle = getComputedStyle(ul);
        const liStyle = getComputedStyle(li);
        const marker = getComputedStyle(li, "::marker");
        return {
          listStyleType: liStyle.listStyleType || ulStyle.listStyleType,
          position: ulStyle.listStylePosition,
          markerColor: marker.color,
          textColor: liStyle.color,
          sample: (li.textContent || "").trim().slice(0, 40),
        };
      });
  });
  const discLists = lists.filter((l) => l.listStyleType === "disc");
  const noneLists = lists.filter((l) => l.listStyleType === "none");
  const invisibleMarkers = discLists.filter(
    (l) => l.markerColor === "rgba(0, 0, 0, 0)" || l.markerColor === "transparent",
  );
  record(
    "I1",
    "published list markers computed as disc with visible marker color",
    discLists.length >= 1 && invisibleMarkers.length === 0,
    `${discLists.length} disc list(s), ${noneLists.length} list-none (checklist ok), invisible markers: ${invisibleMarkers.length}`,
  );
  const firstDisc = page.locator("main ul li").first();
  await firstDisc.scrollIntoViewIfNeeded();
  const box = await page.evaluate(() => {
    const ul = [...document.querySelectorAll("main ul")].find(
      (u) => getComputedStyle(u.querySelector("li") || u).listStyleType === "disc",
    );
    if (!ul) return null;
    ul.scrollIntoView({ block: "center" });
    const r = ul.getBoundingClientRect();
    return { x: Math.max(0, r.x - 30), y: Math.max(0, r.y - 10), width: Math.min(700, r.width + 40), height: Math.min(400, r.height + 20) };
  });
  if (box) await page.screenshot({ path: `${SHOTS}/I1-bullets-crop.png`, clip: box });
} catch (e) { record("I1", "published bullets", false, String(e).slice(0, 120)); }

// ---------- routing smoke (read-only) ----------
try {
  const probe = async (path) => {
    const r = await page.request.get(`${BASE}${path}`, { maxRedirects: 0 });
    return { status: r.status(), location: r.headers()["location"] || "" };
  };
  const legacy = await probe("/resources/vending-in-colleges");
  const blog = await probe("/blog/top-10-profitable-products-to-stock-in-your-vending-machine");
  record("I6a", "legacy /resources page serves 200", legacy.status === 200, `status ${legacy.status}`);
  record("I6b", "legacy /blog slug 308s to /news", blog.status === 308 && blog.location.includes("/news/"), `status ${blog.status} -> ${blog.location}`);
} catch (e) { record("I6", "routing smoke", false, String(e).slice(0, 120)); }

// ---------- I6: settings page (writes a throwaway prefix, then deletes it) ----------
try {
  await page.goto(`${BASE}/admin/settings/routes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const defaults = await page.evaluate(() =>
    ["/resources", "/blog", "/landing", "/videos", "/solutions"].filter((p) => document.body.innerText.includes(p)).length,
  );
  record("I6c", "five default prefixes listed", defaults === 5, `${defaults}/5 visible`);
  const prefixInput = page.locator('input[name="prefix"], input[id*="prefix"]').first();
  if (await prefixInput.count()) {
    await prefixInput.fill("/admin");
    await page.locator('input[name="label"], input[id*="label"]').first().fill("reserved test");
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForTimeout(1500);
    const rejected = await page.evaluate(() => document.body.innerText.includes("reserved and cannot be used"));
    record("I6d", "reserved /admin rejected with inline error", rejected, rejected ? "" : "no error text found");
    await prefixInput.fill("/qa-auto-check");
    await page.locator('input[name="label"], input[id*="label"]').first().fill("QA auto");
    await page.locator('button:has-text("Add")').first().click();
    await page.waitForTimeout(2000);
    const added = await page.evaluate(() => document.body.innerText.includes("/qa-auto-check"));
    let deleted = false;
    if (added) {
      await page.evaluate(() => {
        const rows = [...document.querySelectorAll("tr, li")].filter((r) => (r.textContent || "").includes("/qa-auto-check"));
        for (const r of rows) {
          const btn = [...r.querySelectorAll("button")].find((b) => /remove|delete/i.test((b.textContent || "") + (b.getAttribute("aria-label") || "")));
          if (btn) { btn.click(); return; }
        }
      });
      await page.waitForTimeout(2000);
      deleted = await page.evaluate(() => !document.body.innerText.includes("/qa-auto-check"));
    }
    record("I6e", "custom prefix add + delete round-trip", added && deleted, `added:${added} deleted:${deleted}`);
  } else {
    record("I6d", "settings form present (super-admin)", false, "prefix input not found — not super admin?");
  }
  await page.screenshot({ path: `${SHOTS}/I6-settings.png` });
} catch (e) { record("I6", "settings checks", false, String(e).slice(0, 120)); }

// ---------- Editor checks on an UNSAVED new page (nothing persists) ----------
try {
  await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await domClick("Start building page");
  await page.waitForTimeout(2500);

  // I3: meta description cap + counter
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("button")].filter((b) => (b.textContent || "").trim() === "Settings" && b.offsetParent !== null);
    tabs[tabs.length - 1]?.click();
  });
  await page.waitForTimeout(700);
  const metaTa = page.locator('textarea[name="metaDescription"]');
  let meta = { found: false };
  if (await metaTa.count()) {
    await metaTa.fill("X".repeat(200)); // user-like input — maxLength applies
    meta = await page.evaluate(() => {
      const ta = document.querySelector('textarea[name="metaDescription"]');
      const container = ta.closest("div")?.parentElement?.parentElement;
      const counter = (container?.innerText.match(/(\d+)\s*\/\s*155/) || [])[0] || "";
      return { found: true, maxLength: ta.maxLength, len: ta.value.length, counter };
    });
    await metaTa.fill(""); // leave the unsaved draft clean
  }
  record("I3", "meta description caps at 155 with counter", meta.found && meta.maxLength === 155 && meta.len === 155 && meta.counter.includes("155"), JSON.stringify(meta));

  // I4: outline reorder buttons (need 2+ blocks)
  const addBlock = async (category, layout) => {
    await domClick("Add page content");
    await page.waitForTimeout(800);
    await domClick(category);
    await page.waitForTimeout(600);
    if (layout) { await domClick(layout); await page.waitForTimeout(800); }
  };
  await addBlock("Hero", "Standard hero");
  await addBlock("Text", "Standard text");
  // close the layout picker if a differently-named text layout left it open
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);
  const expand = page.locator('button[aria-label="Expand blocks sidebar"]');
  if (await expand.count()) { await expand.click(); await page.waitForTimeout(700); }
  const reorder = await page.evaluate(() => {
    const ups = [...document.querySelectorAll('button[aria-label*="Move block"][aria-label*="up"]')];
    const downs = [...document.querySelectorAll('button[aria-label*="Move block"][aria-label*="down"]')];
    if (!ups.length) return { present: false };
    const firstUpDisabled = ups[0].disabled;
    const enabledDown = downs.find((d) => !d.disabled);
    return { present: true, count: ups.length, firstUpDisabled, hasEnabledDown: !!enabledDown };
  });
  record("I4", "outline up/down buttons with boundary disabling", reorder.present && reorder.firstUpDisabled, JSON.stringify(reorder));

  // I2: link-text control behavior on a paragraph
  const linkUi = await page.evaluate((setterSrc) => {
    const set = eval(setterSrc);
    const href = document.querySelector('[data-testid="rich-text-link-href"]');
    if (!href) return { found: false };
    const det = href.closest("details");
    if (det) det.open = true;
    const inputs = det ? [...det.querySelectorAll("input")] : [];
    const linkText = inputs.find((i) => i !== href);
    if (!linkText) return { found: true, linkTextInput: false };
    set(href, "/apply");
    set(linkText, "zzz-definitely-not-in-paragraph");
    return { found: true, linkTextInput: true };
  }, setNativeValue);
  await page.waitForTimeout(800);
  const linkError = await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"]')].some((e) => /isn't in this paragraph/i.test(e.textContent || "")),
  );
  record("I2", "link-text input present; not-found shows inline alert", linkUi.found && linkUi.linkTextInput && linkError, JSON.stringify({ ...linkUi, linkError }));

  // I5: proof block settings expose media controls
  await addBlock("Proof", "Quote proof");
  await page.evaluate(() => document.querySelector('button[aria-label="Edit Proof settings"]')?.click());
  await page.waitForTimeout(1000);
  const proofControls = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return { dialog: false };
    const text = d.innerText;
    return {
      dialog: true,
      choose: text.includes("Choose from library"),
      alt: text.includes("Media alt text"),
      label: text.includes("Media library asset"),
    };
  });
  record("I5", "proof settings expose media picker + alt text", proofControls.dialog && proofControls.choose && proofControls.alt, JSON.stringify(proofControls));
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);

  // I7: import truncation warning (proposal-only, inserts nothing, no save).
  // Runs on an existing page because the AI panel needs a saved page id.
  await page.goto(`${BASE}/admin/pages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const pageHref = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href^="/admin/pages/"]')].find((x) =>
      /^\/admin\/pages\/[0-9a-f-]{36}$/.test(x.getAttribute("href") || ""),
    );
    return a ? a.getAttribute("href") : null;
  });
  if (!pageHref) throw new Error("no existing page found for I7 check");
  await page.goto(`${BASE}${pageHref}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator('button:has-text("AI")').last().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('button[aria-label="Import document"]').click();
  await page.waitForTimeout(500);
  const bigDoc = ["# Doc"].concat(Array.from({ length: 10 }, (_, i) => `## S${i + 1}\n\nP${i + 1}.`)).join("\n\n");
  await page.locator('[data-testid="document-import-text"]').fill(bigDoc);
  await page.locator('button:has-text("Create block plan")').click();
  await page.waitForTimeout(1200);
  const warn = await page.evaluate(() =>
    [...document.querySelectorAll('[role="status"]')].map((e) => e.textContent.trim()).find((t) => /sections dropped/.test(t)) || "",
  );
  const smallDoc = ["# Doc"].concat(Array.from({ length: 7 }, (_, i) => `## S${i + 1}\n\nP${i + 1}.`)).join("\n\n");
  await page.locator('[data-testid="document-import-text"]').fill(smallDoc);
  await page.locator('button:has-text("Create block plan")').click();
  await page.waitForTimeout(1200);
  const warn2 = await page.evaluate(() =>
    [...document.querySelectorAll('[role="status"]')].map((e) => e.textContent.trim()).find((t) => /sections dropped/.test(t)) || "",
  );
  record("I7", "over-cap paste warns with count; under-cap silent", /\d+ sections dropped/.test(warn) && !warn2, JSON.stringify({ warn: warn.slice(0, 60), warn2: warn2.slice(0, 40) }));
  await page.screenshot({ path: `${SHOTS}/editor-final-state.png` });
} catch (e) { record("EDITOR", "editor checks", false, String(e).slice(0, 140)); }

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${SHOTS}/`);
if (failed.length) { console.log("FAILED:", JSON.stringify(failed, null, 1)); process.exit(1); }
