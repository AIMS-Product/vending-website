import type { GoogleAdsRow } from "@/lib/services/google-ads-dashboard";
import type {
  BeforeAfter,
  CampaignHealth,
} from "@/lib/services/google-ads-insights";

/** A campaign must spend this much in the range before it is judged. */
const MIN_SPEND_TO_JUDGE = 300;
/** Cost per booked call this many times the account's average is a problem. */
const EXPENSIVE_MULTIPLE = 1.75;
const MAX_ACTIONS = 3;

export type Verdict = "better" | "worse" | "flat" | "too-early";

export type CeoAction = {
  tone: "bad" | "warn" | "good";
  title: string;
  detail: string;
};

export type CeoSummary = {
  verdict: Verdict;
  /** Revenue won per dollar spent, null without spend. */
  returnPerDollar: number | null;
  actions: CeoAction[];
};

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Compares the period since the change to the frozen baseline. */
export function verdictOf(data: BeforeAfter): Verdict {
  const before = data.before.costPerBooked;
  const after = data.after?.costPerBooked ?? null;
  if (!data.settled || before === null || after === null) return "too-early";
  if (after <= before * 0.9) return "better";
  if (after >= before * 1.1) return "worse";
  return "flat";
}

/**
 * At most three things the CEO should decide, worst first: campaigns that
 * cannot serve, campaigns booking calls at 1.75x+ the average (or none at all),
 * and cheap campaigns Google is holding back for budget.
 */
export function ceoActions(
  campaigns: readonly GoogleAdsRow[],
  totals: GoogleAdsRow,
  health: readonly CampaignHealth[],
): CeoAction[] {
  const avg = totals.costPerBooked;
  const byId = new Map(campaigns.map((c) => [c.key, c]));
  const actions: CeoAction[] = [];

  for (const h of health) {
    if (h.status !== "ENABLED") continue;
    if (h.liveAds > 0 && h.approvedAds === 0) {
      actions.push({
        tone: "bad",
        title: `${h.name} is not showing ads`,
        detail:
          h.underReview > 0
            ? "New ads are waiting on Google's review. No action unless this lasts past 2 days."
            : "Google rejected every ad. New ad copy is needed before it can spend again.",
      });
    }
  }

  for (const c of campaigns) {
    if (c.spend < MIN_SPEND_TO_JUDGE || avg === null) continue;
    const live = health.find((h) => h.campaignId === c.key);
    if (live && live.status !== "ENABLED") continue;
    if (c.booked === 0) {
      actions.push({
        tone: "bad",
        title: `${c.label}: ${usd(c.spend)} spent, no booked calls`,
        detail:
          "Recommend pausing it and moving the money to what books calls.",
      });
    } else if (
      c.costPerBooked !== null &&
      c.costPerBooked >= avg * EXPENSIVE_MULTIPLE
    ) {
      const times = (c.costPerBooked / avg).toFixed(1);
      actions.push({
        tone: "warn",
        title: `${c.label}: ${usd(c.costPerBooked)} per booked call, ${times}x the average`,
        detail: `${usd(c.spend)} spent for ${c.booked} booked. Recommend pausing or cutting its budget.`,
      });
    }
  }

  for (const h of health) {
    const row = byId.get(h.campaignId);
    if (
      h.status === "ENABLED" &&
      h.flags.includes("Limited by budget") &&
      row?.costPerBooked != null &&
      avg !== null &&
      row.costPerBooked <= avg * 1.1
    ) {
      actions.push({
        tone: "good",
        title: `${h.name} could take more budget`,
        detail: `It books calls at ${usd(row.costPerBooked)} each and Google is holding it back at ${h.dailyBudget === null ? "its budget" : `${usd(h.dailyBudget)}/day`}.`,
      });
    }
  }

  return actions.slice(0, MAX_ACTIONS);
}

export function ceoSummary(input: {
  campaigns: readonly GoogleAdsRow[];
  totals: GoogleAdsRow;
  health: readonly CampaignHealth[];
  beforeAfter: BeforeAfter;
}): CeoSummary {
  const { totals } = input;
  return {
    verdict: verdictOf(input.beforeAfter),
    returnPerDollar: totals.spend > 0 ? totals.wonValue / totals.spend : null,
    actions: ceoActions(input.campaigns, totals, input.health),
  };
}
