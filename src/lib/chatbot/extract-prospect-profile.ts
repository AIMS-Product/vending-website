import "server-only";

import { z } from "zod";
import { extractChatbotJson } from "@/lib/chatbot/openai";

/**
 * OpenAI JSON-mode profile extraction over a full transcript. This is the
 * ONLY LLM call in the learning loop (see spec §Learning) — the deterministic
 * engine reads its output as one more signal, never calls OpenAI itself.
 *
 * Fail-soft by contract: any missing key, shape mismatch, or API error
 * returns null and logs a warning. Never throws, never blocks the caller
 * (the digest cron / backfill job).
 */
export const prospectProfileSchema = z.object({
  name: z.string().trim().min(1).nullable().catch(null),
  email: z.string().trim().min(1).nullable().catch(null),
  phone: z.string().trim().min(1).nullable().catch(null),
  current_work: z.string().trim().min(1).nullable().catch(null),
  capital_signal: z.string().trim().min(1).nullable().catch(null),
  timeline: z.string().trim().min(1).nullable().catch(null),
  state_or_market: z.string().trim().min(1).nullable().catch(null),
  motivation: z.string().trim().min(1).nullable().catch(null),
  objections: z.array(z.string()).catch([]),
  resources_wanted: z.array(z.string()).catch([]),
  call_intent: z.boolean().catch(false),
  sentiment: z.string().trim().min(1).nullable().catch(null),
  follow_up_needed: z.boolean().catch(false),
  summary: z.string().trim().min(1).nullable().catch(null),
});

export type ProspectProfile = z.infer<typeof prospectProfileSchema>;

const EXTRACTION_SYSTEM_PROMPT = `You extract structured facts from a vending-business sales chat transcript. Respond with a single JSON object only, matching this shape exactly:
{"name": string|null, "email": string|null, "phone": string|null, "current_work": string|null, "capital_signal": string|null, "timeline": string|null, "state_or_market": string|null, "motivation": string|null, "objections": string[], "resources_wanted": string[], "call_intent": boolean, "sentiment": string|null, "follow_up_needed": boolean, "summary": string|null}
Use null for anything not stated in the transcript. "call_intent" is true only if the visitor asked to talk to someone, book a call, or similar. "summary" is one plain sentence. Never invent facts not present in the transcript.`;

export type ChatbotTranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Plain-text transcript the model reads, in order. */
export function formatTranscriptForExtraction(
  messages: readonly ChatbotTranscriptMessage[],
): string {
  return messages
    .map((message) => `${message.role === "user" ? "Visitor" : "Mia"}: ${message.content}`)
    .join("\n");
}

export async function extractProspectProfile(
  messages: readonly ChatbotTranscriptMessage[],
  options: { model: string; apiKey?: string; fetchFn?: typeof fetch },
): Promise<ProspectProfile | null> {
  const transcript = formatTranscriptForExtraction(messages);
  if (!transcript.trim()) return null;

  try {
    const raw = await extractChatbotJson({
      model: options.model,
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userContent: transcript,
      apiKey: options.apiKey,
      fetchFn: options.fetchFn,
    });
    const parsed = prospectProfileSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("chatbot: prospect profile extraction shape mismatch", {
        error: parsed.error.issues[0]?.message,
      });
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.warn("chatbot: prospect profile extraction failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}
