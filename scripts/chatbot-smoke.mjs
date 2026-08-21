#!/usr/bin/env node
// Foundation-phase smoke test for src/lib/chatbot/*.
//
// Run: node scripts/chatbot-smoke.mjs
//
// Every chatbot lib module starts with `import "server-only"`, which throws
// outside a Next.js server bundle (see node_modules/server-only/index.js).
// This project has no tsx/ts-node; it does have `jiti` (a transitive dep
// that also powers Next.js's own next.config.ts loading), so this script
// uses jiti's programmatic API to import the real .ts modules directly, and
// shims `server-only` to a no-op for this process only — the same effect
// Next.js gets from its "react-server" export condition. The shim lives
// under node_modules/, which is gitignored, and is a no-op if a real
// `server-only` install is already present.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

ensureServerOnlyShim(root);
loadEnvLocal(root);

const { createJiti } = await import("jiti");
const jiti = createJiti(root, { alias: { "@": path.join(root, "src") } });

async function importLib(relativePath) {
  return jiti.import(path.join(root, relativePath));
}

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${label}`);
}

// --- 1. System prompt assembles for all three branches, with case-study
//        index + collateral present in every one. ------------------------
{
  const { buildChatbotSystemPrompt } = await importLib(
    "src/lib/chatbot/build-system-prompt.ts",
  );

  const branchB = buildChatbotSystemPrompt({
    personaName: "Mia",
    knowledgeBase: "Never discount published pricing.",
    userTurnCount: 1,
  });
  const branchC = buildChatbotSystemPrompt({
    personaName: "Mia",
    knowledgeBase: null,
    userTurnCount: 4,
  });
  const branchA = buildChatbotSystemPrompt({
    personaName: "Mia",
    knowledgeBase: null,
    userTurnCount: 4,
    capturedEmail: "jane@example.com",
  });
  // A returning visitor recalled via cookie must get branch A even on turn 1.
  const branchAReturning = buildChatbotSystemPrompt({
    personaName: "Mia",
    knowledgeBase: null,
    userTurnCount: 1,
    capturedPhone: "5551234567",
  });

  check("branch B prompt targets the first-turn no-ask rule", () => {
    assert.match(branchB, /Do not ask for contact info in this reply/);
    assert.match(branchB, /TEAM-VERIFIED NOTES/);
  });
  check("branch C prompt targets the established-conversation ask", () => {
    assert.match(branchC, /You've earned the ask/);
  });
  check("branch A prompt (captured this session) switches to qualifying", () => {
    assert.match(branchA, /Switch to qualifying/);
    assert.match(branchA, /Email: jane@example.com/);
  });
  check("branch selection prefers capture over turn count", () => {
    assert.match(branchAReturning, /Switch to qualifying/);
    assert.doesNotMatch(branchAReturning, /Do not ask for contact info/);
  });

  for (const [name, prompt] of [
    ["B", branchB],
    ["C", branchC],
    ["A", branchA],
  ]) {
    check(`branch ${name} prompt includes the case-study index`, () => {
      assert.match(prompt, /Matt Dicks/);
      assert.match(prompt, /\/case-studies\/matt-dicks/);
    });
    check(`branch ${name} prompt includes collateral offers`, () => {
      assert.match(prompt, /\/resources\/roadmap/);
      assert.match(prompt, /\/resources\/finance-templates/);
    });
  }
}

// --- 2. extract-lead finds email/phone/name and ignores non-leads. -------
{
  const { extractLead } = await importLib("src/lib/chatbot/extract-lead.ts");

  check("extract-lead finds email, phone, and a self-introduced name", () => {
    const result = extractLead(
      "Hi, my name is John Smith and my email is john.smith@example.com, call me at (555) 123-4567",
    );
    assert.equal(result.email, "john.smith@example.com");
    assert.equal(result.phone, "5551234567");
    assert.equal(result.name, "John Smith");
  });

  check("extract-lead ignores a non-lead turn (no email/phone, no false name)", () => {
    const result = extractLead(
      "I'm interested in learning more about vending machines",
    );
    assert.equal(result.email, null);
    assert.equal(result.phone, null);
    assert.equal(result.name, null);
  });

  check("extract-lead does not false-positive a name from 'I'm not sure yet'", () => {
    const result = extractLead("I'm not sure yet, still thinking it over");
    assert.equal(result.name, null);
  });
}

// --- 3. input-budget rejects oversize payloads. ---------------------------
{
  const { checkChatbotInputBudget } = await importLib(
    "src/lib/chatbot/input-budget.ts",
  );

  check("input-budget accepts a normal turn", () => {
    const result = checkChatbotInputBudget([{ content: "hello there" }]);
    assert.equal(result.ok, true);
  });

  check("input-budget rejects too many messages", () => {
    const messages = Array.from({ length: 51 }, () => ({ content: "hi" }));
    const result = checkChatbotInputBudget(messages);
    assert.equal(result.ok, false);
    assert.equal(result.violation, "too_many_messages");
  });

  check("input-budget rejects an oversize single message", () => {
    const result = checkChatbotInputBudget([{ content: "a".repeat(4001) }]);
    assert.equal(result.ok, false);
    assert.equal(result.violation, "message_too_long");
  });

  check("input-budget rejects oversize aggregate content", () => {
    const messages = Array.from({ length: 20 }, () => ({
      content: "a".repeat(3000),
    }));
    const result = checkChatbotInputBudget(messages);
    assert.equal(result.ok, false);
    assert.equal(result.violation, "aggregate_too_long");
  });
}

console.log(`\n${passed} checks passed.`);

function ensureServerOnlyShim(projectRoot) {
  const dir = path.join(projectRoot, "node_modules", "server-only");
  if (fs.existsSync(path.join(dir, "index.js"))) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "server-only", version: "0.0.1", main: "index.js" }),
  );
  fs.writeFileSync(path.join(dir, "index.js"), "module.exports = {};\n");
}

function loadEnvLocal(projectRoot) {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    console.warn("chatbot-smoke: could not load .env.local", error.message);
  }
}
