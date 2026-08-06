import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import {
  buildAttributionOverview,
  type AttributionFieldRow,
  type AttributionOverview,
} from "@/lib/services/attribution-overview";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Attribution health",
  robots: { index: false, follow: false },
};

// The report probes Close on every load, so it must never be prerendered.
export const dynamic = "force-dynamic";

const FIELD_STATUS_LABEL: Record<AttributionFieldRow["status"], string> = {
  live: "Live",
  not_configured: "Not set up",
  missing_in_close: "No Close field",
  wrong_object: "Wrong object",
  value_rejected: "Value rejected",
  unverified: "Unverified",
};

const FIELD_STATUS_TONE: Record<AttributionFieldRow["status"], string> = {
  live: "active",
  not_configured: "idle",
  missing_in_close: "failed",
  wrong_object: "failed",
  value_rejected: "failed",
  unverified: "pending",
};

export default async function AdminAttributionPage() {
  const [{ user, role }, overview] = await Promise.all([
    requireAdmin(),
    buildAttributionOverview(),
  ]);

  return (
    <AdminShell
      activeSection="attribution"
      eyebrow="Lead operations"
      title="Attribution health"
      description="Every channel that carries a lead into Close, checked against the live Close account. Technical identifiers are shown deliberately — this is a diagnostics surface."
      userEmail={user.email}
      userRole={role}
    >
      <ConnectionNotice overview={overview} />

      <AdminMetricStrip>
        <AdminMetricPanel
          tone="green"
          label="Live"
          value={overview.counts.live}
          caption="Reaching Close"
        />
        <AdminMetricPanel
          tone="amber"
          label="Needs attention"
          value={overview.counts.attention}
          caption="Configured but broken"
        />
        <AdminMetricPanel
          tone="slate"
          label="Not set up"
          value={overview.counts.notConfigured}
          caption="No environment variable"
        />
        <AdminMetricPanel
          tone="blue"
          label="Environment"
          value={overview.environment}
          caption="Values differ per environment"
        />
      </AdminMetricStrip>

      <EntryPointsSection overview={overview} />
      <FieldsSection fields={overview.fields} />
    </AdminShell>
  );
}

function ConnectionNotice({ overview }: { overview: AttributionOverview }) {
  const problems = [
    overview.closeConnected
      ? null
      : "No Close API key is set in this environment.",
    overview.probeError
      ? `Could not read the Close account: ${overview.probeError}`
      : null,
    overview.leadStatus.issue,
  ].filter((problem): problem is string => Boolean(problem));

  if (!problems.length) return null;

  return (
    <section className={`${adminPanelClass} mb-4 p-4`}>
      <h2 className={adminSectionTitleClass}>Needs your attention</h2>
      <ul className="mt-2 space-y-1.5">
        {problems.map((problem) => (
          <li key={problem} className="text-ui-text-muted text-sm">
            {problem}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EntryPointsSection({ overview }: { overview: AttributionOverview }) {
  return (
    <section className={`${adminPanelClass} mb-4`}>
      <header className="border-ui-line border-b p-4">
        <h2 className={adminSectionTitleClass}>Entry points</h2>
        <p className="text-ui-text-muted mt-1 text-sm">
          Each form that creates a lead, the pages it runs on, and the tag it
          sends.
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="text-ui-text-subtle text-left text-[0.8125rem]">
            <tr className="border-ui-line border-b">
              <th className="px-4 py-2 font-medium">Form</th>
              <th className="px-4 py-2 font-medium">Pages</th>
              <th className="px-4 py-2 font-medium">Entry source</th>
              <th className="px-4 py-2 font-medium">Resource tag</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {overview.entryPoints.map((entry) => (
              <tr key={entry.formId} className="align-top">
                <td className="text-ui-text px-4 py-3 font-medium">
                  {entry.name}
                </td>
                <td className="text-ui-text-muted px-4 py-3">
                  <ul className="space-y-0.5">
                    {entry.routes.map((route) => (
                      <li key={route}>{route}</li>
                    ))}
                  </ul>
                </td>
                <td className="text-ui-text-muted px-4 py-3">
                  {entry.entrySource}
                </td>
                <td className="text-ui-text-muted px-4 py-3">
                  {entry.resourceTag}
                </td>
                <td className="px-4 py-3">
                  <AdminStatusBadge
                    status={
                      entry.status === "live"
                        ? "active"
                        : entry.status === "blocked"
                          ? "failed"
                          : "idle"
                    }
                    label={
                      entry.status === "live"
                        ? "Live"
                        : entry.status === "blocked"
                          ? "Blocked"
                          : "Not set up"
                    }
                  />
                  {entry.issue ? (
                    <p className="text-ui-text-muted mt-1.5 max-w-md text-[0.8125rem]">
                      {entry.issue}
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FieldsSection({ fields }: { fields: AttributionFieldRow[] }) {
  // Broken-but-configured rows first: those are the ones costing data today.
  const ordered = [...fields].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status),
  );

  return (
    <section className={adminPanelClass}>
      <header className="border-ui-line border-b p-4">
        <h2 className={adminSectionTitleClass}>Close field routing</h2>
        <p className="text-ui-text-muted mt-1 text-sm">
          Every field the site can send, whether this environment is configured
          to send it, and whether Close still accepts it.
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm">
          <thead className="text-ui-text-subtle text-left text-[0.8125rem]">
            <tr className="border-ui-line border-b">
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Environment variable</th>
              <th className="px-4 py-2 font-medium">Written to</th>
              <th className="px-4 py-2 font-medium">Close field</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {ordered.map((field) => (
              <tr key={field.key} className="align-top">
                <td className="text-ui-text px-4 py-3 font-medium">
                  {field.label}
                </td>
                <td className="text-ui-text-muted px-4 py-3 font-mono text-[0.8125rem]">
                  {field.envVar}
                </td>
                <td className="text-ui-text-muted px-4 py-3 capitalize">
                  {field.scope}
                </td>
                <td className="text-ui-text-muted px-4 py-3">
                  {field.closeFieldName ? (
                    <>
                      <span className="text-ui-text">
                        {field.closeFieldName}
                      </span>
                      <span className="text-ui-text-subtle block text-[0.8125rem]">
                        {field.closeFieldType}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                  {field.fieldId ? (
                    <span className="text-ui-text-subtle mt-0.5 block font-mono text-[0.75rem] break-all">
                      {field.fieldId}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <AdminStatusBadge
                    status={FIELD_STATUS_TONE[field.status]}
                    label={FIELD_STATUS_LABEL[field.status]}
                  />
                  {field.issue ? (
                    <p className="text-ui-text-muted mt-1.5 max-w-md text-[0.8125rem]">
                      {field.issue}
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function statusRank(status: AttributionFieldRow["status"]) {
  if (status === "wrong_object" || status === "missing_in_close") return 0;
  if (status === "value_rejected") return 1;
  if (status === "unverified") return 2;
  if (status === "live") return 3;
  return 4;
}
