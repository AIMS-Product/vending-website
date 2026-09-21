import {
  AdminStatusBadge,
  adminEyebrowClass,
  adminPanelClass,
  adminSectionTitleClass,
  adminStickyHeadClass,
} from "@/components/admin/AdminUi";
import {
  trustTone,
  trustVerdict,
  type DataTrust,
  type TrustCheck,
} from "@/lib/services/data-trust";

/** A count we stored or a source reported. A dash means not observed. */
function Count({ value }: { value: number | null }) {
  return (
    <span className="tabular-nums">
      {value == null ? (
        <span className="text-ui-text-subtle">—</span>
      ) : (
        value.toLocaleString("en-US")
      )}
    </span>
  );
}

/**
 * Last night's comparison, one row per number we check against its source.
 *
 * The verdict column says what to do rather than naming the state: an admin
 * about to quote a figure in a meeting needs "do not quote", not "fail".
 */
export function TrustChecks({
  run,
  checksError,
}: Pick<DataTrust, "run" | "checksError">) {
  if (checksError) {
    return (
      <section className={`${adminPanelClass} mb-5 p-4`}>
        <h2 className={adminSectionTitleClass}>Source checks</h2>
        <p className="text-ui-bad mt-2 text-sm">
          The stored checks could not be read: {checksError}
        </p>
      </section>
    );
  }
  if (!run) {
    return (
      <section className={`${adminPanelClass} mb-5 p-4`}>
        <h2 className={adminSectionTitleClass}>Source checks</h2>
        <p className="text-ui-text-subtle mt-2 text-sm">
          No check has been stored yet. The audit runs daily at 12:30 UTC and
          writes its verdicts here.
        </p>
      </section>
    );
  }

  const disagreeing = run.checks.filter(
    (check) => check.status === "fail" || check.status === "warn",
  );

  return (
    <section className={`${adminPanelClass} mb-5`}>
      <div className="border-ui-line flex flex-wrap items-baseline justify-between gap-2 border-b p-4">
        <div>
          <h2 className={adminSectionTitleClass}>Source checks</h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            Every number below was asked of the system that owns it and compared
            with what we stored.
          </p>
        </div>
        <p className="text-ui-text-subtle text-xs">
          Last run {new Date(run.runAt).toLocaleString("en-US")} ·{" "}
          {disagreeing.length === 0
            ? "everything agreed"
            : `${disagreeing.length} of ${run.checks.length} disagreed`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-[0.8125rem]">
          <thead className={adminStickyHeadClass}>
            <tr
              className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
            >
              <th className="py-2 pr-3 pl-4 font-semibold">Number</th>
              <th className="py-2 pr-3 font-semibold">Source</th>
              <th className="py-2 pr-3 text-right font-semibold">We stored</th>
              <th className="py-2 pr-3 text-right font-semibold">
                Source says
              </th>
              <th className="py-2 pr-3 font-semibold">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {run.checks.map((check) => (
              <CheckRow key={check.checkId} check={check} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CheckRow({ check }: { check: TrustCheck }) {
  return (
    <tr>
      <td className="text-ui-text py-2.5 pr-3 pl-4">
        <span className="font-medium">{check.label}</span>
        <span className="text-ui-text-subtle block text-xs">
          {check.window}
        </span>
      </td>
      <td className="text-ui-text-muted py-2.5 pr-3">{check.sourceName}</td>
      <td className="text-ui-text py-2.5 pr-3 text-right">
        <Count value={check.ours} />
      </td>
      <td className="text-ui-text py-2.5 pr-3 text-right">
        <Count value={check.source} />
      </td>
      <td className="py-2.5 pr-3">
        <AdminStatusBadge
          status={check.status}
          tone={trustTone(check.status)}
          label={trustVerdict(check.status)}
        />
        <span className="text-ui-text-subtle mt-1 block max-w-[28rem] text-xs">
          {check.detail}
        </span>
      </td>
    </tr>
  );
}

/**
 * The glossary itself, rendered from `REPORTING.md` so the page and the file
 * can never disagree. Sanitised by `renderMarkdown` before it gets here.
 */
export function GlossaryPanel({
  glossaryHtml,
  glossaryError,
}: Pick<DataTrust, "glossaryHtml" | "glossaryError">) {
  return (
    <section className={`${adminPanelClass} p-4 sm:p-6`}>
      {glossaryHtml ? (
        <div
          className="admin-glossary"
          dangerouslySetInnerHTML={{ __html: glossaryHtml }}
        />
      ) : (
        <>
          <h2 className={adminSectionTitleClass}>Glossary</h2>
          <p className="text-ui-bad mt-2 text-sm">
            The glossary could not be loaded: {glossaryError}
          </p>
        </>
      )}
    </section>
  );
}
