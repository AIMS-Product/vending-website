#!/usr/bin/env node

import {
  commandFailureDetail,
  requireValue,
  run,
} from "./lib/launch-check-helpers.mjs";

const DEFAULT_PROJECT = "vending-website";
const DEFAULT_DOMAIN = "vendingpreneurs.com";

const REQUIRED_RUNTIME_ENVS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
];

const EMAIL_NOTIFICATION_ENVS = [
  "RESEND_API_KEY",
  "LEAD_NOTIFICATION_TO",
  "LEAD_NOTIFICATION_FROM",
];

const CLOSE_REQUIRED_ENVS = ["CLOSE_API_KEY"];

const CLOSE_RECOMMENDED_ENVS = [
  "CLOSE_LEAD_STATUS_ID",
  "CLOSE_FOLLOW_UP_ASSIGNED_TO",
  "CLOSE_QUALIFICATION_STATUS_FIELD_ID",
  "CLOSE_SOURCE_PATH_FIELD_ID",
  "CLOSE_EXPERIMENT_KEY_FIELD_ID",
  "CLOSE_VARIANT_KEY_FIELD_ID",
  "CLOSE_STATE_MARKET_FIELD_ID",
  "CLOSE_BUSINESS_STAGE_FIELD_ID",
  "CLOSE_BUDGET_RANGE_FIELD_ID",
  "CLOSE_AVAILABLE_CAPITAL_FIELD_ID",
  "CLOSE_PURCHASE_TIMELINE_FIELD_ID",
  "CLOSE_LOCATION_STATUS_FIELD_ID",
  "CLOSE_MACHINE_GOAL_FIELD_ID",
  "CLOSE_PRIMARY_GOAL_FIELD_ID",
  "CLOSE_CONSENT_STATUS_FIELD_ID",
  "CLOSE_LATEST_COMPLETED_AT_FIELD_ID",
];

const options = parseArgs(process.argv.slice(2));
const results = [];

checkProductionEnv();
checkDomain();
if (!options.skipDeploymentCheck) checkDeployment();

for (const result of results) {
  const prefix = result.level.padEnd(4);
  console.log(
    `${prefix} ${result.name}${result.detail ? ` - ${result.detail}` : ""}`,
  );
}

const failures = results.filter((result) => result.level === "FAIL");
const warnings = results.filter((result) => result.level === "WARN");
console.log(`checked=${results.length}`);
console.log(`failures=${failures.length}`);
console.log(`warnings=${warnings.length}`);

if (failures.length) process.exitCode = 1;

// fallow-ignore-next-line complexity
function parseArgs(argv) {
  const parsed = {
    project: DEFAULT_PROJECT,
    domain: DEFAULT_DOMAIN,
    deployment: "latest",
    requireDomainConfigured: false,
    skipDeploymentCheck: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      parsed.project = requireValue(argv, index);
      index += 1;
    } else if (arg === "--domain") {
      parsed.domain = requireValue(argv, index);
      index += 1;
    } else if (arg === "--deployment") {
      parsed.deployment = requireValue(argv, index);
      index += 1;
    } else if (arg === "--require-domain-configured") {
      parsed.requireDomainConfigured = true;
    } else if (arg === "--skip-deployment-check") {
      parsed.skipDeploymentCheck = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage:
  node scripts/check-launch-prereqs.mjs
  node scripts/check-launch-prereqs.mjs --deployment https://example.vercel.app
  node scripts/check-launch-prereqs.mjs --skip-deployment-check

Read-only production prerequisite checks:
  - Vercel production env names are present for Supabase, cron, notifications, and Close
  - Vercel custom-domain inspection reports DNS status
  - Latest or specified production deployment passes npm run check:launch

The script reports secret names only. It never prints secret values or mutates Vercel/DNS.
`);
}

function checkProductionEnv() {
  const child = run("vercel", ["env", "ls", "production"]);
  if (child.status !== 0) {
    record(
      "FAIL",
      "vercel production env list readable",
      commandFailureDetail(child),
    );
    return new Set();
  }

  record("PASS", "vercel production env list readable");
  const names = parseEnvNames(child.stdout);

  checkRequiredRuntimeEnv(names);
  checkLeadNotificationEnv(names);
  checkCloseEnv(names);
  checkOptionalProductionEnv(names);

  return names;
}

function checkRequiredRuntimeEnv(names) {
  for (const name of REQUIRED_RUNTIME_ENVS) {
    record(
      names.has(name) ? "PASS" : "FAIL",
      `production env ${name}`,
      names.has(name) ? "present" : "missing",
    );
  }
}

// fallow-ignore-next-line complexity
function checkLeadNotificationEnv(names) {
  const emailReady = EMAIL_NOTIFICATION_ENVS.every((name) => names.has(name));
  const slackReady = names.has("SLACK_WEBHOOK_URL");
  const missingEmail = EMAIL_NOTIFICATION_ENVS.filter(
    (name) => !names.has(name),
  );
  record(
    emailReady || slackReady ? "PASS" : "FAIL",
    "production lead notification channel",
    emailReady
      ? "Resend email channel configured"
      : slackReady
        ? "Slack webhook configured"
        : `missing email=${missingEmail.join(",")} and SLACK_WEBHOOK_URL`,
  );
}

// fallow-ignore-next-line complexity
function checkCloseEnv(names) {
  for (const name of CLOSE_REQUIRED_ENVS) {
    record(
      names.has(name) ? "PASS" : "FAIL",
      `production env ${name}`,
      names.has(name) ? "present" : "missing",
    );
  }

  const missingCloseRecommended = CLOSE_RECOMMENDED_ENVS.filter(
    (name) => !names.has(name),
  );
  record(
    missingCloseRecommended.length === 0 ? "PASS" : "WARN",
    "production Close mapping envs",
    missingCloseRecommended.length === 0
      ? "all recommended mappings present"
      : `missing ${missingCloseRecommended.length}: ${missingCloseRecommended.join(",")}`,
  );
}

// fallow-ignore-next-line complexity
function checkOptionalProductionEnv(names) {
  record(
    names.has("NEXT_PUBLIC_SITE_URL") ? "PASS" : "WARN",
    "production canonical site env",
    names.has("NEXT_PUBLIC_SITE_URL")
      ? "present"
      : "missing; app now falls back to https://www.vendingpreneurs.com",
  );

  record(
    names.has("OPENAI_API_KEY") ? "PASS" : "WARN",
    "production OpenAI env",
    names.has("OPENAI_API_KEY")
      ? "present; admin smoke still required"
      : "missing; admin AI features will not work",
  );
}

function parseEnvNames(output) {
  const names = new Set();
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]+)\s+/);
    if (match) names.add(match[1]);
  }
  return names;
}

// fallow-ignore-next-line complexity
function checkDomain() {
  const child = run("vercel", ["domains", "inspect", options.domain]);
  if (child.status !== 0) {
    record(
      "FAIL",
      `vercel domain ${options.domain} inspectable`,
      commandFailureDetail(child),
    );
    return;
  }

  const output = `${child.stdout}\n${child.stderr}`;
  record("PASS", `vercel domain ${options.domain} inspectable`);

  const misconfigured = /not configured properly/i.test(output);
  const recommendedRecord =
    output.match(/`([^`]*76\.76\.21\.21[^`]*)`/)?.[1] ??
    `A ${options.domain} 76.76.21.21`;
  const currentNameservers = [
    ...output.matchAll(/(ns[0-9]+\.domaincontrol\.com)/gi),
  ].map((match) => match[1]);

  record(
    misconfigured && options.requireDomainConfigured
      ? "FAIL"
      : misconfigured
        ? "WARN"
        : "PASS",
    `domain ${options.domain} DNS`,
    misconfigured
      ? `cutover pending; set ${recommendedRecord}${currentNameservers.length ? `; current NS=${[...new Set(currentNameservers)].join(",")}` : ""}`
      : "configured in Vercel",
  );
}

// fallow-ignore-next-line complexity
function checkDeployment() {
  const deployment =
    options.deployment === "latest"
      ? latestProductionDeployment()
      : options.deployment;

  if (!deployment) {
    record("FAIL", "production deployment URL discoverable");
    return;
  }

  record("PASS", "production deployment URL discoverable", deployment);
  const child = run(process.execPath, [
    "scripts/check-launch-readiness.mjs",
    "--deployment",
    deployment,
  ]);

  if (child.status === 0) {
    record(
      "PASS",
      "production deployment launch verifier",
      summarizeVerifier(child.stdout),
    );
    return;
  }

  record(
    "FAIL",
    "production deployment launch verifier",
    summarizeVerifier(child.stdout || child.stderr),
  );
}

function latestProductionDeployment() {
  const child = run("vercel", ["ls", options.project, "--prod"]);
  if (child.status !== 0) {
    record(
      "FAIL",
      `vercel production deployments for ${options.project} readable`,
      commandFailureDetail(child),
    );
    return undefined;
  }

  record(
    "PASS",
    `vercel production deployments for ${options.project} readable`,
  );
  return child.stdout.match(/https:\/\/[^\s]+\.vercel\.app/)?.[0];
}

// fallow-ignore-next-line complexity
function summarizeVerifier(output) {
  const failures = output
    .split("\n")
    .filter((line) => line.startsWith("FAIL "))
    .map((line) => line.replace(/^FAIL /, ""))
    .slice(0, 4);
  const checked = output.match(/checked=\d+/)?.[0];
  const failureCount = output.match(/failures=\d+/)?.[0];

  if (failures.length) {
    const suffix =
      output.split("\n").filter((line) => line.startsWith("FAIL ")).length > 4
        ? " ..."
        : "";
    return `${[checked, failureCount].filter(Boolean).join(" ")}; ${failures.join("; ")}${suffix}`;
  }

  return [checked, failureCount].filter(Boolean).join(" ") || "passed";
}

function record(level, name, detail = "") {
  results.push({ level, name, detail });
}
