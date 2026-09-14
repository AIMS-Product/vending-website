/**
 * Layout for the funnel diagram: where every box sits and what connects to
 * what. Coordinates are canvas units and the canvas scrolls rather than
 * reflows, so the picture is the same shape on every screen — a flow chart
 * that rearranges itself at a breakpoint tells a different story at every
 * width.
 *
 * Edges are orthogonal and share buses. Seventeen curves fanning into two
 * points read as spaghetti; a stub into a trunk into one arrow reads as a
 * wiring diagram, which is what this is. One crossing survives by topology:
 * the chatbot sits above the form, books downward while the form submits
 * upward, so those two have to meet somewhere.
 */

export type NodeTone = "source" | "hub" | "site" | "store" | "external";

export type Side = "left" | "right" | "top" | "bottom";

export type Point = { x: number; y: number };

export type MapNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body?: string;
  tone: NodeTone;
  /** Labels passed to ChannelLogo, left of the title. */
  logos?: string[];
  /** Channels whose totals roll up into this box. */
  channels?: string[];
  /** A funnel stage to print large inside the box. */
  stage?: "visits" | "leads" | "booked";
};

export type MapEdge = {
  from: string;
  to: string;
  fromSide?: Side;
  toSide?: Side;
  /** Shift the anchor along its own side, so two edges can share a side. */
  fromOffset?: number;
  toOffset?: number;
  /** Corners to route through, in order. A plain elbow when omitted. */
  via?: Point[];
  kind?: "flow" | "back";
  label?: string;
  labelAt?: Point;
};

export const CANVAS = { width: 1040, height: 2240 } as const;

/** Everything on the spine is centred on this line, top to bottom. */
const MID = 520;

const SOURCE_W = 240;
const SOURCE_H = 96;

/** The horizontal trunk every outbound surface drops into before the link. */
export const SOURCE_BUS_Y = 306;

/** Column 1 became row 1: order is still the order they matter in. */
const SOURCES: Array<{
  id: string;
  title: string;
  body: string;
  logos: string[];
  channels: string[];
  x: number;
  y: number;
}> = [
  {
    id: "webinars",
    title: "Webinars",
    body: "Ads and posts drive registration",
    logos: ["webinar"],
    channels: ["Webinar"],
    x: 16,
    y: 60,
  },
  {
    id: "youtube",
    title: "YouTube videos",
    body: "Link in the description and pinned comment",
    logos: ["youtube"],
    channels: ["YouTube"],
    x: 272,
    y: 60,
  },
  {
    id: "social",
    title: "Organic social",
    body: "Brand and personal accounts, via Metricool",
    logos: ["instagram", "tiktok", "x", "linkedin"],
    channels: ["Instagram", "TikTok", "X", "LinkedIn", "Meta"],
    x: 528,
    y: 60,
  },
  {
    id: "ads",
    title: "Paid ads",
    body: "Spend lands on the row that spent it",
    logos: ["meta ads", "google ads"],
    channels: ["Meta Ads", "Google Ads"],
    x: 784,
    y: 60,
  },
  {
    id: "email",
    title: "Email and SMS",
    body: "GoHighLevel workflows, plus the newsletter",
    logos: ["ghl"],
    channels: ["Email", "SMS", "Newsletter"],
    x: 144,
    y: 172,
  },
  {
    id: "funnels",
    title: "VSL and low-ticket funnel",
    body: "Their own opt-in pages, hosted in GHL",
    logos: ["vsl"],
    channels: ["VSL", "Low ticket funnel"],
    x: 400,
    y: 172,
  },
  {
    id: "dm",
    title: "Instagram DM setter",
    body: "Pearl answers in ManyChat and sends the link",
    logos: ["manychat"],
    channels: ["Instagram DM"],
    x: 656,
    y: 172,
  },
];

/** The DM setter never touches the site, so it never joins the source bus. */
const BUS_SOURCES = SOURCES.filter((source) => source.id !== "dm");

export const NODES: MapNode[] = [
  ...SOURCES.map((source) => ({
    ...source,
    w: SOURCE_W,
    h: SOURCE_H,
    tone: "source" as const,
  })),

  {
    id: "link",
    x: MID - 108,
    y: 340,
    w: 216,
    h: 200,
    title: "The tagged link",
    tone: "hub",
  },

  {
    id: "page",
    x: MID - 160,
    y: 640,
    w: 320,
    h: 92,
    title: "Landing / SEO page",
    body: "GA4 records the session against the link's tags",
    logos: ["website"],
    tone: "site",
    stage: "visits",
  },
  {
    id: "chatbot",
    x: 292,
    y: 866,
    w: 216,
    h: 92,
    title: "AI chatbot setter",
    body: "Answers questions, can book the call itself",
    logos: ["chatbot"],
    tone: "site",
  },
  {
    id: "form",
    x: 532,
    y: 866,
    w: 216,
    h: 92,
    title: "Lead form",
    body: "The scoring questions that decide who gets a call",
    logos: ["form"],
    tone: "site",
  },

  {
    id: "lead",
    x: MID - 160,
    y: 1068,
    w: 320,
    h: 92,
    title: "lead_submissions",
    body: "UTMs, paid click ids and session, kept with the lead",
    tone: "store",
    stage: "leads",
  },
  {
    id: "close",
    x: 752,
    y: 1068,
    w: 216,
    h: 92,
    title: "Close CRM",
    body: "The lead, with its origin on custom fields",
    logos: ["close"],
    tone: "external",
  },
  {
    id: "calendly",
    x: MID - 160,
    y: 1294,
    w: 320,
    h: 92,
    title: "Calendly booking",
    body: "A DM or chatbot link can book with no form behind it",
    logos: ["calendly"],
    tone: "external",
    stage: "booked",
  },
  {
    id: "outcome",
    x: MID - 160,
    y: 1520,
    w: 320,
    h: 92,
    title: "Showed, won, revenue",
    body: "What the closer marked after the call",
    logos: ["close"],
    tone: "external",
  },
  {
    id: "members",
    x: MID - 160,
    y: 1684,
    w: 320,
    h: 96,
    title: "They become members",
    body: "Onboarded into Mighty Networks and VendHub. Not measured on this page.",
    tone: "store",
  },

  {
    id: "spine",
    x: 16,
    y: 2104,
    w: 300,
    h: 88,
    title: "channel_daily",
    body: "One row per day per link. The only table this page reads",
    tone: "store",
  },
  {
    id: "dashboard",
    x: 360,
    y: 2104,
    w: 240,
    h: 88,
    title: "This dashboard",
    body: "Channels, KPI and this map",
    tone: "hub",
  },
];

/**
 * The dashed regions. Data rather than markup so the layout test can hold them
 * to the same no-overlap rule as everything else.
 */
export const GROUP_BOXES: Array<{
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}> = [
  {
    id: "going-out",
    x: 8,
    y: 36,
    w: 1024,
    h: 244,
    label: "Going out — every surface we publish to",
  },
  {
    id: "site",
    x: 276,
    y: 600,
    w: 488,
    h: 382,
    label: "vendingpreneurs.com",
  },
  {
    id: "connectors",
    x: 8,
    y: 1856,
    w: 914,
    h: 216,
    label: "Connectors — each platform reports on its own surface, once a day",
  },
];

/** Connector boxes, two rows, all feeding the spine through one riser. */
export const CONNECTOR_BAND = {
  x: 16,
  y: 1888,
  width: 140,
  height: 76,
  gap: 10,
  perRow: 6,
  rowGap: 28,
  /** Inside the spine box below, so the trunk drops straight into it. */
  riserX: 166,
} as const;

export const CONNECTORS: Array<{
  connector: string;
  label: string;
  logo: string;
}> = [
  { connector: "ga4-visits", label: "GA4 visits", logo: "ga4" },
  { connector: "leads", label: "Our lead forms", logo: "form" },
  { connector: "ghl-forms", label: "GHL forms", logo: "ghl" },
  { connector: "ghl-email", label: "GHL email", logo: "ghl" },
  { connector: "bitly-clicks", label: "Bitly clicks", logo: "bitly" },
  { connector: "metricool-posts", label: "Metricool posts", logo: "metricool" },
  { connector: "metricool-ads", label: "Metricool spend", logo: "metricool" },
  {
    connector: "youtube-analytics",
    label: "YouTube Analytics",
    logo: "youtube",
  },
  { connector: "webinar-ingest", label: "vp-webinars", logo: "webinar" },
  { connector: "manychat-ingest", label: "ManyChat", logo: "manychat" },
  { connector: "close-lead-funnel", label: "Close outcomes", logo: "close" },
];

export const EDGES: MapEdge[] = [
  { from: "link", to: "page", fromSide: "bottom", toSide: "top" },

  // The page splits: the chatbot can book the call itself, the form scores
  // first. Both land on the lead, so both lanes come back together below.
  {
    from: "page",
    to: "chatbot",
    fromSide: "bottom",
    toSide: "top",
    fromOffset: -80,
  },
  {
    from: "page",
    to: "form",
    fromSide: "bottom",
    toSide: "top",
    fromOffset: 80,
  },

  {
    from: "form",
    to: "lead",
    fromSide: "bottom",
    toSide: "top",
    toOffset: 60,
    label: "submits",
    labelAt: { x: 664, y: 1020 },
  },
  {
    from: "chatbot",
    to: "calendly",
    fromSide: "left",
    toSide: "left",
    via: [{ x: 232, y: 1340 }],
    label: "books in chat",
    labelAt: { x: 214, y: 1120 },
  },
  // Pearl sends a calendar link, so this one never reaches the site at all.
  {
    from: "dm",
    to: "calendly",
    fromSide: "right",
    toSide: "right",
    via: [{ x: 1004, y: 1340 }],
    label: "books direct",
    labelAt: { x: 966, y: 700 },
  },

  { from: "lead", to: "calendly", fromSide: "bottom", toSide: "top" },
  {
    from: "lead",
    to: "close",
    label: "every 2 min",
    labelAt: { x: 716, y: 1048 },
  },
  { from: "calendly", to: "outcome", fromSide: "bottom", toSide: "top" },
  {
    from: "close",
    to: "outcome",
    fromSide: "bottom",
    toSide: "right",
    via: [{ x: 860, y: 1566 }],
  },

  // The return leg runs down the far right, where it crosses nothing.
  {
    from: "outcome",
    to: "lead",
    kind: "back",
    fromSide: "left",
    toSide: "left",
    via: [{ x: 168, y: 1114 }],
    label: "reconciled back onto the lead",
    labelAt: { x: 168, y: 1400 },
  },

  {
    from: "outcome",
    to: "members",
    fromSide: "bottom",
    toSide: "top",
    kind: "back",
    label: "handed off",
    labelAt: { x: 604, y: 1652 },
  },

  { from: "spine", to: "dashboard" },
];

/**
 * The pill's real drawn size, exported so the placement test measures the box
 * that actually renders. The first version of this test assumed a size the
 * component did not have, the text wrapped to four lines, and three pills
 * overlapped boxes on screen while the suite stayed green.
 *
 * Every line inside the pill truncates rather than wraps, so this height is
 * fixed no matter how long the numbers get.
 */
export const PILL_W = 116;
export const PILL_H = 54;

export type MetricStage = "visits" | "leads" | "booked" | "showed" | "won";

/**
 * Where a conversion pill sits on the spine.
 *
 * Vertical is what makes these fit. Left to right, the gaps between spine
 * boxes were 68px and a readable pill is 116 wide, so every one of them landed
 * on top of a box. Top to bottom the gap is the full width of the column, and
 * the pill sits in clear air on the line the people are travelling down.
 *
 * `from` and `to` name the stages the pill divides, not the boxes it sits
 * between: a visit becomes a lead by way of the form, and the ratio is still
 * visits to leads.
 */
export type ConversionPin = {
  id: string;
  from: MetricStage;
  to: MetricStage;
  x: number;
  y: number;
  /** Printed under the percentage. */
  label: string;
};

export const CONVERSION_PINS: ConversionPin[] = [
  {
    id: "visits-leads",
    from: "visits",
    to: "leads",
    x: MID,
    y: 764,
    label: "of visits",
  },
  {
    id: "leads-booked",
    from: "leads",
    to: "booked",
    x: MID,
    y: 1186,
    label: "of leads",
  },
  {
    id: "booked-showed",
    from: "booked",
    to: "showed",
    x: MID,
    y: 1412,
    label: "of booked",
  },
];

export function nodeById(id: string): MapNode {
  const node = NODES.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`unknown node: ${id}`);
  return node;
}

export function anchor(node: MapNode, side: Side, offset = 0): Point {
  switch (side) {
    case "left":
      return { x: node.x, y: node.y + node.h / 2 + offset };
    case "right":
      return { x: node.x + node.w, y: node.y + node.h / 2 + offset };
    case "top":
      return { x: node.x + node.w / 2 + offset, y: node.y };
    case "bottom":
      return { x: node.x + node.w / 2 + offset, y: node.y + node.h };
  }
}

/** Where each source's stub meets the bus, left to right. */
export function busStops(): Array<{ id: string; x: number }> {
  return BUS_SOURCES.map((source) => {
    const node = nodeById(source.id);
    return { id: source.id, x: node.x + node.w / 2 };
  });
}

/**
 * Corners for one edge: the given `via` points, otherwise a single elbow that
 * turns on whichever axis the exit side runs along. A via point states one
 * axis and inherits the other, so a lane is one number rather than two.
 */
export function corners(
  from: Point,
  to: Point,
  fromSide: Side,
  toSide: Side,
  via?: Point[],
): Point[] {
  if (via?.length) {
    const points: Point[] = [from];
    for (const point of via) {
      const previous = points[points.length - 1]!;
      points.push({ x: point.x, y: previous.y });
      points.push(point);
    }
    const last = points[points.length - 1]!;
    if (last.x !== to.x && last.y !== to.y) {
      const entersVertically = toSide === "top" || toSide === "bottom";
      points.push(
        entersVertically ? { x: to.x, y: last.y } : { x: last.x, y: to.y },
      );
    }
    points.push(to);
    return dedupe(points);
  }
  if (from.x === to.x || from.y === to.y) return [from, to];
  const horizontal = fromSide === "left" || fromSide === "right";
  return horizontal
    ? [from, { x: to.x, y: from.y }, to]
    : [from, { x: from.x, y: to.y }, to];
}

function dedupe(points: Point[]): Point[] {
  return points.filter(
    (point, index) =>
      index === 0 ||
      point.x !== points[index - 1]!.x ||
      point.y !== points[index - 1]!.y,
  );
}

/** An orthogonal polyline with rounded corners. */
export function orthPath(points: Point[], radius = 10): string {
  const clean = dedupe(points);
  if (clean.length < 2) return "";
  let d = `M ${clean[0]!.x} ${clean[0]!.y}`;
  for (let i = 1; i < clean.length - 1; i += 1) {
    const previous = clean[i - 1]!;
    const corner = clean[i]!;
    const next = clean[i + 1]!;
    const r = Math.min(
      radius,
      manhattan(previous, corner) / 2,
      manhattan(corner, next) / 2,
    );
    const start = towards(corner, previous, r);
    const end = towards(corner, next, r);
    d += ` L ${start.x} ${start.y} Q ${corner.x} ${corner.y} ${end.x} ${end.y}`;
  }
  const last = clean[clean.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function towards(from: Point, to: Point, by: number): Point {
  const total = manhattan(from, to) || 1;
  return {
    x: from.x + ((to.x - from.x) * by) / total,
    y: from.y + ((to.y - from.y) * by) / total,
  };
}

/**
 * Where a conversion pill sits on the spine.
 *
 * The pill is the point of the map: a box says how many, a pill says what
 * share of the step above got here and how many did not. They are placed by
 * hand, on the gap the spine edge crosses, for the same reason the edges are
 * routed by hand -- a solver would put them where there is room, not where
 * they mean something.
 *
 * `from` and `to` name the stages the pill divides, not the boxes it sits
 * between, because the path between two spine boxes can run through others
 * (a visit becomes a lead by way of the form) and the ratio is still
 * visits to leads.
 */
