/**
 * Layout for the funnel diagram: where every box sits and what connects to
 * what. Coordinates are in canvas units and the canvas scrolls rather than
 * reflows, so the picture is the same shape on every screen — a flow chart
 * that rewraps is a different flow chart.
 *
 * Nodes are HTML positioned over one SVG, not shapes drawn inside it: text
 * wrapping, links and live numbers are then just markup. The SVG draws only
 * the edges.
 */

export type NodeTone = "source" | "hub" | "site" | "store" | "external";

export type MapNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  body?: string;
  tone: NodeTone;
  /** Channels whose leads and reach roll up into this box. */
  channels?: string[];
  /** A funnel stage to print large inside the box. */
  stage?: "visits" | "leads" | "booked";
  href?: string;
};

export type EdgeKind = "flow" | "back" | "feed";

export type MapEdge = {
  from: string;
  to: string;
  /** Sides the edge leaves and enters by. Defaults to right then left. */
  fromSide?: Side;
  toSide?: Side;
  kind?: EdgeKind;
  label?: string;
};

export type Side = "left" | "right" | "top" | "bottom";

export const CANVAS = { width: 1400, height: 1190 } as const;

const SOURCE_X = 16;
const SOURCE_W = 260;
const SOURCE_H = 92;
const SOURCE_TOP = 56;
const SOURCE_STEP = 104;

/** Column 1, top to bottom. Order is the order they matter in. */
const SOURCES: Array<{
  id: string;
  title: string;
  body: string;
  channels: string[];
}> = [
  {
    id: "webinars",
    title: "Webinars",
    body: "Ads and posts drive registration; GHL hosts the form",
    channels: ["Webinar"],
  },
  {
    id: "youtube",
    title: "YouTube videos",
    body: "Link in the description and pinned comment",
    channels: ["YouTube"],
  },
  {
    id: "social",
    title: "Instagram / TikTok / X / LinkedIn",
    body: "Brand and personal accounts, via Metricool",
    channels: ["Instagram", "TikTok", "X", "LinkedIn", "Meta"],
  },
  {
    id: "ads",
    title: "Meta Ads / Google Ads",
    body: "Spend lands on the row that spent it",
    channels: ["Meta Ads", "Google Ads"],
  },
  {
    id: "email",
    title: "GHL email and SMS",
    body: "Workflows to the list, plus the newsletter",
    channels: ["Email", "SMS", "Newsletter"],
  },
  {
    id: "funnels",
    title: "VSL and low-ticket funnel",
    body: "Their own opt-in pages, hosted in GHL",
    channels: ["VSL", "Low ticket funnel"],
  },
  {
    id: "dm",
    title: "Instagram DM setter",
    body: "Pearl answers in ManyChat, sends the link",
    channels: ["Instagram DM"],
  },
];

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
    x: 300,
    y: 330,
    w: 216,
    h: 220,
    title: "The tagged link",
    tone: "hub",
  },

  {
    id: "page",
    x: 552,
    y: 240,
    w: 216,
    h: 84,
    title: "Landing / SEO page / popup",
    body: "GA4 records the session against the link's tags",
    tone: "site",
    stage: "visits",
  },
  {
    id: "chatbot",
    x: 552,
    y: 356,
    w: 216,
    h: 84,
    title: "AI chatbot setter",
    body: "Answers questions and can book the call itself",
    tone: "site",
  },
  {
    id: "form",
    x: 552,
    y: 472,
    w: 216,
    h: 84,
    title: "Lead form and qualification",
    body: "The scoring questions that decide who gets a call",
    tone: "site",
  },

  {
    id: "lead",
    x: 836,
    y: 244,
    w: 212,
    h: 92,
    title: "lead_submissions",
    body: "UTMs, paid click ids and session, kept with the lead",
    tone: "store",
    stage: "leads",
  },
  {
    id: "calendly",
    x: 836,
    y: 470,
    w: 212,
    h: 92,
    title: "Calendly booking",
    body: "A DM or chatbot link can book with no form behind it",
    tone: "external",
    stage: "booked",
  },
  {
    id: "close",
    x: 1124,
    y: 244,
    w: 204,
    h: 92,
    title: "Close CRM",
    body: "The lead, with its origin on custom fields",
    tone: "external",
  },
  {
    id: "outcome",
    x: 1124,
    y: 470,
    w: 204,
    h: 92,
    title: "Showed, won, revenue",
    body: "What the closer marked after the call",
    tone: "external",
  },

  {
    id: "spine",
    x: 420,
    y: 1060,
    w: 300,
    h: 88,
    title: "channel_daily",
    body: "One row per day per link. The only table this page reads",
    tone: "store",
  },
  {
    id: "dashboard",
    x: 860,
    y: 1060,
    w: 260,
    h: 88,
    title: "This dashboard",
    body: "Channels, KPI and this map",
    tone: "hub",
  },
];

/** Connector boxes sit in their own band and all feed the spine. */
export const CONNECTOR_BAND = {
  y: 830,
  height: 76,
  width: 140,
  gap: 10,
  x: 16,
  /** Two rows keep the band inside the width the main flow already needs. */
  perRow: 6,
  rowGap: 12,
} as const;

/** Connector id to the label a non-engineer can read. */
export const CONNECTORS: Array<{ connector: string; label: string }> = [
  { connector: "ga4-visits", label: "GA4 visits" },
  { connector: "leads", label: "Our lead forms" },
  { connector: "ghl-forms", label: "GHL forms" },
  { connector: "ghl-email", label: "GHL email" },
  { connector: "bitly-clicks", label: "Bitly clicks" },
  { connector: "metricool-posts", label: "Metricool posts" },
  { connector: "metricool-ads", label: "Metricool spend" },
  { connector: "youtube-analytics", label: "YouTube Analytics" },
  { connector: "webinar-ingest", label: "vp-webinars" },
  { connector: "manychat-ingest", label: "ManyChat" },
  { connector: "close-lead-funnel", label: "Close outcomes" },
];

export const EDGES: MapEdge[] = [
  ...SOURCES.filter((source) => source.id !== "dm").map((source) => ({
    from: source.id,
    to: "link",
  })),
  // The DM setter never touches the site: Pearl sends a calendar link.
  {
    from: "dm",
    to: "calendly",
    fromSide: "right" as const,
    toSide: "left" as const,
    label: "books direct",
  },

  { from: "link", to: "page" },
  { from: "page", to: "chatbot", fromSide: "bottom", toSide: "top" },
  { from: "chatbot", to: "form", fromSide: "bottom", toSide: "top" },

  { from: "form", to: "lead", label: "submits" },
  { from: "chatbot", to: "calendly", label: "books in chat" },
  { from: "lead", to: "calendly", fromSide: "bottom", toSide: "top" },

  { from: "lead", to: "close", label: "every 2 min" },
  { from: "calendly", to: "outcome" },
  { from: "close", to: "outcome", fromSide: "bottom", toSide: "top" },
  {
    from: "outcome",
    to: "lead",
    kind: "back",
    fromSide: "bottom",
    toSide: "bottom",
    label: "reconciled back onto the lead",
  },

  { from: "spine", to: "dashboard" },
];

export function nodeById(id: string): MapNode {
  const node = NODES.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`unknown node: ${id}`);
  return node;
}

export type Point = { x: number; y: number };

export function anchor(node: MapNode, side: Side): Point {
  switch (side) {
    case "left":
      return { x: node.x, y: node.y + node.h / 2 };
    case "right":
      return { x: node.x + node.w, y: node.y + node.h / 2 };
    case "top":
      return { x: node.x + node.w / 2, y: node.y };
    case "bottom":
      return { x: node.x + node.w / 2, y: node.y + node.h };
  }
}

/**
 * A curve that leaves and enters along the side's own axis, so an edge never
 * appears to come out of a corner. Horizontal pairs bow sideways, vertical
 * pairs bow down.
 */
export function edgePath(
  from: Point,
  to: Point,
  fromSide: Side,
  toSide: Side,
): string {
  const horizontal = fromSide === "left" || fromSide === "right";
  const span = horizontal
    ? Math.max(40, Math.abs(to.x - from.x) / 2)
    : Math.max(24, Math.abs(to.y - from.y) / 2);
  const c1 = horizontal
    ? { x: from.x + (fromSide === "right" ? span : -span), y: from.y }
    : { x: from.x, y: from.y + (fromSide === "bottom" ? span : -span) };
  const toHorizontal = toSide === "left" || toSide === "right";
  const c2 = toHorizontal
    ? { x: to.x + (toSide === "left" ? -span : span), y: to.y }
    : { x: to.x, y: to.y + (toSide === "top" ? -span : span) };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

/** The return leg: straight down, back along a clear lane, then up. */
export function backPath(from: Point, to: Point, lane: number): string {
  const radius = 12;
  const sweep = to.x < from.x ? 1 : 0;
  return [
    `M ${from.x} ${from.y}`,
    `V ${lane - radius}`,
    `A ${radius} ${radius} 0 0 ${sweep} ${from.x + (sweep ? -radius : radius)} ${lane}`,
    `H ${to.x + (sweep ? radius : -radius)}`,
    `A ${radius} ${radius} 0 0 ${sweep} ${to.x} ${lane - radius}`,
    `V ${to.y}`,
  ].join(" ");
}

/** The lane the return leg travels along, clear of every box it passes. */
export const BACK_LANE = 610;
