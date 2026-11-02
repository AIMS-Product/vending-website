export type ReadingLink = { href: string; title: string };

const COST_GUIDE = "/resources/how-much-does-a-vending-machine-cost";
const START_GUIDE = "/resources/how-to-start-a-vending-machine-business";
const NO_MONEY_GUIDE =
  "/resources/start-vending-machine-business-with-no-money";
const LLC_GUIDE = "/resources/llc-for-vending-machine-business";
const MONEY = "/news/how-much-money-do-vending-machines-make-2026";
const ROI = "/news/expected-costs-earnings-roi-vending-machines-2025";
const PASSIVE = "/news/vending-machine-business-passive-income";
const LOCATIONS = "/news/best-vending-locations";
const SELF_MANAGED =
  "/news/how-to-build-a-self-managed-route-so-you-can-work-less";
const MISTAKES = "/news/top-8-vendpreneur-mistakes-how-to-fix-them";
const TOP_ITEMS =
  "/news/top-10-profitable-products-to-stock-in-your-vending-machine";
const FROM_ZERO = "/news/from-zero-to-first-vending-machine-guide";
const TAXES = "/news/vending-business-taxes-us-beginners-guide";
const LEGAL = "/news/vending-machine-business-legal-tax-licensing-2025";

// Same-topic links first, so each cluster (cost, income, locations, items)
// passes authority to the page that should rank for it. In particular the
// income article outranks the cost guide for cost searches; it links there.
const TOPIC_LINKS: Readonly<Record<string, readonly string[]>> = {
  [MONEY]: [COST_GUIDE, ROI, TOP_ITEMS],
  [ROI]: [COST_GUIDE, MONEY, NO_MONEY_GUIDE],
  [PASSIVE]: [SELF_MANAGED, MONEY, ROI],
  [LOCATIONS]: [
    "/resources/negotiate-vending-machine-deals",
    "/resources/vending-in-colleges",
    "/resources/vending-machines-in-high-schools",
  ],
  [TOP_ITEMS]: ["/resources/combo-vending-machine", MONEY, LOCATIONS],
  [FROM_ZERO]: [START_GUIDE, NO_MONEY_GUIDE, LLC_GUIDE],
  [SELF_MANAGED]: [
    PASSIVE,
    "/news/smart-vending-cashless-payments-iot",
    MISTAKES,
  ],
  "/news/smart-vending-cashless-payments-iot": [
    "/resources/combo-vending-machine",
    SELF_MANAGED,
    TOP_ITEMS,
  ],
  [MISTAKES]: [
    START_GUIDE,
    FROM_ZERO,
    "/news/top-5-questions-vending-entrepreneurship-program",
  ],
  [TAXES]: [LLC_GUIDE, LEGAL, ROI],
  [LEGAL]: [LLC_GUIDE, TAXES, START_GUIDE],
  "/news/top-5-questions-vending-entrepreneurship-program": [
    MISTAKES,
    START_GUIDE,
    MONEY,
  ],
};

/**
 * Topic links that are still published, then the next items in list order, so
 * an article missing from the map still links out instead of rendering nothing.
 */
export function pickRelatedReading(
  currentHref: string,
  candidates: readonly ReadingLink[],
  count = 3,
): ReadingLink[] {
  const others = candidates.filter((item) => item.href !== currentHref);
  const topical = (TOPIC_LINKS[currentHref] ?? []).flatMap((href) =>
    others.filter((item) => item.href === href),
  );
  const start = candidates.findIndex((item) => item.href === currentHref);
  const rotated = [
    ...candidates.slice(start + 1),
    ...candidates.slice(0, start + 1),
  ].filter(
    (item) =>
      item.href !== currentHref &&
      !topical.some((picked) => picked.href === item.href),
  );
  return [...topical, ...rotated].slice(0, count);
}
