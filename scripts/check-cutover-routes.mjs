#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const INVENTORY_PATH = "docs/cutover/webflow-url-inventory.md";
const REPORT_PATH = "docs/cutover/redirect-matrix.md";

const canonicalAliases = new Map([
  ["/about-us", "/about"],
  ["/privacy-policy", "/privacy"],
]);

const permanentRedirects = new Map([
  ["/business", "/about"],
  ["/booking-website", "/apply?source_path=/booking-website"],
  ["/booking-organicmisc", "/apply?source_path=/booking-organicmisc"],
  ["/booking-ltf", "/apply?source_path=/booking-ltf"],
  [
    "/booking-reactivation-scraper",
    "/apply?source_path=/booking-reactivation-scraper",
  ],
  ["/booking-podcast", "/apply?source_path=/booking-podcast"],
  ["/location-eligibility", "/apply?source_path=/location-eligibility"],
  [
    "/build-income-with-vending",
    "/apply?source_path=/build-income-with-vending",
  ],
  [
    "/vending-blueprint",
    "/vending-route-blueprint?source_path=/vending-blueprint",
  ],
  ["/join", "/apply?source_path=/join"],
  ["/vending-training", "/apply?source_path=/vending-training"],
]);

const advisoryHeadline =
  "How Everyday People Are Building $5k-$60k Per Month Vending Routes Without Quitting Their Job or Figuring It Out Alone";
const marketHeadline = "Your Market May Still Be Open. Let's Find Out.";
const cashflowHeadline =
  "How Regular People Build Cash-Flowing Vending Businesses (With No Experience)";

const indexableLegacyPaths = new Set([
  "/vending-route-blueprint",
  "/vending-business-blueprint",
]);

const legacyHeadlineExpectations = new Map([
  ...[
    "/booking-meta",
    "/booking-youtube",
    "/booking-reactivation-email",
    "/booking-ig",
    "/booking-linkedin",
    "/booking-x",
    "/booking-internal-ltf",
    "/booking-passivepreneurs",
    "/booking-modern-entrepreneur-newsletter",
    "/booking-partner",
    "/booking-tiktok",
    "/apply-vendingpreneurs",
  ].map((path) => [path, advisoryHeadline]),
  ...[
    "/booking-vendingpreneurs-training",
    "/book-your-call",
    "/start-your-route-ak-ig",
    "/start-your-route-ak-tt",
    "/start-my-vending-business",
  ].map((path) => [path, marketHeadline]),
  ["/schedule-your-call-ig", "You're In The Right Place."],
  ["/start", "You Saw How It Works. Now Let's Build Your Route."],
  ["/vending-route-blueprint", cashflowHeadline],
  ["/vending-business-blueprint", "Your Vendingpreneur Journey Starts Here"],
]);

export async function main(argv = process.argv.slice(2)) {
  const baseUrl = argv[0] ?? "http://localhost:3010";
  const rows = await readInventoryRows(INVENTORY_PATH);
  const results = [];

  for (const row of rows) {
    results.push(await checkRow(baseUrl, row));
  }

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, formatMatrix({ baseUrl, results }));

  const failures = results.filter((result) => !result.ok);
  console.log(`checked=${results.length}`);
  console.log(`failures=${failures.length}`);
  console.log(`report=${REPORT_PATH}`);
  if (failures.length) {
    for (const failure of failures) {
      console.log(`failure=${failure.path} ${failure.signal}`);
    }
    process.exitCode = 1;
  }
}

export async function readInventoryRows(inventoryPath) {
  const markdown = await fs.readFile(inventoryPath, "utf8");
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("| `/"))
    .map((line) => {
      const cells = line
        .replaceAll("\\|", "\u0000")
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.replaceAll("\u0000", "|").trim());
      return {
        path: cells[0].replace(/^`|`$/g, ""),
        intended: stripCode(cells.length >= 5 ? cells[3] : cells[2]),
        decision: cells.length >= 5 ? cells[4] : cells[3],
      };
    });
}

async function checkRow(baseUrl, row) {
  if (row.decision.includes("permanent redirect")) {
    return checkRedirect(baseUrl, row.path, permanentRedirects.get(row.path));
  }

  if (canonicalAliases.has(row.path)) {
    return checkCanonicalAlias(
      baseUrl,
      row.path,
      canonicalAliases.get(row.path),
    );
  }

  if (
    row.intended.startsWith("/apply?source_path=") ||
    row.decision.includes("preserve apply page") ||
    row.decision.includes("redirect with attribution")
  ) {
    return checkLegacyApplyPage(baseUrl, row.path);
  }

  const response = await fetch(`${baseUrl}${row.path}`, { redirect: "manual" });
  const body = await response.text();

  if (row.decision.includes("remove test route")) {
    const isNotFound =
      response.status === 404 ||
      body.includes('name="next-error" content="not-found"');
    return {
      path: row.path,
      expected: "removed route not-found fallback",
      status: response.status,
      signal: isNotFound
        ? response.status === 404
          ? "404"
          : "next not-found fallback"
        : "still active",
      ok: isNotFound,
    };
  }

  if (row.decision.includes("cody review")) {
    return {
      path: row.path,
      expected: "Cody decision pending",
      status: response.status,
      signal: response.status < 500 ? "held pending review" : "server error",
      ok: response.status < 500,
    };
  }

  if (row.decision.includes("preserve support page")) {
    const hasNoindex = /name="robots" content="[^"]*noindex/.test(body);
    return {
      path: row.path,
      expected: "support 200 noindex",
      status: response.status,
      signal: hasNoindex ? "noindex" : "missing noindex",
      ok: response.status === 200 && hasNoindex,
    };
  }

  if (row.path.startsWith("/news/")) {
    if (row.decision.includes("copy/publish candidate")) {
      const isNotFound = isNextNotFound(response, body);
      return {
        path: row.path,
        expected: "news copy candidate public",
        status: response.status,
        signal:
          response.status === 200 && !isNotFound
            ? "published/rendered"
            : "not published",
        ok: response.status === 200 && !isNotFound,
      };
    }

    if (row.decision.includes("archive/no public copy")) {
      const isNotFound = isNextNotFound(response, body);
      return {
        path: row.path,
        expected: "news archived or unpublished",
        status: response.status,
        signal: isNotFound ? "not public" : "still public",
        ok: isNotFound,
      };
    }

    return {
      path: row.path,
      expected: "news article not 5xx",
      status: response.status,
      signal: body.includes('name="robots" content="noindex"')
        ? "draft/not-found noindex"
        : "rendered",
      ok: response.status < 500,
    };
  }

  return {
    path: row.path,
    expected: "canonical 200",
    status: response.status,
    signal: response.url,
    ok: response.status === 200,
  };
}

async function checkRedirect(baseUrl, sourcePath, expectedDestination) {
  if (!expectedDestination) {
    return {
      path: sourcePath,
      expected: "configured permanent redirect",
      status: 0,
      signal: "missing redirect expectation",
      ok: false,
    };
  }

  const response = await fetch(`${baseUrl}${sourcePath}`, {
    redirect: "manual",
  });
  const location = response.headers.get("location") ?? "";
  const parsed = location ? new URL(location, baseUrl) : null;
  const expected = new URL(expectedDestination, baseUrl);
  const ok =
    response.status === 308 &&
    parsed?.pathname === expected.pathname &&
    parsed?.search === expected.search;

  return {
    path: sourcePath,
    expected: `308 ${expected.pathname}${expected.search}`,
    status: response.status,
    signal: location || "missing location",
    ok,
  };
}

async function checkCanonicalAlias(baseUrl, sourcePath, canonicalPath) {
  const response = await fetch(`${baseUrl}${sourcePath}`, {
    redirect: "manual",
  });
  const body = await response.text();
  const hasCanonical = hasCanonicalHref(body, baseUrl, canonicalPath);

  return {
    path: sourcePath,
    expected: `200 canonical ${canonicalPath}`,
    status: response.status,
    signal: hasCanonical ? "canonical alias" : "missing canonical",
    ok: response.status === 200 && hasCanonical,
  };
}

async function checkLegacyApplyPage(baseUrl, sourcePath) {
  const url = `${baseUrl}${sourcePath}?utm_source=matrix`;
  const response = await fetch(url, { redirect: "manual" });
  const body = await response.text();
  const hasSourcePath = hasHiddenInput(body, "source_path", sourcePath);
  const hasLandingPath = hasHiddenInput(body, "landing_path", sourcePath);
  const hasUtm = hasHiddenInput(body, "utm_source", "matrix");
  const hasApplyForm = /name="business_stage"/.test(body);
  const hasNoindex = /name="robots" content="[^"]*noindex/.test(body);
  const expectsNoindex = !indexableLegacyPaths.has(sourcePath);
  const expectedHeadline = legacyHeadlineExpectations.get(sourcePath);
  const hasLegacyHeadline = expectedHeadline
    ? normalizeText(body).includes(normalizeText(expectedHeadline))
    : true;
  const ok =
    response.status === 200 &&
    hasSourcePath &&
    hasLandingPath &&
    hasUtm &&
    hasApplyForm &&
    (expectsNoindex ? hasNoindex : !hasNoindex) &&
    hasLegacyHeadline;

  return {
    path: sourcePath,
    expected: "legacy apply page 200",
    status: response.status,
    signal: ok
      ? "apply form with attribution and legacy headline"
      : missingSignals({
          source_path: hasSourcePath,
          landing_path: hasLandingPath,
          utm_source: hasUtm,
          form: hasApplyForm,
          robots: expectsNoindex ? hasNoindex : !hasNoindex,
          headline: hasLegacyHeadline,
        }),
    ok,
  };
}

function formatMatrix({ baseUrl, results }) {
  const lines = [
    "# Cutover Route Matrix",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${baseUrl}`,
    `Checked URLs: ${results.length}`,
    `Failures: ${results.filter((result) => !result.ok).length}`,
    "",
    "| Old path | Expected | Actual status | Signal | Result |",
    "| --- | --- | ---: | --- | --- |",
  ];

  for (const result of results) {
    lines.push(
      `| \`${result.path}\` | ${result.expected} | ${result.status} | ${escapeTable(result.signal)} | ${result.ok ? "pass" : "fail"} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function escapeTable(value) {
  return String(value).replace(/\|/g, "\\|");
}

function stripCode(value) {
  return value.replace(/^`|`$/g, "");
}

function hasCanonicalHref(body, baseUrl, canonicalPath) {
  return Array.from(body.matchAll(/<link[^>]+rel="canonical"[^>]*>/gi)).some(
    ([tag]) => {
      const href = tag.match(/\bhref="([^"]+)"/i)?.[1];
      return href ? new URL(href, baseUrl).pathname === canonicalPath : false;
    },
  );
}

function isNextNotFound(response, body) {
  return (
    response.status === 404 ||
    body.includes('name="next-error" content="not-found"')
  );
}

function hasHiddenInput(body, name, value) {
  return new RegExp(
    `<input(?=[^>]+\\btype="hidden")(?=[^>]+\\bname="${escapeRegex(name)}")(?=[^>]+\\bvalue="${escapeRegex(value)}")[^>]*>`,
    "i",
  ).test(body);
}

function missingSignals(signals) {
  return Object.entries(signals)
    .filter(([, present]) => !present)
    .map(([name]) => `missing ${name}`)
    .join(", ");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value) {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
