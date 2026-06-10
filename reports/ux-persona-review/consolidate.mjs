// Step 4: mechanical consolidation of persona findings.json files.
import fs from "node:fs";
import path from "node:path";

const DIR = "reports/ux-persona-review";
const PERSONAS = path.join(DIR, "personas");
const SEV_RANK = { blocker: 5, critical: 4, high: 3, medium: 2, low: 1 };
const norm = (s) => (s || "").toLowerCase().trim();

const all = [];
const parseErrors = [];
for (const f of fs.readdirSync(PERSONAS).filter((x) => x.endsWith(".findings.json")).sort()) {
  try {
    const arr = JSON.parse(fs.readFileSync(path.join(PERSONAS, f), "utf8"));
    const personaSlug = f.replace(".findings.json", "");
    for (const fd of arr) {
      fd.__persona = personaSlug;
      fd.severity = norm(fd.severity);
      if (!SEV_RANK[fd.severity]) fd.severity = "low";
      // normalize page
      fd.page = (fd.page || "?").split("?")[0];
      all.push(fd);
    }
  } catch (e) {
    parseErrors.push(`${f}: ${e.message.split("\n")[0]}`);
  }
}

// significant-word tokenizer for clustering
const STOP = new Set("the a an is are on in of to for and or with no not this that page button form it as at by from be has have do does user".split(" "));
const tokens = (s) =>
  new Set(
    norm(s)
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
const overlap = (a, b) => {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n / Math.max(1, Math.min(a.size, b.size));
};

// cluster within page+category
const clusters = [];
for (const fd of all) {
  const ftok = tokens(fd.finding);
  let placed = false;
  for (const c of clusters) {
    if (c.page !== fd.page || c.category !== fd.category) continue;
    if (overlap(ftok, c.tok) >= 0.45) {
      c.items.push(fd);
      for (const t of ftok) c.tok.add(t);
      placed = true;
      break;
    }
  }
  if (!placed) clusters.push({ page: fd.page, category: fd.category, tok: ftok, items: [fd] });
}

// second pass: merge clusters across pages when finding is about the same global issue (same category, high overlap)
for (let i = 0; i < clusters.length; i++) {
  for (let jj = clusters.length - 1; jj > i; jj--) {
    const a = clusters[i], b = clusters[jj];
    if (a.category !== b.category) continue;
    if (overlap(a.tok, b.tok) >= 0.7) {
      a.items.push(...b.items);
      for (const t of b.tok) a.tok.add(t);
      if (a.page !== b.page) a.page = a.page + ", " + b.page;
      clusters.splice(jj, 1);
    }
  }
}

const out = clusters.map((c, idx) => {
  const personas = [...new Set(c.items.map((x) => x.__persona))];
  const maxSev = c.items.reduce((m, x) => (SEV_RANK[x.severity] > SEV_RANK[m] ? x.severity : m), "low");
  // representative = highest severity, longest evidence
  const rep = c.items.slice().sort((x, y) => SEV_RANK[y.severity] - SEV_RANK[x.severity] || (y.evidence?.length || 0) - (x.evidence?.length || 0))[0];
  const freq = personas.length;
  let band = "P3";
  if (maxSev === "blocker" || (maxSev === "critical" && freq >= 5)) band = "P0";
  else if (maxSev === "critical" || (maxSev === "high" && freq >= 5)) band = "P1";
  else if (maxSev === "high" || (maxSev === "medium" && freq >= 3)) band = "P2";
  return {
    cid: `C${String(idx + 1).padStart(3, "0")}`,
    band,
    page: c.page,
    category: c.category,
    severity: maxSev,
    personaCount: freq,
    personas,
    finding: rep.finding,
    journey: rep.journey || null,
    evidence: rep.evidence || [],
    suggested_fix: rep.suggested_fix || null,
    ids: c.items.map((x) => x.id),
  };
});

out.sort((a, b) => a.band.localeCompare(b.band) || SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.personaCount - a.personaCount);
fs.writeFileSync(path.join(DIR, "consolidated-findings.json"), JSON.stringify(out, null, 2));

const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
for (const c of out) counts[c.band]++;
console.log(JSON.stringify({
  totalRaw: all.length,
  totalClusters: out.length,
  bands: counts,
  blockers: out.filter((c) => c.severity === "blocker").length,
  parseErrors,
  perPersona: Object.fromEntries(
    fs.readdirSync(PERSONAS).filter((x) => x.endsWith(".findings.json")).map((f) => {
      try { return [f.replace(".findings.json", ""), JSON.parse(fs.readFileSync(path.join(PERSONAS, f), "utf8")).length]; }
      catch { return [f, "PARSE ERROR"]; }
    })
  ),
}, null, 2));
