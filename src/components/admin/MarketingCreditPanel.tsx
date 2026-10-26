import type { ReactNode } from "react";
import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { TD, TH } from "@/components/admin/marketing-mtd-format";
import { formatUsd as money } from "@/lib/admin/format-number";
import type { MarketingCredit } from "@/lib/services/marketing-credit-data";
import { SURFACES } from "@/lib/services/self-booked";

type Loaded = Extract<MarketingCredit, { ok: true }>;

const ROW_TH = "px-4 py-2 text-left font-medium whitespace-nowrap";
const HEAD_TH = "px-4 py-2.5 text-left font-semibold";
const n = (value: number) => value.toLocaleString("en-US");
const pct = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section className={adminPanelClass} aria-label={title}>
      <div className="px-4 pt-4">
        <h2 className={adminSectionTitleClass}>{title}</h2>
        {caption ? (
          <p className="text-ui-text-subtle mt-1 text-xs">{caption}</p>
        ) : null}
      </div>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </section>
  );
}

function Table({
  head,
  rows,
  total,
}: {
  head: readonly string[];
  rows: ReadonlyArray<readonly ReactNode[]>;
  total?: readonly ReactNode[];
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-ui-canvas text-ui-text-muted text-xs">
        <tr>
          {head.map((h, i) => (
            <th key={h} scope="col" className={i === 0 ? HEAD_TH : TH}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, r) => (
          <tr key={r} className="border-ui-line/60 border-t">
            {cells.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row" className={ROW_TH}>
                  {cell}
                </th>
              ) : (
                <td key={i} className={TD}>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
        {total ? (
          <tr className="border-ui-line-strong border-t-2 font-semibold">
            {total.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row" className={ROW_TH}>
                  {cell}
                </th>
              ) : (
                <td key={i} className={TD}>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export function MarketingCreditPanel({ report }: { report: Loaded }) {
  const { credit, siteForms, chat, selfBooked, reactivation } = report;
  const sum = (key: "booked" | "themselves" | "bySetter" | "won" | "revenue") =>
    credit.reduce((s, r) => s + r[key], 0);
  const marketing = credit.filter((r) => r.source !== "No marketing touch");
  const mSum = (
    key: "booked" | "themselves" | "bySetter" | "won" | "revenue",
  ) => marketing.reduce((s, r) => s + r[key], 0);

  const setterBooked = siteForms.bookedBySetter.reduce(
    (s, r) => s + r.count,
    0,
  );
  const notBooked = siteForms.notBooked.reduce((s, r) => s + r.count, 0);
  const chatBooked =
    chat.bookedInChat + chat.bookedLaterThemselves + chat.bookedLaterBySetter;

  return (
    <div className="space-y-5">
      <p className="text-ui-text-muted text-sm">
        {report.from} to {report.to} · first sales calls and wins, by who
        started them and who booked them
      </p>

      <AdminMetricStrip columns={6}>
        <AdminMetricPanel
          label="Marketing-started calls"
          value={n(mSum("booked"))}
          caption={`${pct(mSum("booked"), sum("booked"))} of ${n(sum("booked"))} first calls`}
        />
        <AdminMetricPanel
          label="Booked themselves"
          value={n(mSum("themselves"))}
          caption={`${pct(mSum("themselves"), mSum("booked"))} of marketing-started`}
        />
        <AdminMetricPanel
          label="Setter assists"
          value={n(mSum("bySetter"))}
          caption="marketing lead, setter booked"
        />
        <AdminMetricPanel
          label="Marketing-started wins"
          value={n(mSum("won"))}
          caption={`of ${n(sum("won"))} won`}
        />
        <AdminMetricPanel
          label="Marketing-started revenue"
          value={money(mSum("revenue"))}
          caption={`${pct(mSum("revenue"), sum("revenue"))} of ${money(sum("revenue"))}`}
        />
        <AdminMetricPanel
          label="Reactivation warmed"
          value={`${n(reactivation.assistedCalls)} / ${n(reactivation.calls)}`}
          caption={`${n(reactivation.assistedWins)} of ${n(reactivation.wins)} wins · ${money(reactivation.assistedRevenue)}`}
        />
      </AdminMetricStrip>

      <Panel title="By source">
        <Table
          head={[
            "Source",
            "Booked",
            "Booked themselves",
            "Self %",
            "Setter booked",
            "Closed won",
            "Won / booked",
            "Won value",
          ]}
          rows={credit.map((r) => [
            r.source,
            n(r.booked),
            n(r.themselves),
            pct(r.themselves, r.booked),
            n(r.bySetter),
            n(r.won),
            pct(r.won, r.booked),
            money(r.revenue),
          ])}
          total={[
            "Total",
            n(sum("booked")),
            n(sum("themselves")),
            pct(sum("themselves"), sum("booked")),
            n(sum("bySetter")),
            n(sum("won")),
            pct(sum("won"), sum("booked")),
            money(sum("revenue")),
          ]}
        />
      </Panel>

      <Panel title="Site form fills">
        <Table
          head={[
            "People",
            "Booked themselves",
            "Setter booked",
            "Not booked",
            "Booked %",
          ]}
          rows={[
            [
              n(siteForms.filled),
              n(siteForms.bookedThemselves),
              n(setterBooked),
              n(notBooked),
              pct(siteForms.bookedThemselves + setterBooked, siteForms.filled),
            ],
          ]}
        />
        <div className="border-ui-line/60 grid border-t md:grid-cols-2 md:divide-x">
          <Table
            head={["Setter booked by", "Calls", "Share"]}
            rows={siteForms.bookedBySetter.map((r) => [
              r.setter,
              n(r.count),
              pct(r.count, setterBooked),
            ])}
          />
          <Table
            head={["Not booked, Close status", "People", "Share"]}
            rows={siteForms.notBooked.map((r) => [
              r.status,
              n(r.count),
              pct(r.count, notBooked),
            ])}
          />
        </div>
      </Panel>

      <Panel title="Site chatbot">
        <Table
          head={[
            "Chats",
            "Gave email",
            "Email %",
            "Booked in chat",
            "Booked later, themselves",
            "Booked later, setter",
            "Booked %",
          ]}
          rows={[
            [
              n(chat.chats),
              n(chat.gaveEmail),
              pct(chat.gaveEmail, chat.chats),
              n(chat.bookedInChat),
              n(chat.bookedLaterThemselves),
              n(chat.bookedLaterBySetter),
              pct(chatBooked, chat.chats),
            ],
          ]}
        />
      </Panel>

      <Panel title="Booked themselves, by surface">
        <Table
          head={[...SURFACES, "Total"]}
          rows={[
            [
              ...SURFACES.map((s) => n(selfBooked.bySurface[s])),
              n(selfBooked.total),
            ],
          ]}
        />
      </Panel>
    </div>
  );
}
