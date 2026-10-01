"use client";

import { ApplyStickyCta } from "@/components/sections/apply/ApplyStickyCta";
import { useNow } from "@/components/sections/masterclass/EventTiming";
import { masterclassHero, stickyEventLine } from "@/lib/content/masterclass";

/**
 * The sticky "Save my free seat" bar. Its date line follows the visitor's
 * clock (server render time until mounted), so an open tab drops the date
 * once the session starts, like the other date lines.
 */
export function MasterclassStickyCta({
  startsAt,
  renderedAt,
}: {
  startsAt: string | null;
  renderedAt: number;
}) {
  const now = useNow() ?? renderedAt;
  return (
    <ApplyStickyCta
      ctaLabel={masterclassHero.stickyCta}
      text={stickyEventLine(startsAt, now)}
      mobileText={stickyEventLine(startsAt, now, true)}
      trackAs="sticky"
    />
  );
}
