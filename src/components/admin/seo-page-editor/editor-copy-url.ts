export type CopyMessage = {
  message: string;
  tone: "success" | "error";
  manualUrl?: string;
};

export async function copyRailUrl(
  getUrl: () => string | null,
  successMessage: string,
  writeText: (value: string) => Promise<void> = (value) =>
    navigator.clipboard.writeText(value),
) {
  const url = getUrl();
  if (!url) return null;

  try {
    await writeText(url);
    return { message: successMessage, tone: "success" } satisfies CopyMessage;
  } catch {
    return {
      message: "Copy failed. Select the URL below to copy it manually.",
      tone: "error",
      manualUrl: url,
    } satisfies CopyMessage;
  }
}
