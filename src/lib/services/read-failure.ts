/**
 * Logs a report loader's failed read with context. Loaders keep returning an
 * empty result so a page still renders, but a failure must reach the logs: an
 * empty panel with no trace reads as "nothing happened" rather than "could not
 * load", which is the one thing the numbers must never say.
 */
export function logReadFailure(loader: string, error: unknown): void {
  const detail =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown; message?: unknown })
      : {};
  console.error(`${loader} read failed`, {
    code: typeof detail.code === "string" ? detail.code : undefined,
    message:
      typeof detail.message === "string" ? detail.message : String(error),
  });
}
