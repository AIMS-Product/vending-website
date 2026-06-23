#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

const overrideEnv = "ALLOW_NEXT_BUILD_WITH_RUNNING_SERVER";

function safeRealpath(path) {
  try {
    return realpathSync(path);
  } catch {
    return "";
  }
}

function execText(execFile, command, args) {
  return execFile(command, args).toString();
}

function unique(values) {
  return [...new Set(values)];
}

function getListeningPids(execFile) {
  const output = execText(execFile, "lsof", [
    "-nP",
    "-iTCP",
    "-sTCP:LISTEN",
    "-Fp",
  ]);

  return unique(
    parseFieldRecords(output)
      .map((record) => record.pid)
      .filter(Boolean),
  );
}

function readProcessCwd(execFile, pid) {
  const output = execText(execFile, "lsof", [
    "-a",
    "-p",
    pid,
    "-d",
    "cwd",
    "-Fn",
  ]);

  return parseFieldRecords(output).find((record) => record.n)?.n ?? "";
}

function readProcessCommand(execFile, pid) {
  return execText(execFile, "ps", ["-p", pid, "-o", "command="]).trim();
}

function readProcess(execFile, pid) {
  try {
    return {
      pid,
      command: readProcessCommand(execFile, pid),
      cwd: readProcessCwd(execFile, pid),
    };
  } catch {
    return null;
  }
}

export function parseFieldRecords(output) {
  const records = [];
  let current = null;

  for (const rawLine of output.split(/\r?\n/)) {
    if (!rawLine) continue;

    const field = rawLine[0];
    const value = rawLine.slice(1);

    if (field === "p") {
      current = { pid: value };
      records.push(current);
      continue;
    }

    if (current) {
      current[field] = value;
    }
  }

  return records;
}

export function isNextServerCommand(command) {
  return /\bnext-server\b/.test(command) || /\bnext\s+dev\b/.test(command);
}

export function findBlockingServers({
  cwd = process.cwd(),
  execFile = execFileSync,
} = {}) {
  const projectRoot = safeRealpath(cwd);
  if (!projectRoot) return [];

  try {
    return getListeningPids(execFile)
      .map((pid) => readProcess(execFile, pid))
      .filter((process) => process && safeRealpath(process.cwd) === projectRoot)
      .filter(({ command }) => isNextServerCommand(command));
  } catch {
    return [];
  }
}

export function formatBlockingMessage(blockers) {
  const lines = blockers.map(
    ({ pid, command }) => `- pid ${pid}: ${command || "(unknown command)"}`,
  );

  return [
    "Refusing to run `next build` while a Next dev/server process is running from this checkout.",
    "",
    "Running a build can rewrite shared `/_next/static` assets while the open dev server still serves HTML that points at old CSS chunks. That is the local failure mode where the page falls back to raw Times/8px browser styles.",
    "",
    "Stop the running server first, then run the build again:",
    ...lines,
    "",
    `If you intentionally want to bypass this guard, rerun with ${overrideEnv}=1.`,
  ].join("\n");
}

export function run() {
  if (process.env[overrideEnv] === "1") {
    return;
  }

  const blockers = findBlockingServers();

  if (blockers.length > 0) {
    console.error(formatBlockingMessage(blockers));
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
