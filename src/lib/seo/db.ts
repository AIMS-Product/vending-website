/**
 * True when Postgres or PostgREST says the table is not there. SEO migrations
 * are pasted into the SQL editor by hand, so code ships before its tables and
 * must say "skipped: table missing" instead of failing.
 */
export function isMissingTable(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return (
    /relation .* does not exist/.test(message) ||
    message.includes("Could not find the table")
  );
}

export const TABLE_MISSING =
  "table missing; paste the SEO migration from supabase/migrations/APPLY-IN-SQL-EDITOR.md";
