export const seoAgentProviderOptions = [
  {
    value: "cerebras",
    label: "Cerebras",
    description: "gpt-oss-120b",
  },
  {
    value: "openai",
    label: "OpenAI",
    description: "Current GPT setup",
  },
] as const;

export type SeoAgentProvider =
  (typeof seoAgentProviderOptions)[number]["value"];

export const defaultSeoAgentProvider: SeoAgentProvider = "cerebras";
