import "server-only";

import {
  applyPageBuilderAiToolCalls,
  type PageBuilderAiChatRequest,
  type PageBuilderAiChatResponse,
} from "@/lib/page-builder/ai-chat";
import { assessReplacementSeoDraftQuality } from "@/lib/page-builder/ai-chat-intent-fallback";
import { assessSeoCopyQuality } from "@/lib/page-builder/copy-quality";
import { SEO_COPY_STANDARDS } from "@/lib/page-builder/copy-standards";

const MAX_ISSUES_IN_REPAIR_PROMPT = 12;
const MAX_DRAFT_JSON_CHARS = 14000;

const contentToolPrefixes = [
  "edit_block_",
  "add_block",
  "add_image_text_section",
  "add_media_block",
  "replace_page_sections",
];

export function hasContentToolCalls(response: PageBuilderAiChatResponse) {
  return response.toolCalls.some((call) =>
    contentToolPrefixes.some((prefix) => call.name.startsWith(prefix)),
  );
}

// Deterministic list of copy problems in a response: copy-quality gate
// failures on the applied result, plus complete-draft-tier misses that would
// make the intent fallback discard the draft. Empty array = nothing to fix.
export function collectDraftCopyIssues(
  request: PageBuilderAiChatRequest,
  response: PageBuilderAiChatResponse,
): string[] {
  if (!hasContentToolCalls(response)) return [];

  let counter = 0;
  const apply = applyPageBuilderAiToolCalls({
    content: request.context.content,
    toolCalls: response.toolCalls,
    makeBlockId: () => `ai_repair_${(counter += 1)}`,
  });
  if (!apply.results.some((result) => result.status === "applied")) return [];

  const replaceCall = response.toolCalls.find(
    (call) => call.name === "replace_page_sections",
  );
  const issues: string[] = [];

  const gate = assessSeoCopyQuality(apply.content, {
    targetKeyword: request.context.targetKeyword,
    scope: replaceCall ? "page" : "fragment",
  });
  for (const finding of gate.findings) {
    if (finding.severity !== "fail") continue;
    issues.push(
      finding.blockId
        ? `${finding.message} (block ${finding.blockId})`
        : finding.message,
    );
  }

  if (replaceCall) {
    const draftTier = SEO_COPY_STANDARDS.completeDraft;
    const draft = assessReplacementSeoDraftQuality(
      replaceCall.input,
      request.context.targetKeyword,
    );
    const reasonMessages: Record<string, string> = {
      too_few_blocks: `The draft needs at least ${draftTier.minBlocks} blocks.`,
      too_few_cards: `Include a card grid with at least ${draftTier.minCards} cards.`,
      too_few_faqs: `Include an FAQ with at least ${draftTier.minFaqItems} items.`,
      too_few_words: `Write at least ${draftTier.minVisibleWords} words of visible copy across the draft.`,
      keyword_overuse: `Use the exact target keyword at most ${draftTier.maxExactKeywordMentions} times.`,
      empty_visible_block:
        "Every visible block needs real copy — no empty bodies.",
      review_risk_language:
        "Remove guarantee/outcome claims; use review-safe phrasing like 'can help' or 'is typically planned around'.",
    };
    for (const reason of draft.reasons) {
      const message = reasonMessages[reason];
      if (message) issues.push(message);
    }
  }

  return [...new Set(issues)].slice(0, MAX_ISSUES_IN_REPAIR_PROMPT);
}

export function buildCopyRepairRequest(
  request: PageBuilderAiChatRequest,
  response: PageBuilderAiChatResponse,
  issues: string[],
): PageBuilderAiChatRequest {
  const draftJson = JSON.stringify({
    message: response.message,
    toolCalls: response.toolCalls,
  }).slice(0, MAX_DRAFT_JSON_CHARS);

  return {
    ...request,
    messages: [
      ...request.messages,
      {
        role: "assistant",
        content: `My previous draft (JSON): ${draftJson}`,
      },
      {
        role: "user",
        content: [
          "An automated copy-quality gate rejected that draft. Fix every issue below and resend the complete corrected tool calls (send full payloads, not diffs). Keep the structure, block ids, and all copy that was not flagged.",
          ...issues.map((issue) => `- ${issue}`),
        ].join("\n"),
      },
    ],
  };
}

// Generate-verify-repair loop. `generate` is the provider call returning a
// pre-normalization chat response; at most `maxAttempts` repair round-trips
// run, and a repair is kept only when it strictly reduces the issue list.
export async function generateWithCopyRepair(
  request: PageBuilderAiChatRequest,
  generate: (
    attempt: PageBuilderAiChatRequest,
  ) => Promise<PageBuilderAiChatResponse>,
  maxAttempts = 1,
): Promise<{ response: PageBuilderAiChatResponse; repaired: boolean }> {
  let response = await generate(request);
  let issues = collectDraftCopyIssues(request, response);
  let repaired = false;

  for (
    let attempt = 0;
    attempt < maxAttempts && issues.length > 0;
    attempt += 1
  ) {
    let candidate: PageBuilderAiChatResponse;
    try {
      candidate = await generate(
        buildCopyRepairRequest(request, response, issues),
      );
    } catch {
      break; // repair is best-effort; keep the original response
    }
    if (hasContentToolCalls(response) && !hasContentToolCalls(candidate)) {
      break; // the retry dropped the actual edit — keep the original
    }
    const candidateIssues = collectDraftCopyIssues(request, candidate);
    if (candidateIssues.length >= issues.length) break;
    response = candidate;
    issues = candidateIssues;
    repaired = true;
  }

  return { response, repaired };
}
