import { adminCardClass, adminEyebrowClass } from "@/components/admin/AdminUi";
import type { KpiTabData } from "@/lib/services/kpi-report-data";
import type {
  KpiColumn,
  KpiFormat,
  KpiRow,
  KpiSection,
} from "@/lib/services/kpi-report";

/**
 * The KPI tab: the Lead Gen KPI Framework as four tables. Reads only what
 * `getKpiTab` returns. A null renders as a dash with "not observed" on hover.
 */
export function KpiTab({ data }: { data: KpiTabData }) {
  if (!data.connected) {
    return (
      <div className={adminCardClass}>
        <p className="text-ui-text-muted text-sm">
          The channel spine is not connected yet, so there is nothing to report.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <p className="text-ui-text-subtle text-xs">
        {data.range.label} ({data.range.startDay} to {data.range.endDay}). A
        dash means not observed, never zero. Opt-in and Conv % are over every
        visit in the range, counting a visit-day that converted nobody. Rates
        further down the funnel are measured only where both sides were observed
        on the same rows; a rate that came out above 100% is shown as not
        observed because its two sides were not one population.
      </p>
      {data.report.sections.map((section) => (
        <KpiSectionTable key={section.key} section={section} />
      ))}
    </div>
  );
}

function KpiSectionTable({ section }: { section: KpiSection }) {
  return (
    <section className={adminCardClass} aria-label={section.title}>
      <h2 className={adminEyebrowClass}>{section.title}</h2>
      <p className="text-ui-text-subtle mt-2 text-xs">{section.basis}</p>
      {section.rows.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          Nothing observed in this range.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[96rem] text-[0.8125rem]">
            <thead>
              <tr
                className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
              >
                <th className="py-2 pr-4 font-semibold">Row</th>
                {section.columns.map((column) => (
                  <th
                    key={column.key}
                    className="py-2 pr-3 text-right font-semibold whitespace-nowrap"
                  >
                    {column.label}
                  </th>
                ))}
                <th className="py-2 pr-3 font-semibold whitespace-nowrap">
                  Owner · cadence
                </th>
                <th className="py-2 font-semibold whitespace-nowrap">
                  Last verified
                </th>
              </tr>
            </thead>
            <tbody className="divide-ui-line divide-y">
              {section.rows.map((row) => (
                <KpiTableRow
                  key={row.key}
                  row={row}
                  columns={section.columns}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.hidden > 0 ? (
        <p className="text-ui-text-subtle mt-2 text-xs">
          {section.hidden} more {section.hidden === 1 ? "row" : "rows"}{" "}
          {section.hiddenNote}.
        </p>
      ) : null}
    </section>
  );
}

function KpiTableRow({ row, columns }: { row: KpiRow; columns: KpiColumn[] }) {
  return (
    <tr>
      <td className="min-w-[14rem] py-2.5 pr-4 align-top">
        <div className="text-ui-text font-medium whitespace-nowrap">
          {row.label}
          {row.detail ? (
            <span className="text-ui-text-muted font-normal">
              {" "}
              · {row.detail}
            </span>
          ) : null}
        </div>
        <div
          className="text-ui-text-subtle text-xs whitespace-nowrap"
          title="Source of truth"
        >
          {row.sourceOfTruth}
        </div>
      </td>
      {columns.map((column) => (
        <td
          key={column.key}
          className="py-2.5 pr-3 text-right align-top whitespace-nowrap tabular-nums"
        >
          <Cell value={row.values[column.key] ?? null} format={column.format} />
        </td>
      ))}
      <td className="text-ui-text-muted py-2.5 pr-3 align-top text-xs whitespace-nowrap">
        {row.owner ?? "—"} · {row.cadence}
      </td>
      <td className="text-ui-text-muted py-2.5 align-top text-xs whitespace-nowrap">
        {row.lastVerified ? (
          <span title={row.lastVerified}>{row.lastVerified.slice(0, 10)}</span>
        ) : (
          <span title="A connector behind this row has not run">—</span>
        )}
      </td>
    </tr>
  );
}

function Cell({ value, format }: { value: number | null; format: KpiFormat }) {
  if (value == null) {
    return (
      <span className="text-ui-text-subtle" title="Not observed">
        —
      </span>
    );
  }
  if (format === "money") return <>${Math.round(value).toLocaleString()}</>;
  if (format === "percent") return <>{value}%</>;
  return <>{value.toLocaleString()}</>;
}
