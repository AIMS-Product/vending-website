#!/usr/bin/env node

import { requireValue, run } from "./lib/launch-check-helpers.mjs";

const DEFAULT_BASE_URL = "http://localhost:3000";
const CANONICAL_HOST = "https://www.vendingpreneurs.com";
const POSTER_NAMES = ["thomas", "joe", "jason", "anthony"];
const CRON_ROUTES = [
  "/api/admin/scheduled-publishing/run",
  "/api/admin/qualification-lifecycle/run",
  "/api/admin/close-sync/run",
];

const options = parseArgs(process.argv.slice(2));
const results = [];

await checkFeed();
await checkHome();
await checkCaseStudies();
await checkCronRoutes();

for (const result of results) {
  const prefix = result.ok ? "PASS" : "FAIL";
  console.log(
    `${prefix} ${result.name}${result.detail ? ` - ${result.detail}` : ""}`,
  );
}

const failures = results.filter((result) => !result.ok);
console.log(`checked=${results.length}`);
console.log(`failures=${failures.length}`);

if (failures.length) process.exitCode = 1;

// fallow-ignore-next-line complexity
function parseArgs(argv) {
  const parsed = {
    baseUrl: DEFAULT_BASE_URL,
    deployment: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--deployment" || arg === "--vercel-deployment") {
      parsed.deployment = requireValue(argv, index);
      index += 1;
    } else if (arg === "--base-url") {
      parsed.baseUrl = requireValue(argv, index);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      parsed.baseUrl = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  parsed.baseUrl = parsed.baseUrl.replace(/\/$/, "");
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  node scripts/check-launch-readiness.mjs [baseUrl]
  node scripts/check-launch-readiness.mjs --deployment https://example.vercel.app

Read-only checks for launch-critical rendered behavior:
  - RSS canonical host is ${CANONICAL_HOST}
  - Homepage includes LCP wordmark priority and contrast fixes
  - Case study video posters use compressed JPEGs
  - Cron routes reject unauthenticated requests with 401, proving CRON_SECRET is configured
`);
}

async function checkFeed() {
  const response = await getPath("/news/feed.xml");
  const xml = response.body;
  record({
    name: "feed returns 200",
    ok: response.status === 200,
    detail: `status=${response.status}`,
  });
  record({
    name: "feed uses canonical host",
    ok:
      xml.includes(`<link>${CANONICAL_HOST}/news</link>`) &&
      xml.includes(
        `<atom:link href="${CANONICAL_HOST}/news/feed.xml" rel="self" type="application/rss+xml" />`,
      ) &&
      !xml.includes("localhost"),
    detail: xml.includes("localhost")
      ? "found localhost in RSS"
      : `expected ${CANONICAL_HOST}`,
  });
}

async function checkHome() {
  const response = await getPath("/");
  const html = response.body;
  record({
    name: "home returns 200",
    ok: response.status === 200 && !html.includes("Authentication Required"),
    detail: `status=${response.status}`,
  });
  record({
    name: "home prioritizes header wordmark",
    ok: /<img[^>]+alt="Vendingpreneurs"(?=[^>]*(fetchPriority|fetchpriority)="high")(?=[^>]*loading="eager")/.test(
      html,
    ),
    detail: "wordmark should be eager with fetchPriority=high",
  });
  record({
    name: "home uses contrast-safe hero stat color",
    ok: html.includes("text-[#d6531f]"),
    detail: "expected text-[#d6531f]",
  });
}

// fallow-ignore-next-line complexity
async function checkCaseStudies() {
  const response = await getPath("/case-studies");
  const html = response.body;
  const missingJpegs = POSTER_NAMES.filter(
    (name) => !html.includes(`poster-${name}.jpg`),
  );
  const pngs = POSTER_NAMES.filter((name) =>
    html.includes(`poster-${name}.png`),
  );

  record({
    name: "case studies returns 200",
    ok: response.status === 200,
    detail: `status=${response.status}`,
  });
  record({
    name: "case studies use compressed JPEG posters",
    ok: missingJpegs.length === 0 && pngs.length === 0,
    detail:
      missingJpegs.length || pngs.length
        ? `missing jpg=${missingJpegs.join(",") || "none"} png=${pngs.join(",") || "none"}`
        : "all posters are jpg",
  });
}

async function checkCronRoutes() {
  for (const route of CRON_ROUTES) {
    const response = await getPath(route);
    record({
      name: `cron route protected ${route}`,
      ok: response.status === 401,
      detail:
        response.status === 503
          ? "CRON_SECRET is not configured"
          : `status=${response.status}`,
    });
  }
}

async function getPath(path) {
  if (options.deployment) return vercelCurl(path);

  const url = new URL(path, `${options.baseUrl}/`);
  const response = await fetch(url, { redirect: "manual" });
  return {
    status: response.status,
    body: await response.text(),
  };
}

// fallow-ignore-next-line complexity
function vercelCurl(path) {
  const marker = "__HTTP_STATUS__:";
  const args = [
    "curl",
    path,
    "--deployment",
    options.deployment,
    "--yes",
    "--non-interactive",
    "--",
    "--silent",
    "--show-error",
    "--write-out",
    `\n${marker}%{http_code}`,
  ];
  const child = run("vercel", args);

  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(
      `vercel ${args.join(" ")} failed with ${child.status}:\n${child.stderr || child.stdout}`,
    );
  }

  const markerIndex = child.stdout.lastIndexOf(marker);
  if (markerIndex === -1) {
    return { status: 0, body: child.stdout };
  }

  const body = child.stdout.slice(0, markerIndex).replace(/\n$/, "");
  const status = Number(child.stdout.slice(markerIndex + marker.length).trim());
  return { status, body };
}

function record(result) {
  results.push(result);
}
