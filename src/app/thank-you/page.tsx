import type { Metadata } from "next";
import { SupportPage } from "@/components/sections/SupportPage";
import {
  THANK_YOU_STATES,
  type ThankYouStateKey,
} from "@/lib/qualification/scoring";
import {
  THANK_YOU_LINKS,
  THANK_YOU_STATE_LINKS,
} from "@/lib/qualification/thank-you-links";

export const metadata: Metadata = {
  title: "Thank You",
  robots: {
    index: false,
    follow: false,
  },
};

const VALID_STATE_KEYS: readonly ThankYouStateKey[] = [
  "not_right_time",
  "good_potential",
  "strong_fit",
  "perfect_fit",
];

const DEFAULT_STATE_KEY: ThankYouStateKey = "good_potential";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Validates the `state` query param against the 4 known keys, falling back to a safe neutral default instead of erroring. */
function resolveStateKey(raw: string | string[] | undefined): ThankYouStateKey {
  const candidate = firstValue(raw);
  const match = VALID_STATE_KEYS.find((key) => key === candidate);
  return match ?? DEFAULT_STATE_KEY;
}

/** Parses the optional `score` query param defensively — never throws, returns undefined for anything non-numeric. */
function resolveScore(raw: string | string[] | undefined): number | undefined {
  const candidate = firstValue(raw);
  if (!candidate || !/^\d+$/.test(candidate)) return undefined;
  return Number(candidate);
}

type ThankYouSearchParams = {
  state?: string | string[];
  score?: string | string[];
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<ThankYouSearchParams>;
}) {
  const params = await searchParams;
  const stateKey = resolveStateKey(params.state);
  const score = resolveScore(params.score);

  const state = THANK_YOU_STATES[stateKey];
  const links = THANK_YOU_STATE_LINKS[stateKey];

  return (
    <SupportPage
      eyebrow={state.label}
      title={state.headline}
      body={state.body}
      cta={{
        label: state.cta,
        href: THANK_YOU_LINKS[links.primary],
      }}
      secondaryNote={state.secondaryNote}
      secondaryCta={
        state.secondaryCta && links.secondary
          ? {
              label: state.secondaryCta,
              href: THANK_YOU_LINKS[links.secondary],
            }
          : undefined
      }
      debugValue={score !== undefined ? String(score) : undefined}
    />
  );
}
