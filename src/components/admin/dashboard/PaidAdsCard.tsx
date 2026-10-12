import Link from "next/link";
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

const CELLS: Record<(typeof COLUMNS)[number], (r: PaidRow) => string> = {
  Spend: (r) => money(r.spend),
  Clicks: (r) => num(r.clicks),
  "Sign-ups": (r) => show(r.signUps),
  Booked: (r) => show(r.booked),
  Won: (r) => show(r.won),
  "Cost per booked": (r) => show(r.costPerBooked, money),
};

const EMPTY_WHEN_NULL: Partial<
  Record<(typeof COLUMNS)[number], (r: PaidRow) => number | null>
> = {
  "Sign-ups": (r) => r.signUps,
  Booked: (r) => r.booked,
  Won: (r) => r.won,
  "Cost per booked": (r) => r.costPerBooked,
};

const DETAIL_LINK =
  "text-ui-accent ml-2 font-medium normal-case tracking-normal hover:underline";
const WEBINAR_BOARD_ADS = "https://webinars.vendingpreneurs.com/ads/winners";

function PaidTable({
  rows,
  first,
  logos = false,
}: {
  rows: readonly PaidRow[];
  first: string;
  logos?: boolean;
}) {
  // A column no row can fill (Meta campaigns carry no funnel here) is noise, not a row of dashes.
  const columns = COLUMNS.filter((c) => {
    const value = EMPTY_WHEN_NULL[c];
    return !value || rows.some((r) => value(r) !== null);
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-[0.8125rem]">
        <thead>
          <tr
            className={`border-ui-line border-b text-left ${adminEyebrowClass}`}
          >
            <th className="py-2 pr-3 font-semibold">{first}</th>
            {columns.map((c) => (
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
              {columns.map((c) => (
                <td key={c} className="py-2.5 pr-3 text-right tabular-nums">
                  {CELLS[c](r)}
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
      <h3 className={`${adminEyebrowClass} mt-6 mb-1`}>
        Google campaigns
        <Link href="/admin/analytics/google-ads" className={DETAIL_LINK}>
          Keywords, ads and decisions
        </Link>
      </h3>
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
      <h3 className={`${adminEyebrowClass} mt-6 mb-1`}>
        Meta campaigns
        <a href={WEBINAR_BOARD_ADS} className={DETAIL_LINK}>
          Registrations, bookings and wins per ad on the webinar board
        </a>
      </h3>
      {meta.length ? (
        <PaidTable rows={meta} first="Campaign" />
      ) : (
        <CardMessage tone="empty">No Meta spend recorded.</CardMessage>
      )}
    </DashboardCard>
  );
}
