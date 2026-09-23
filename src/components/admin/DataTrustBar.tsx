import Link from "next/link";
import {
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import { DefinitionsLink } from "@/components/admin/TrustMarks";
import type { TrustBarModel, TrustTone } from "@/lib/analytics/data-trust-bar";

const PT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function pt(iso: string): string {
  return `${PT.format(new Date(iso))} PT`;
}

const TONE_WORD: Record<TrustTone, string> = {
  ok: "Current",
  warn: "Behind",
  bad: "Out of date",
};

const AUDIT_WORD: Record<TrustTone, string> = {
  ok: "All passed",
  warn: "Worth a look",
  bad: "Do not quote",
};

/**
 * One bar, the same on every analytics tab and on /admin/data: how fresh this
 * tab's numbers are, whether last night's checks passed, which numbers on it
 * are unverified, and where the words are defined. Every state says itself in
 * words; nothing here is green because a read came back empty.
 */
export function DataTrustBar({ model }: { model: TrustBarModel }) {
  const { audit } = model;
  return (
    <section
      aria-label="Can these numbers be trusted"
      className={`${adminCardClass} mb-5 space-y-3`}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className={adminEyebrowClass}>Freshness</p>
          <p className="text-ui-text mt-1 flex flex-wrap items-center gap-2 text-sm">
            <AdminStatusBadge
              status={model.freshnessTone}
              tone={model.freshnessTone}
              label={TONE_WORD[model.freshnessTone]}
            />
            <span>
              {model.asOf ? (
                <>
                  Data as of{" "}
                  <span className="font-semibold">{pt(model.asOf)}</span>
                </>
              ) : (
                <span className="font-semibold">
                  At least one source for this tab has no update on record
                </span>
              )}
            </span>
          </p>
          <p className="text-ui-text-subtle mt-1 text-xs">
            The oldest of the {model.feedCount} sources this tab reads.
          </p>
          {model.problems.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {model.problems.map((problem) => (
                <li
                  key={problem.feed}
                  className={
                    problem.tone === "bad" ? "text-ui-bad" : "text-ui-text"
                  }
                >
                  <span className="font-semibold">{problem.label}</span>{" "}
                  {problem.problem}
                  {problem.lastSuccessAt && !problem.problem?.startsWith("last")
                    ? ` (last update ${pt(problem.lastSuccessAt)})`
                    : null}
                  .
                </li>
              ))}
            </ul>
          ) : null}
          {model.notConnected.length > 0 ? (
            <ul className="text-ui-text mt-1.5 space-y-0.5 text-xs">
              {model.notConnected.map((feed) => (
                <li key={feed.feed}>
                  <span className="font-semibold">{feed.label}</span> is not
                  connected: {feed.problem}. Its numbers read as no data, and it
                  is left out of the date above.
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <p className={adminEyebrowClass}>Last night&apos;s checks</p>
          <p className="text-ui-text mt-1 flex flex-wrap items-center gap-2 text-sm">
            <AdminStatusBadge
              status={audit.tone}
              tone={audit.tone}
              label={
                audit.ranLastNight ? AUDIT_WORD[audit.tone] : "Did not run"
              }
            />
            {audit.error ? (
              <span className="text-ui-bad font-semibold">
                The checks could not be read: {audit.error}
              </span>
            ) : !audit.runAt ? (
              <span className="text-ui-bad font-semibold">
                No check has ever been stored, so nothing on this page has been
                verified.
              </span>
            ) : (
              <span>
                <span className="font-semibold">
                  {audit.passed} of {audit.total} passed
                </span>
                {audit.ranLastNight ? null : (
                  <span className="text-ui-bad font-semibold">
                    {" "}
                    — the check did not run last night. These results are from{" "}
                    {pt(audit.runAt)}.
                  </span>
                )}
              </span>
            )}
          </p>
          {audit.notPassed.length > 0 ? (
            <p className="text-ui-text-muted mt-1.5 text-xs">
              Not passed:{" "}
              {audit.notPassed
                .map((check) => `${check.label} (${STATUS_WORD[check.status]})`)
                .join(" · ")}
            </p>
          ) : null}
          {model.scope === "data" ? null : (
            <Link
              href="/admin/data"
              className="text-ui-accent mt-1 inline-block text-xs font-medium underline-offset-2 hover:underline"
            >
              See every check and what it compared
            </Link>
          )}
        </div>
      </div>

      {model.flags.length > 0 ? (
        <div className="border-ui-line border-t pt-3">
          <p className={adminEyebrowClass}>Unverified on this tab</p>
          <ul className="mt-1 space-y-1 text-xs">
            {model.flags.map((flag) => (
              <li
                key={`${flag.metric}-${flag.reason}`}
                className="text-ui-text"
              >
                <span className="font-semibold">{flag.number}</span>
                {` (${flag.from} to ${flag.to})`}:{" "}
                <span className="text-ui-text-muted">{flag.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-ui-line flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
        <p className="text-ui-text-subtle text-xs">
          Not sure what a lead, a booked call or a skipped-form booking is?
        </p>
        <DefinitionsLink />
      </div>
    </section>
  );
}

const STATUS_WORD = {
  fail: "disagrees",
  error: "could not run",
  warn: "close",
  skipped: "not compared",
  pass: "passed",
} as const;
