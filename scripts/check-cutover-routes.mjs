#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const INVENTORY_PATH = "docs/cutover/webflow-url-inventory.md";
const REPORT_PATH = "docs/cutover/redirect-matrix.md";

const permanentRedirects = new Map([
  ["/about-us", "/about"],
  ["/privacy-policy", "/privacy"],
  ["/business", "/about"],
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
  if (permanentRedirects.has(row.path)) {
    return checkRedirect(
      baseUrl,
      row.path,
      permanentRedirects.get(row.path),
      308,
    );
  }

  if (
    row.intended.startsWith("/apply?source_path=") ||
    row.decision.includes("redirect with attribution")
  ) {
    return checkRedirect(baseUrl, row.path, "/apply", 307, row.path);
  }

  const response = await fetch(`${baseUrl}${row.path}`, { redirect: "manual" });
  const body = await response.text();

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

async function checkRedirect(
  baseUrl,
  sourcePath,
  expectedPath,
  expectedStatus,
  sourcePathParam,
) {
  const url = `${baseUrl}${sourcePath}?utm_source=matrix`;
  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  const parsed = location ? new URL(location, baseUrl) : null;
  const sourceParam = parsed?.searchParams.get("source_path");
  const utm = parsed?.searchParams.get("utm_source");
  const ok =
    response.status === expectedStatus &&
    parsed?.pathname === expectedPath &&
    (sourcePathParam ? sourceParam === sourcePathParam : true) &&
    utm === "matrix";

  return {
    path: sourcePath,
    expected: `${expectedStatus} ${expectedPath}`,
    status: response.status,
    signal: location || "missing location",
    ok,
  };
}

function formatMatrix({ baseUrl, results }) {
  const lines = [
    "# Cutover Redirect Matrix",
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
