#!/usr/bin/env node
/**
 * Read-only check that the GA4 service account can read Search Console.
 *
 * Lists every property the service account has been added to, then prints
 * the last 7 days of final web-search clicks and impressions for GSC_SITE_URL.
 * Writes nothing anywhere: no database client is created.
 *
 * Needs GA4_SERVICE_ACCOUNT_JSON and GSC_SITE_URL in .env.local (or the
 * environment). Setup: docs/marketing/search-console.md.
 *
 * Usage: node scripts/search-console-probe.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

const ROOT = process.cwd();
const env = readEnv(path.join(ROOT, ".env.local"));
for (const [name, value] of Object.entries(env)) process.env[name] ??= value;

const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
const siteUrl = process.env.GSC_SITE_URL;
if (!serviceAccountJson) {
  console.error("Missing GA4_SERVICE_ACCOUNT_JSON.");
  process.exit(1);
}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": path.join(ROOT, "src"),
    "server-only": path.join(ROOT, "vitest.server-only-shim.ts"),
  },
  interopDefault: true,
});
const { parseServiceAccount } = await jiti.import(
  path.join(ROOT, "src/lib/ga4/client.ts"),
);
const { createSearchConsoleClient } = await jiti.import(
  path.join(ROOT, "src/lib/search-console/client.ts"),
);

const account = parseServiceAccount(serviceAccountJson);
if (!account) {
  console.error(
    "GA4_SERVICE_ACCOUNT_JSON is not a readable service-account key.",
  );
  process.exit(1);
}
console.log(`Service account: ${account.clientEmail}\n`);

// listSites does not use the site; any placeholder works before GSC_SITE_URL is set.
const client = createSearchConsoleClient({
  serviceAccountJson,
  siteUrl: siteUrl ?? "unset",
});

const sites = await client.listSites();
if (sites.length === 0) {
  console.log(
    "It can see no Search Console property yet. Add the address above as a user (Restricted) in Search Console.",
  );
} else {
  console.log("Properties it can see:");
  for (const site of sites)
    console.log(`  ${site.siteUrl}  (${site.permissionLevel})`);
}

if (!siteUrl) {
  console.log(
    "\nGSC_SITE_URL is not set; set it to one of the properties above.",
  );
  process.exit(0);
}

const day = (offset) =>
  new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
const rows = await client.fetchDailyTotals({
  startDate: day(10),
  endDate: day(1),
});
const last7 = rows.slice(-7);
console.log(`\n${siteUrl}, final data, last ${last7.length} days reported:`);
console.log("day          clicks  impressions");
for (const row of last7) {
  console.log(
    `${row.day}  ${String(row.clicks).padStart(6)}  ${String(row.impressions).padStart(11)}`,
  );
}
const total = (key) => last7.reduce((sum, row) => sum + row[key], 0);
console.log(
  `total       ${String(total("clicks")).padStart(6)}  ${String(total("impressions")).padStart(11)}`,
);

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const at = l.indexOf("=");
        return [
          l.slice(0, at).trim(),
          l
            .slice(at + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}
