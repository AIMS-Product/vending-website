// Client-safe flag vocabulary shared by admin UI (client components) and the
// server-only admin service. Keep free of server-only imports.
export const CHATBOT_FLAGS = [
  "quality_good",
  "quality_bad",
  "needs_prompt_tuning",
  "lead_high_intent",
  "lead_low_intent",
  "followup_needed",
  "handoff_missed",
] as const;

export type ChatbotFlag = (typeof CHATBOT_FLAGS)[number];

export function isChatbotFlag(value: string): value is ChatbotFlag {
  return (CHATBOT_FLAGS as readonly string[]).includes(value);
}
