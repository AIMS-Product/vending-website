export const seoAgentProviderOptions = [
  {
    value: "openai",
    label: "OpenAI",
    description: "Current GPT setup",
  },
  {
    value: "cerebras",
    label: "Cerebras",
    description: "gpt-oss-120b speed test",
  },
] as const;

export type SeoAgentProvider =
  (typeof seoAgentProviderOptions)[number]["value"];

export function seoAgentProviderLabel(provider: SeoAgentProvider) {
  return (
    seoAgentProviderOptions.find((option) => option.value === provider)
      ?.label ?? provider
  );
}
