import { ChannelLogo } from "@/components/admin/ChannelLogo";
import { adminEyebrowClass } from "@/components/admin/AdminUi";
import { readChannelValue } from "@/components/admin/dashboard/ChannelValueCard";
import {
  CardMessage,
  DashboardCard,
  money,
  num,
} from "@/components/admin/dashboard/DashboardPanels";
import {
  metaCampaigns,
  paidByNetwork,
  type PaidRow,
} from "@/lib/analytics/channel-value";
import type { DashboardWindow } from "@/lib/analytics/dashboard-window";
import { getGoogleAdsDashboard } from "@/lib/services/google-ads-dashboard";

interface PaidAdsCardProps {
  window: DashboardWindow;
}

const COLUMNS = [
  "Spend",
  "Clicks",
  "Sign-ups",
  "Booked",
  "Won",
  "Cost per booked",
] as const;

const show = (n: number | null, f: (n: number) => string = num) =>
  n === null ? "–" : f(n);

function PaidTable({
  rows,
  first,
  logos = false,
}: {
  rows: readonly PaidRow[];
  first: string;
  logos?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-[0.8125rem]">
        <thead>
          <tr
            className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
          >
            <th className="py-2 pr-3 font-semibold">{first}</th>
            {COLUMNS.map((c) => (
              <th key={c} className="py-2 pr-3 text-right font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-ui-line text-ui-text divide-y">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="max-w-[18rem] py-2.5 pr-3 font-medium">
                <span className="flex min-w-0 items-center gap-2">
                  {logos ? <ChannelLogo label={r.label} /> : null}
                  <span className="truncate" title={r.label}>
                    {r.label}
                  </span>
                </span>
              </td>
              {[
                money(r.spend),
                num(r.clicks),
                show(r.signUps),
                show(r.booked),
                show(r.won),
                show(r.costPerBooked, money),
              ].map((v, i) => (
                <td
                  key={COLUMNS[i]}
                  className="py-2.5 pr-3 text-right tabular-nums"
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function googleCampaigns(window: DashboardWindow) {
  try {
    const ads = await getGoogleAdsDashboard({
      range: `custom:${window.startDay}:${window.endDay}`,
    });
    return {
      ok: true as const,
      rows: ads.campaigns
        .filter((c) => c.spend > 0 || c.leads > 0)
        .map(
          (c): PaidRow => ({
            key: c.key,
            label: c.label,
            spend: Math.round(c.spend),
            clicks: c.clicks,
            signUps: c.leads,
            booked: c.booked,
            won: c.won,
            costPerBooked:
              c.costPerBooked === null ? null : Math.round(c.costPerBooked),
          }),
        ),
    };
  } catch (error) {
    console.error("analytics dashboard: Google Ads campaigns failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false as const };
  }
}

/** Google and Meta side by side, by network and then by campaign. */
export async function PaidAdsCard({ window }: PaidAdsCardProps) {
  const [value, google] = await Promise.all([
    readChannelValue(window),
    googleCampaigns(window),
  ]);
  const { error, flow, facts } = value;
  if (error || !flow || !facts.ok) {
    return (
      <DashboardCard id="paid" help="paid">
        {error}
      </DashboardCard>
    );
  }
  const meta = metaCampaigns(facts.data, window);
  return (
    <DashboardCard id="paid" help="paid">
      <PaidTable
        rows={paidByNetwork(facts.data, flow, window)}
        first="Channel"
        logos
      />
      <h3 className={`${adminEyebrowClass} mt-6 mb-1`}>Google campaigns</h3>
      {google.ok ? (
        google.rows.length ? (
          <PaidTable rows={google.rows} first="Campaign" />
        ) : (
          <CardMessage tone="empty">No Google Ads spend or leads.</CardMessage>
        )
      ) : (
        <CardMessage tone="error">
          Google Ads campaigns could not be read.
        </CardMessage>
      )}
      <h3 className={`${adminEyebrowClass} mt-6 mb-1`}>Meta campaigns</h3>
      {meta.length ? (
        <PaidTable rows={meta} first="Campaign" />
      ) : (
        <CardMessage tone="empty">No Meta spend recorded.</CardMessage>
      )}
    </DashboardCard>
  );
}
