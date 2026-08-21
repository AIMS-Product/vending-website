#!/usr/bin/env node
// Phase-4 smoke test for src/lib/chatbot/learning/engine.ts — the pure
// deterministic classifier (ZERO LLM calls, see spec §Learning).
//
// Run: node scripts/chatbot-learning-smoke.mjs
//
// Same jiti + server-only shim approach as scripts/chatbot-smoke.mjs (see
// that file's header comment for why). Seeds 8 synthetic conversations
// designed to hit every case type, both knowledge-suggestion candidates,
// both follow-up-task types, and two insight/site-recommendation topics —
// then runs the engine twice on the identical input and asserts the set of
// dedupe keys produced is exactly the same both times (idempotent re-runs,
// per spec: "everything dedupe-keyed and upserted — re-runs converge").
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

ensureServerOnlyShim(root);

const { createJiti } = await import("jiti");
const jiti = createJiti(root, { alias: { "@": path.join(root, "src") } });
const { runLearningEngine } = await jiti.import(
  path.join(root, "src/lib/chatbot/learning/engine.ts"),
);

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${label}`);
}

const NOW = new Date("2026-08-21T12:00:00.000Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const msg = (role, content, hAgo = 1) => ({ role, content, ts: hoursAgo(hAgo) });

const conversations = [
  {
    id: "conv-stalled",
    status: "lead_captured",
    createdAt: hoursAgo(50),
    lastMessageAt: hoursAgo(48), // >= 24h stale
    messages: [
      msg("user", "What's the total investment or cost to get started?", 48),
      msg("assistant", "Typically people start around $20k-30k depending on the route size.", 48),
    ],
    capturedName: null,
    capturedEmail: "stalled@example.com",
    capturedPhone: null,
    prospectProfile: null,
    flags: [],
  },
  {
    id: "conv-uncaptured-engaged",
    status: "active",
    createdAt: hoursAgo(1),
    lastMessageAt: hoursAgo(0.1),
    messages: [
      msg("user", "What kind of vending machine do you use?"),
      msg("user", "Is the machine equipment reliable?"),
      msg("user", "Is it easy to keep the machines running smoothly?"),
    ],
    capturedName: null,
    capturedEmail: null,
    capturedPhone: null,
    prospectProfile: null,
    flags: [],
  },
  {
    id: "conv-call-intent",
    status: "lead_captured",
    createdAt: hoursAgo(1),
    lastMessageAt: hoursAgo(0.17), // ~10 minutes ago, not stale
    messages: [msg("user", "Can we set up a call to go over details?", 0.17)],
    capturedName: "Jordan",
    capturedEmail: "caller@example.com",
    capturedPhone: null,
    prospectProfile: null,
    flags: [],
  },
  {
    id: "conv-pricing-1",
    status: "active",
    createdAt: hoursAgo(1),
    lastMessageAt: hoursAgo(0.1),
    messages: [msg("user", "How much does the program cost overall?")],
    capturedName: null,
    capturedEmail: null,
    capturedPhone: null,
    prospectProfile: null,
    flags: [],
  },
  {
    id: "conv-pricing-2",
    status: "active",
    createdAt: hoursAgo(1),
    lastMessageAt: hoursAgo(0.1),
    messages: [msg("user", "What's the investment or budget needed to start?")],
    capturedName: null,
    capturedEmail: null,
    capturedPhone: null,
    prospectProfile: null,
    flags: [],
  },
  {
    id: "conv-resource",
    status: "active",
    createdAt: hoursAgo(1),
    lastMessageAt: hoursAgo(0.1),
    messages: [msg("user", "Can you send me the roadmap resource or template?")],
    capturedName: null,
    capturedEmail: null,
    capturedPhone: null,
    prospectProfile: null,
    flags: [],
  },
  {
    id: "conv-fallback-1",
    status: "active",
    createdAt: hoursAgo(1),
    lastMessageAt: hoursAgo(0.1),
    messages: [
      msg("user", "What machines do you actually provide?"),
      msg(
        "assistant",
        "I don't have those details, I'd have to check with the team on the exact machine models.",
      ),
    ],
    capturedName: null,
    capturedEmail: null,
    capturedPhone: null,
    prospectProfile: null,
    flags: [],
  },
  {
    id: "conv-fallback-2",
    status: "active",
    createdAt: hoursAgo(1),
    lastMessageAt: hoursAgo(0.1),
    messages: [
      msg("user", "Do your machines come with warranties or support?"),
      msg(
        "assistant",
        "Best to check with the team on warranty specifics, I'm not totally sure of the exact terms.",
      ),
    ],
    capturedName: null,
    capturedEmail: null,
    capturedPhone: null,
    prospectProfile: null,
    flags: [],
  },
];

const result = runLearningEngine(conversations, { now: NOW, bookingUrl: "https://example.com/book-now" });

check("produces exactly 8 cases, one per conversation", () => {
  assert.equal(result.cases.length, 8);
});

const caseTypesByConversation = Object.fromEntries(
  result.cases.map((c) => [`${c.conversationId}:${c.caseType}`, c]),
);

check("stalled_lead fires for a captured conversation idle >= 24h", () => {
  assert.ok(caseTypesByConversation["conv-stalled:stalled_lead"]);
});
check("uncaptured_engaged fires for >=3 messages with no capture", () => {
  assert.ok(caseTypesByConversation["conv-uncaptured-engaged:uncaptured_engaged"]);
});
check("call_intent_no_booking fires on call-booking language", () => {
  assert.ok(caseTypesByConversation["conv-call-intent:call_intent_no_booking"]);
});
check("pricing_question_no_capture fires for both pricing conversations", () => {
  assert.ok(caseTypesByConversation["conv-pricing-1:pricing_question_no_capture"]);
  assert.ok(caseTypesByConversation["conv-pricing-2:pricing_question_no_capture"]);
});
check("resource_intent_no_capture fires for the resource conversation", () => {
  assert.ok(caseTypesByConversation["conv-resource:resource_intent_no_capture"]);
});
check("bot_fallback_pattern fires for both fallback conversations", () => {
  assert.ok(caseTypesByConversation["conv-fallback-1:bot_fallback_pattern"]);
  assert.ok(caseTypesByConversation["conv-fallback-2:bot_fallback_pattern"]);
});

check("follow-up tasks: exactly the two capture-eligible cases", () => {
  assert.equal(result.followUpTasks.length, 2);
  const byKey = Object.fromEntries(result.followUpTasks.map((t) => [t.dedupeKey, t]));
  assert.ok(byKey["conv-stalled:general_follow_up"]);
  assert.ok(byKey["conv-call-intent:invite_to_call"]);
  assert.match(byKey["conv-call-intent:invite_to_call"].draftBody, /https:\/\/example\.com\/book-now/);
  assert.match(byKey["conv-call-intent:invite_to_call"].draftBody, /Jordan/);
});

check("knowledge suggestions: pricing and machines fallback patterns, 2 shared each", () => {
  const keys = result.knowledgeSuggestions.map((s) => s.dedupeKey).sort();
  assert.deepEqual(keys, [
    "knowledge:bot_fallback_pattern:machines",
    "knowledge:pricing_question_no_capture:pricing_cost",
  ]);
  const pricingSuggestion = result.knowledgeSuggestions.find(
    (s) => s.dedupeKey === "knowledge:pricing_question_no_capture:pricing_cost",
  );
  assert.equal(pricingSuggestion.affectedCount, 2);
});

check("no knowledge suggestion for a single-conversation pattern (resources)", () => {
  const keys = result.knowledgeSuggestions.map((s) => s.dedupeKey);
  assert.ok(!keys.some((k) => k.includes("resources")));
});

check("insights: pricing_cost and machines both hit 3-conversation threshold", () => {
  const keys = result.insights.map((i) => i.dedupeKey).sort();
  assert.deepEqual(keys, ["insight:machines", "insight:pricing_cost"]);
  const pricing = result.insights.find((i) => i.dedupeKey === "insight:pricing_cost");
  assert.equal(pricing.insightType, "pricing_confusion");
  assert.equal(pricing.affectedCount, 3);
  assert.equal(pricing.impactScore, 2 * 3 + 3); // 2 dropoffs (pricing-1, pricing-2)
  const machines = result.insights.find((i) => i.dedupeKey === "insight:machines");
  assert.equal(machines.insightType, "missing_answer");
  assert.equal(machines.impactScore, 3 * 3 + 3); // 3 dropoffs (all uncaptured)
});

check("no insight for call_booking or resources (only 1 conversation each)", () => {
  const keys = result.insights.map((i) => i.dedupeKey);
  assert.ok(!keys.includes("insight:call_booking"));
  assert.ok(!keys.includes("insight:resources"));
});

check("site recommendations: one per applicable insight type", () => {
  assert.equal(result.siteRecommendations.length, 2);
  const keys = result.siteRecommendations.map((r) => r.dedupeKey).sort();
  assert.deepEqual(keys, [
    "siterec:insight:machines",
    "siterec:insight:pricing_cost",
  ]);
});

// --- Idempotency: same input + same `now` -> identical dedupe-key sets ----
const result2 = runLearningEngine(conversations, { now: NOW, bookingUrl: "https://example.com/book-now" });

function dedupeKeySet(engineResult) {
  return {
    cases: engineResult.cases.map((c) => c.dedupeKey).sort(),
    followUpTasks: engineResult.followUpTasks.map((t) => t.dedupeKey).sort(),
    knowledgeSuggestions: engineResult.knowledgeSuggestions.map((s) => s.dedupeKey).sort(),
    insights: engineResult.insights.map((i) => i.dedupeKey).sort(),
    siteRecommendations: engineResult.siteRecommendations.map((r) => r.dedupeKey).sort(),
  };
}

check("re-running the engine on the same snapshot produces identical dedupe keys", () => {
  assert.deepEqual(dedupeKeySet(result), dedupeKeySet(result2));
});

console.log(`\n${passed} checks passed.`);

function ensureServerOnlyShim(projectRoot) {
  // Unconditional overwrite, not "only if missing" — the real `server-only`
  // package (a transitive Next.js dep) throws from its default export
  // unless the "react-server" condition is active, which jiti's plain
  // `import()` never sets. Gitignored, so this never touches anything real.
  const dir = path.join(projectRoot, "node_modules", "server-only");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "server-only", version: "0.0.1", main: "index.js" }),
  );
  fs.writeFileSync(path.join(dir, "index.js"), "module.exports = {};\n");
}
