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

export const CANVAS = { width: 1400, height: 1290 } as const;

const SOURCE_X = 16;
const SOURCE_W = 260;
const SOURCE_H = 104;
const SOURCE_TOP = 56;
const SOURCE_STEP = 116;

/** The vertical trunk every outbound surface joins before the link. */
export const SOURCE_BUS_X = 306;

/** Column 1, top to bottom. Order is the order they matter in. */
const SOURCES: Array<{
  id: string;
  title: string;
  body: string;
  logos: string[];
  channels: string[];
}> = [
  {
    id: "webinars",
    title: "Webinars",
    body: "Ads and posts drive registration",
    logos: ["webinar"],
    channels: ["Webinar"],
  },
  {
    id: "youtube",
    title: "YouTube videos",
    body: "Link in the description and pinned comment",
    logos: ["youtube"],
    channels: ["YouTube"],
  },
  {
    id: "social",
    title: "Organic social",
    body: "Brand and personal accounts, via Metricool",
    logos: ["instagram", "tiktok", "x", "linkedin"],
    channels: ["Instagram", "TikTok", "X", "LinkedIn", "Meta"],
  },
  {
    id: "ads",
    title: "Paid ads",
    body: "Spend lands on the row that spent it",
    logos: ["meta ads", "google ads"],
    channels: ["Meta Ads", "Google Ads"],
  },
  {
    id: "email",
    title: "Email and SMS",
    body: "GoHighLevel workflows, plus the newsletter",
    logos: ["ghl"],
    channels: ["Email", "SMS", "Newsletter"],
  },
  {
    id: "funnels",
    title: "VSL and low-ticket funnel",
    body: "Their own opt-in pages, hosted in GHL",
    logos: ["vsl"],
    channels: ["VSL", "Low ticket funnel"],
  },
  {
    id: "dm",
    title: "Instagram DM setter",
    body: "Pearl answers in ManyChat and sends the link",
    logos: ["manychat"],
    channels: ["Instagram DM"],
  },
];

/** The DM setter never touches the site, so it never joins the source bus. */
const BUS_SOURCES = SOURCES.filter((source) => source.id !== "dm");

export const NODES: MapNode[] = [
  ...SOURCES.map((source, index) => ({
    ...source,
    x: SOURCE_X,
    y: SOURCE_TOP + index * SOURCE_STEP,
    w: SOURCE_W,
    h: SOURCE_H,
    tone: "source" as const,
  })),

  {
    id: "link",
    x: 340,
    y: 252,
    w: 216,
    h: 220,
    title: "The tagged link",
    tone: "hub",
  },

  {
    id: "page",
    x: 600,
    y: 246,
    w: 216,
    h: 92,
    title: "Landing / SEO page",
    body: "GA4 records the session against the link's tags",
    logos: ["website"],
    tone: "site",
    stage: "visits",
  },
  {
    id: "chatbot",
    x: 600,
    y: 362,
    w: 216,
    h: 92,
    title: "AI chatbot setter",
    body: "Answers questions, can book the call itself",
    logos: ["chatbot"],
    tone: "site",
  },
  {
    id: "form",
    x: 600,
    y: 478,
    w: 216,
    h: 92,
    title: "Lead form",
    body: "The scoring questions that decide who gets a call",
    logos: ["form"],
    tone: "site",
  },

  {
    id: "lead",
    x: 880,
    y: 246,
    w: 212,
    h: 92,
    title: "lead_submissions",
    body: "UTMs, paid click ids and session, kept with the lead",
    tone: "store",
    stage: "leads",
  },
  {
    id: "calendly",
    x: 880,
    y: 478,
    w: 212,
    h: 92,
    title: "Calendly booking",
    body: "A DM or chatbot link can book with no form behind it",
    logos: ["calendly"],
    tone: "external",
    stage: "booked",
  },
  {
    id: "close",
    x: 1160,
    y: 246,
    w: 204,
    h: 92,
    title: "Close CRM",
    body: "The lead, with its origin on custom fields",
    logos: ["close"],
    tone: "external",
  },
  {
    id: "outcome",
    x: 1160,
    y: 478,
    w: 204,
    h: 92,
    title: "Showed, won, revenue",
    body: "What the closer marked after the call",
    logos: ["close"],
    tone: "external",
  },

  {
    id: "members",
    x: 1160,
    y: 640,
    w: 204,
    h: 96,
    title: "They become members",
    body: "Onboarded into Mighty Networks and VendHub. Not measured on this page.",
    tone: "store",
  },

  {
    id: "spine",
    x: 810,
    y: 1160,
    w: 300,
    h: 88,
    title: "channel_daily",
    body: "One row per day per link. The only table this page reads",
    tone: "store",
  },
  {
    id: "dashboard",
    x: 1160,
    y: 1160,
    w: 220,
    h: 88,
    title: "This dashboard",
    body: "Channels, KPI and this map",
    tone: "hub",
  },
];

/** Connector boxes, two rows, all feeding the spine through one riser. */
export const CONNECTOR_BAND = {
  x: 16,
  y: 904,
  width: 140,
  height: 76,
  gap: 10,
  perRow: 6,
  rowGap: 28,
  /** Clear of the widest row, so the trunk crosses no box on its way down. */
  riserX: 960,
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
  { from: "link", to: "page", via: [{ x: 578, y: 362 }] },

  { from: "page", to: "chatbot", fromSide: "bottom", toSide: "top" },
  { from: "chatbot", to: "form", fromSide: "bottom", toSide: "top" },

  // The form submits upward and the chatbot books downward. Separate lanes
  // keep each one straight; they meet once, which is the shape of the flow.
  {
    from: "form",
    to: "lead",
    via: [{ x: 836, y: 524 }],
    toOffset: 14,
    label: "submits",
    labelAt: { x: 836, y: 448 },
  },
  {
    from: "chatbot",
    to: "calendly",
    via: [{ x: 852, y: 408 }],
    label: "books in chat",
    labelAt: { x: 866, y: 442 },
  },
  // Pearl sends a calendar link, so this one never reaches the site at all.
  {
    from: "dm",
    to: "calendly",
    toSide: "bottom",
    via: [{ x: 940, y: 804 }],
    label: "books direct",
    labelAt: { x: 620, y: 794 },
  },

  { from: "lead", to: "calendly", fromSide: "bottom", toSide: "top" },
  {
    from: "lead",
    to: "close",
    label: "every 2 min",
    labelAt: { x: 1126, y: 284 },
  },
  { from: "calendly", to: "outcome" },
  { from: "close", to: "outcome", fromSide: "bottom", toSide: "top" },

  // The return leg goes over the top on the outside, where it crosses nothing.
  {
    from: "outcome",
    to: "lead",
    kind: "back",
    fromSide: "right",
    toSide: "top",
    via: [
      { x: 1382, y: 524 },
      { x: 1382, y: 196 },
      { x: 986, y: 196 },
    ],
    label: "reconciled back onto the lead",
    labelAt: { x: 1172, y: 188 },
  },

  {
    from: "outcome",
    to: "members",
    fromSide: "bottom",
    toSide: "top",
    kind: "back",
    label: "handed off",
    labelAt: { x: 1330, y: 612 },
  },

  { from: "spine", to: "dashboard" },
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

/** Where each source's stub meets the bus, top to bottom. */
export function busStops(): Array<{ id: string; y: number }> {
  return BUS_SOURCES.map((source) => {
    const node = nodeById(source.id);
    return { id: source.id, y: node.y + node.h / 2 };
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
