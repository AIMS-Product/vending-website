/**
 * Live model benchmark for the page builder AI surfaces.
 * Never runs in the normal suite — only via `npm run ai-benchmark`
 * (vitest.benchmark.config.ts). Requires real API keys and spends money.
 *
 * Configure with env vars:
 *   AI_BENCH_MODELS        comma list of provider:model[@effort][#copy]
 *   AI_BENCH_REPEATS       runs per model+task (default 2)
 *   AI_BENCH_SKIP_PROPOSAL set to skip the SEO proposal task (chat only)
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyPageBuilderAiToolCalls } from "@/lib/page-builder/ai-chat";
import { assessSeoCopyQuality } from "@/lib/page-builder/copy-quality";
import {
  proposedBlockHasSourceSupport,
  validateAiPageProposal,
} from "@/lib/page-builder/ai-proposals";
import {
  chatRequestForTask,
  chatTasks,
  proposalPage,
  proposalSourceBundle,
  proposalSourceIds,
} from "./fixtures";
import {
  listGeminiFlashModels,
  parseModelSpecs,
  runChatCall,
  runGeminiProposal,
  runOpenAiProposal,
  specLabel,
  type ModelSpec,
  type ProposalCapture,
} from "./providers";

const DEFAULT_MODELS = [
  "openai:gpt-5.5@medium",
  "openai:gpt-5.5@low",
  "openai:gpt-5-mini@medium",
  "openai:gpt-5-mini@low",
  "openai:gpt-5-nano@medium",
  "gemini:gemini-2.5-flash",
  "gemini:gemini-2.5-flash-lite",
].join(",");

type Row = {
  model: string;
  task: string;
  run: number;
  ms: number;
  outputTokens: number | null;
  tokensPerSec: number | null;
  score: number;
  notes: string;
};

describe("AI model benchmark", () => {
  it("benchmarks the configured models and writes a report", async () => {
    const specs = parseModelSpecs(
      process.env.AI_BENCH_MODELS ?? DEFAULT_MODELS,
    );
    const repeats = Math.max(1, Number(process.env.AI_BENCH_REPEATS ?? 2));
    const reportDir = path.resolve(
      __dirname,
      "../../reports",
      `ai-model-benchmark-${new Date().toISOString().slice(0, 10)}`,
    );
    fs.mkdirSync(path.join(reportDir, "responses"), { recursive: true });

    const rows: Row[] = [];
    let proposalCapture: ProposalCapture | undefined;

    for (const spec of specs) {
      const label = specLabel(spec);
      for (const task of chatTasks) {
        for (let run = 1; run <= repeats; run += 1) {
          const result = await runChatCall(spec, chatRequestForTask(task));
          const { score, notes } = scoreChatRun(task, result);
          rows.push({
            model: label,
            task: task.key,
            run,
            ms: Math.round(result.metrics.ms),
            outputTokens: result.metrics.outputTokens,
            tokensPerSec: tokensPerSec(result.metrics),
            score,
            notes,
          });
          saveTranscript(reportDir, label, `${task.key}-${run}`, {
            request: chatRequestForTask(task),
            response: result.response,
            error: result.error,
            raw: result.metrics.rawPayload,
          });
          progress(rows.at(-1)!);
        }
      }

      if (process.env.AI_BENCH_SKIP_PROPOSAL) continue;
      for (let run = 1; run <= repeats; run += 1) {
        const result =
          spec.provider === "openai"
            ? await runOpenAiProposal(spec, proposalPage, proposalSourceBundle)
            : proposalCapture
              ? await runGeminiProposal(spec, proposalCapture)
              : {
                  proposal: null,
                  metrics: {
                    ms: 0,
                    inputTokens: null,
                    outputTokens: null,
                    rawPayload: null,
                  },
                  error: "No captured OpenAI proposal request to replay.",
                };
        if ("capture" in result && result.capture) {
          proposalCapture = result.capture;
        }
        const { score, notes } = scoreProposalRun(
          result.proposal,
          result.error,
        );
        rows.push({
          model: label,
          task: "seo-proposal",
          run,
          ms: Math.round(result.metrics.ms),
          outputTokens: result.metrics.outputTokens,
          tokensPerSec: tokensPerSec(result.metrics),
          score,
          notes,
        });
        saveTranscript(reportDir, label, `seo-proposal-${run}`, {
          proposal: result.proposal,
          error: result.error,
          raw: result.metrics.rawPayload,
        });
        progress(rows.at(-1)!);
      }
    }

    const flashModels = await listGeminiFlashModels();
    writeReport(reportDir, rows, specs, repeats, flashModels);
    expect(rows.length).toBeGreaterThan(0);
  });
});

function scoreChatRun(
  task: (typeof chatTasks)[number],
  result: Awaited<ReturnType<typeof runChatCall>>,
): { score: number; notes: string } {
  if (!result.response) {
    return { score: 0, notes: result.error ?? "no response" };
  }
  const toolCalls = result.response.toolCalls;
  let blockIdCounter = 0;
  const apply = applyPageBuilderAiToolCalls({
    content: task.context.content,
    toolCalls,
    makeBlockId: () => `ai_bench_${(blockIdCounter += 1)}`,
  });
  const applied = apply.results.filter(
    (item) => item.status === "applied" || item.status === "queued",
  ).length;
  const failed = apply.results.filter(
    (item) => item.status === "failed",
  ).length;
  const toolMatch = toolCalls.some((call) =>
    task.expectAnyTool.some(
      (name) => call.name === name || call.name.startsWith(name),
    ),
  );

  let score = 25; // schema-valid, normalized response
  if (toolMatch) score += 25;
  if (task.expectClarification) {
    if (apply.clarification) score += 35;
  } else if (applied >= task.minApplied) {
    score += failed === 0 ? 35 : 20;
  }
  if (result.response.message.trim().length > 0) score += 15;

  let gateNote = "";
  if (task.gateScope && applied > 0) {
    const gate = assessSeoCopyQuality(apply.content, {
      targetKeyword: task.context.targetKeyword,
      scope: task.gateScope,
    });
    const failCodes = [
      ...new Set(
        gate.findings
          .filter((finding) => finding.severity === "fail")
          .map((finding) => finding.code),
      ),
    ];
    gateNote =
      gate.verdict === "pass"
        ? "gate=pass"
        : `gate=thin(${failCodes.join("|")})`;
    if (gate.verdict === "thin") score = Math.max(0, score - 25);
  }

  const copy = copyStats(toolCalls);
  const notes = [
    `tools=${toolCalls.map((call) => call.name).join("|") || "none"}`,
    `applied=${applied}`,
    failed ? `failed=${failed}` : "",
    task.expectClarification && !apply.clarification ? "no-clarification" : "",
    // A fallback-substituted draft means the gate/notes describe OUR template
    // copy, not the model's — never read those rows as model quality.
    result.response.source === "intent-fallback" ? "FALLBACK" : "",
    result.repaired ? "repaired" : "",
    gateNote,
    copy.words > 0 ? `words=${copy.words}` : "",
    copy.bullets > 0 ? `bullets=${copy.bullets}` : "",
    result.response.message.trim().length === 0 ? "no-message" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { score, notes };
}

// Rough copy volume across generated string props — for comparing prompt
// variants, not an absolute quality measure. Skips hrefs/ids/tracking names.
function copyStats(toolCalls: { input: unknown }[]) {
  let words = 0;
  let bullets = 0;
  const skipKeys = new Set([
    "href",
    "ctaHref",
    "trackingName",
    "ctaTrackingName",
    "id",
    "slug",
  ]);
  const walk = (value: unknown, key?: string) => {
    if (typeof value === "string") {
      if (key && skipKeys.has(key)) return;
      const count = value.split(/\s+/).filter(Boolean).length;
      if (count >= 3) words += count;
      return;
    }
    if (Array.isArray(value)) {
      if (key === "bulletItems" || key === "items") bullets += value.length;
      value.forEach((item) => walk(item, key));
      return;
    }
    if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value)) {
        walk(child, childKey);
      }
    }
  };
  toolCalls.forEach((call) => walk(call.input));
  return { words, bullets };
}

function scoreProposalRun(
  proposal: unknown,
  error: string | undefined,
): { score: number; notes: string } {
  if (error || !proposal) return { score: 0, notes: error ?? "no proposal" };
  const validated = validateAiPageProposal(proposal);
  if (!validated.success) {
    return {
      score: 10,
      notes: `invalid: ${validated.error.issues[0]?.message ?? "schema"}`,
    };
  }
  const blocks = validated.data.blocks;
  const knownIds = new Set([
    ...proposalSourceIds.documentIds,
    ...proposalSourceIds.excerptIds,
    ...proposalSourceIds.claimIds,
  ]);
  const refsValid = blocks.every((block) =>
    [
      ...block.sourceDocumentIds,
      ...block.sourceExcerptIds,
      ...block.approvedClaimIds,
    ].every((id) => knownIds.has(id)),
  );
  const sourceSupported = blocks.every(
    (block) =>
      proposedBlockHasSourceSupport(block) || block.warnings.length > 0,
  );

  let score = 40; // schema-valid proposal
  if (blocks.length >= 3) score += 20;
  if (refsValid) score += 20;
  if (sourceSupported) score += 20;
  return {
    score,
    notes: `blocks=${blocks.length}${refsValid ? "" : " bad-refs"}${
      sourceSupported ? "" : " unsupported-claims"
    }`,
  };
}

function tokensPerSec(metrics: {
  ms: number;
  outputTokens: number | null;
}): number | null {
  if (!metrics.outputTokens || metrics.ms <= 0) return null;
  return Math.round((metrics.outputTokens / metrics.ms) * 1000);
}

function saveTranscript(
  reportDir: string,
  model: string,
  name: string,
  payload: unknown,
) {
  const dir = path.join(reportDir, "responses", model.replace(/[:@]/g, "_"));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${name}.json`),
    JSON.stringify(payload, null, 2),
  );
}

function progress(row: Row) {
  console.log(
    `${row.model} ${row.task}#${row.run}: ${row.ms}ms score=${row.score} ${row.notes}`,
  );
}

function writeReport(
  reportDir: string,
  rows: Row[],
  specs: ModelSpec[],
  repeats: number,
  flashModels: string[],
) {
  fs.writeFileSync(
    path.join(reportDir, "results.json"),
    JSON.stringify(rows, null, 2),
  );

  const lines: string[] = [
    "# Page builder AI model benchmark",
    "",
    `Run: ${new Date().toISOString()} — ${repeats} repeat(s) per model+task.`,
    "",
    "Quality scores are deterministic (0–100): schema-valid response, expected",
    "tool usage, tool calls actually applying to the page draft, and proposal",
    "schema/source-reference validity. Read responses/ for the raw outputs.",
    "",
    "## Summary (mean per model)",
    "",
    "| Model | Mean latency (ms) | Mean tokens/s | Mean quality | Errors |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const spec of specs) {
    const label = specLabel(spec);
    const modelRows = rows.filter((row) => row.model === label);
    const ok = modelRows.filter((row) => row.score > 0);
    lines.push(
      `| ${label} | ${mean(ok.map((row) => row.ms))} | ${mean(
        ok.flatMap((row) => (row.tokensPerSec ? [row.tokensPerSec] : [])),
      )} | ${mean(modelRows.map((row) => row.score))} | ${
        modelRows.length - ok.length
      } |`,
    );
  }

  lines.push("", "## Per-run detail", "");
  lines.push(
    "| Model | Task | Run | ms | Out tokens | tok/s | Score | Notes |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.model} | ${row.task} | ${row.run} | ${row.ms} | ${
        row.outputTokens ?? "—"
      } | ${row.tokensPerSec ?? "—"} | ${row.score} | ${row.notes} |`,
    );
  }

  if (flashModels.length > 0) {
    lines.push("", "## Gemini flash models available to this key", "");
    for (const model of flashModels) lines.push(`- ${model}`);
  }

  fs.writeFileSync(path.join(reportDir, "README.md"), `${lines.join("\n")}\n`);
  console.log(`\nReport written to ${reportDir}`);
}

function mean(values: number[]): number | string {
  if (values.length === 0) return "—";
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}
