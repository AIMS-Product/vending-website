import Link from "next/link";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import {
  anchor,
  busStops,
  corners,
  nodeById,
  orthPath,
  CANVAS,
  CONNECTOR_BAND,
  CONNECTORS,
  EDGES,
  NODES,
  SOURCE_BUS_X,
  type MapNode,
  type Side,
} from "@/components/admin/funnel-map-graph";
import type { SyncHealthRow } from "@/lib/services/channel-report-rollup";

/**
 * The diagram: one SVG of orthogonal edges with HTML boxes positioned over it
 * on a shared coordinate grid, so wrapping, links and live numbers stay
 * markup while the SVG draws only the wiring.
 *
 * The two fan-ins are drawn as buses rather than one curve per source. Six
 * curves into a box and eleven into a table is spaghetti; a stub into a trunk
 * into a single arrow is a wiring diagram.
 */

const TONE_CLASS: Record<MapNode["tone"], string> = {
  source: "border-ui-line bg-ui-surface",
  hub: "border-ui-accent/40 bg-ui-accent/5",
  site: "border-ui-line bg-ui-surface",
  store: "border-ui-line-strong border-dashed bg-ui-canvas",
  external: "border-ui-line bg-ui-canvas",
};

export function FunnelMapCanvas({
  metrics,
  runs,
  hrefs,
}: {
  /** Live text to print inside a box, by node id. */
  metrics: Record<string, string | undefined>;
  runs: SyncHealthRow[];
  hrefs: Record<string, string | undefined>;
}) {
  const runByConnector = new Map(runs.map((run) => [run.connector, run]));
  const stops = busStops();
  const link = nodeById("link");
  const spine = nodeById("spine");

  const busTop = Math.min(...stops.map((stop) => stop.y));
  const busBottom = Math.max(...stops.map((stop) => stop.y));
  const linkEntry = link.y + link.h / 2;

  const rowLanes = connectorRowLanes();
  const riserTop = Math.min(...rowLanes);

  return (
    <div className="border-ui-line bg-ui-surface shadow-ui rounded-ui-lg overflow-x-auto">
      <div
        className="relative"
        style={{ width: CANVAS.width, height: CANVAS.height }}
      >
        <svg
          className="text-ui-text-subtle absolute inset-0"
          width={CANVAS.width}
          height={CANVAS.height}
          viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
          aria-hidden
        >
          <defs>
            <marker
              id="funnel-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor" />
            </marker>
          </defs>

          <GroupBox
            x={8}
            y={32}
            width={284}
            height={832}
            label="Going out — every surface we publish to"
          />
          <GroupBox
            x={584}
            y={212}
            width={248}
            height={374}
            label="vendingpreneurs.com"
          />
          <GroupBox
            x={8}
            y={872}
            width={932}
            height={248}
            label="Connectors — each platform reports on its own surface, once a day"
          />

          {/* Source bus: six stubs, one trunk, one arrow into the link. */}
          {stops.map((stop) => {
            const node = nodeById(stop.id);
            return (
              <line
                key={stop.id}
                x1={node.x + node.w}
                y1={stop.y}
                x2={SOURCE_BUS_X}
                y2={stop.y}
                stroke="currentColor"
                strokeWidth={1.5}
              />
            );
          })}
          <line
            x1={SOURCE_BUS_X}
            y1={busTop}
            x2={SOURCE_BUS_X}
            y2={busBottom}
            stroke="currentColor"
            strokeWidth={1.5}
          />
          <line
            x1={SOURCE_BUS_X}
            y1={linkEntry}
            x2={link.x}
            y2={linkEntry}
            stroke="currentColor"
            strokeWidth={1.5}
            markerEnd="url(#funnel-arrow)"
          />
          {stops.map((stop) => (
            <circle
              key={`dot-${stop.id}`}
              cx={SOURCE_BUS_X}
              cy={stop.y}
              r={2.5}
              fill="currentColor"
            />
          ))}

          {EDGES.map((edge) => {
            const from = nodeById(edge.from);
            const to = nodeById(edge.to);
            const fromSide: Side = edge.fromSide ?? "right";
            const toSide: Side = edge.toSide ?? "left";
            const start = anchor(from, fromSide, edge.fromOffset ?? 0);
            const end = anchor(to, toSide, edge.toOffset ?? 0);
            const isBack = edge.kind === "back";
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={orthPath(corners(start, end, fromSide, toSide, edge.via))}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray={isBack ? "5 4" : undefined}
                  markerEnd="url(#funnel-arrow)"
                  opacity={isBack ? 0.7 : 1}
                />
                {edge.label && edge.labelAt ? (
                  <EdgeLabel
                    text={edge.label}
                    x={edge.labelAt.x}
                    y={edge.labelAt.y}
                  />
                ) : null}
              </g>
            );
          })}

          {/* Connector bus: each row drops into its own lane, both lanes ride
              one riser down into the spine. */}
          {CONNECTORS.map((entry, index) => {
            const box = connectorRect(index);
            const lane = rowLanes[Math.floor(index / CONNECTOR_BAND.perRow)]!;
            return (
              <g key={`drop-${entry.connector}`}>
                <line
                  x1={box.x + box.w / 2}
                  y1={box.y + box.h}
                  x2={box.x + box.w / 2}
                  y2={lane}
                  stroke="currentColor"
                  strokeWidth={1.25}
                />
                <circle
                  cx={box.x + box.w / 2}
                  cy={lane}
                  r={2.5}
                  fill="currentColor"
                />
              </g>
            );
          })}
          {rowLanes.map((lane) => (
            <line
              key={`lane-${lane}`}
              x1={CONNECTOR_BAND.x + CONNECTOR_BAND.width / 2}
              y1={lane}
              x2={CONNECTOR_BAND.riserX}
              y2={lane}
              stroke="currentColor"
              strokeWidth={1.25}
            />
          ))}
          <line
            x1={CONNECTOR_BAND.riserX}
            y1={riserTop}
            x2={CONNECTOR_BAND.riserX}
            y2={spine.y}
            stroke="currentColor"
            strokeWidth={1.5}
            markerEnd="url(#funnel-arrow)"
          />
        </svg>

        {NODES.map((node) => (
          <NodeBox
            key={node.id}
            node={node}
            metric={metrics[node.id]}
            href={hrefs[node.id]}
          />
        ))}

        {CONNECTORS.map((entry, index) => {
          const box = connectorRect(index);
          const run = runByConnector.get(entry.connector);
          const status = run?.status ?? "never";
          return (
            <div
              key={entry.connector}
              className="border-ui-line bg-ui-surface rounded-ui absolute border px-2 py-1.5"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            >
              <div className="flex items-center gap-1.5">
                <ChannelLogo label={entry.logo} />
                <p className="text-ui-text truncate text-[0.6875rem] leading-4 font-medium">
                  {entry.label}
                </p>
                <StatusDot status={status} />
              </div>
              <p className="text-ui-text-subtle mt-1 text-[0.625rem] leading-4 tabular-nums">
                {run?.finishedAt
                  ? `${run.rowsWritten.toLocaleString()} rows`
                  : "never run"}
              </p>
              {status === "failed" || status === "stale" ? (
                <p
                  className={`text-[0.625rem] leading-4 font-medium ${
                    status === "failed" ? "text-ui-bad" : "text-ui-warn"
                  }`}
                >
                  {status === "failed" ? "failing" : "stale"}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function connectorRect(index: number) {
  const column = index % CONNECTOR_BAND.perRow;
  const row = Math.floor(index / CONNECTOR_BAND.perRow);
  return {
    x: CONNECTOR_BAND.x + column * (CONNECTOR_BAND.width + CONNECTOR_BAND.gap),
    y: CONNECTOR_BAND.y + row * (CONNECTOR_BAND.height + CONNECTOR_BAND.rowGap),
    w: CONNECTOR_BAND.width,
    h: CONNECTOR_BAND.height,
  };
}

/** Row 1 drops into the gap above row 2; row 2 drops below the band. */
function connectorRowLanes(): number[] {
  const rows = Math.ceil(CONNECTORS.length / CONNECTOR_BAND.perRow);
  return Array.from({ length: rows }, (_, row) => {
    const bottom =
      CONNECTOR_BAND.y +
      row * (CONNECTOR_BAND.height + CONNECTOR_BAND.rowGap) +
      CONNECTOR_BAND.height;
    return bottom + CONNECTOR_BAND.rowGap / 2;
  });
}

function NodeBox({
  node,
  metric,
  href,
}: {
  node: MapNode;
  metric?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5">
        {node.logos?.map((logo) => (
          <ChannelLogo key={logo} label={logo} />
        ))}
        <p className="text-ui-text truncate text-xs leading-4 font-semibold">
          {node.title}
        </p>
      </div>
      {metric ? (
        <p className="text-ui-text mt-1 text-[0.8125rem] leading-4 font-semibold tabular-nums">
          {metric}
        </p>
      ) : null}
      {node.body ? (
        <p className="text-ui-text-muted mt-1 text-[0.6875rem] leading-4">
          {node.body}
        </p>
      ) : null}
      {node.id === "link" ? <UtmList /> : null}
    </>
  );

  const className = `absolute overflow-hidden rounded-ui border p-2.5 ${TONE_CLASS[node.tone]}`;
  const style = { left: node.x, top: node.y, width: node.w, height: node.h };

  return href ? (
    <Link
      href={href}
      className={`${className} hover:border-ui-accent block transition`}
      style={style}
    >
      {inner}
    </Link>
  ) : (
    <div className={className} style={style}>
      {inner}
    </div>
  );
}

/** The one rule, written where the link is. */
function UtmList() {
  return (
    <dl className="mt-2 space-y-1 text-[0.625rem] leading-4">
      {[
        ["utm_source", "the platform"],
        ["utm_medium", "paid / organic / email / dm"],
        ["utm_campaign", "the thing promoted"],
        ["utm_content", "the post, ad or video"],
        ["utm_term", "the destination, never inferred"],
      ].map(([field, meaning]) => (
        <div key={field}>
          <dt className="text-ui-text font-mono">{field}</dt>
          <dd className="text-ui-text-muted">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

function GroupBox({
  x,
  y,
  width,
  height,
  label,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={10}
        fill="none"
        stroke="currentColor"
        strokeDasharray="3 5"
        opacity={0.5}
      />
      <text
        x={x + 10}
        y={y - 7}
        className="fill-current text-[10px] font-semibold tracking-[0.08em] uppercase"
      >
        {label}
      </text>
    </g>
  );
}

/** A halo keeps the label legible where it sits on its own edge. */
function EdgeLabel({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className="fill-current text-[10px]"
      stroke="var(--color-ui-surface, #fff)"
      strokeWidth={4}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "ok"
      ? "bg-ui-ok"
      : status === "failed"
        ? "bg-ui-bad"
        : status === "stale"
          ? "bg-ui-warn"
          : "bg-ui-line-strong";
  return (
    <span
      className={`ml-auto size-1.5 shrink-0 rounded-full ${tone}`}
      title={status}
    />
  );
}
