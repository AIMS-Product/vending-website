import Link from "next/link";
import {
  anchor,
  backPath,
  edgePath,
  nodeById,
  BACK_LANE,
  CANVAS,
  CONNECTOR_BAND,
  CONNECTORS,
  EDGES,
  NODES,
  type MapNode,
  type Side,
} from "@/components/admin/funnel-map-graph";
import type { SyncHealthRow } from "@/lib/services/channel-report-rollup";

/**
 * The diagram itself: one SVG of edges with HTML boxes positioned over it on
 * the same coordinate grid. The canvas scrolls sideways rather than reflowing,
 * because a flow chart that rearranges itself at a breakpoint is telling a
 * different story at every width.
 */

const TONE_CLASS: Record<MapNode["tone"], string> = {
  source: "border-ui-line bg-ui-surface",
  hub: "border-ui-accent/40 bg-ui-accent/5",
  site: "border-ui-line bg-ui-surface",
  store: "border-ui-line-strong border-dashed bg-ui-canvas",
  external: "border-ui-line bg-ui-canvas",
};

export function FunnelMapDiagram({
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
            height={780}
            label="Going out — every surface we publish to"
          />
          <GroupBox
            x={536}
            y={212}
            width={248}
            height={360}
            label="vendingpreneurs.com"
          />
          <GroupBox
            x={8}
            y={798}
            width={916}
            height={220}
            label="Connectors — each platform reports on its own surface, once a day"
          />

          {EDGES.map((edge) => {
            const from = nodeById(edge.from);
            const to = nodeById(edge.to);
            const fromSide: Side = edge.fromSide ?? "right";
            const toSide: Side = edge.toSide ?? "left";
            const start = anchor(from, fromSide);
            const end = anchor(to, toSide);
            const isBack = edge.kind === "back";
            const d = isBack
              ? backPath(start, end, BACK_LANE)
              : edgePath(start, end, fromSide, toSide);
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray={isBack ? "5 4" : undefined}
                  markerEnd="url(#funnel-arrow)"
                  opacity={isBack ? 0.75 : 1}
                />
                {edge.label ? (
                  <EdgeLabel
                    text={edge.label}
                    x={isBack ? (start.x + end.x) / 2 : (start.x + end.x) / 2}
                    y={isBack ? BACK_LANE - 8 : (start.y + end.y) / 2 - 8}
                  />
                ) : null}
              </g>
            );
          })}

          {/* Every connector writes into the one spine table. */}
          {CONNECTORS.map((entry, index) => {
            const box = connectorRect(index);
            const target = {
              x:
                nodeById("spine").x +
                36 +
                (index * (nodeById("spine").w - 72)) / (CONNECTORS.length - 1),
              y: nodeById("spine").y,
            };
            return (
              <path
                key={entry.connector}
                d={edgePath(
                  { x: box.x + box.w / 2, y: box.y + box.h },
                  target,
                  "bottom",
                  "top",
                )}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.5}
                markerEnd="url(#funnel-arrow)"
              />
            );
          })}
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
          return (
            <div
              key={entry.connector}
              className="border-ui-line bg-ui-surface rounded-ui absolute border p-2"
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
              }}
            >
              <div className="flex items-start justify-between gap-1">
                <p className="text-ui-text text-[0.6875rem] leading-4 font-medium">
                  {entry.label}
                </p>
                <StatusDot status={run?.status ?? "never"} />
              </div>
              <p className="text-ui-text-subtle mt-1 text-[0.625rem] leading-4 tabular-nums">
                {run?.finishedAt
                  ? `${run.rowsWritten.toLocaleString()} rows`
                  : "never run"}
              </p>
              {run?.status === "failed" || run?.status === "stale" ? (
                <p className="text-ui-bad text-[0.625rem] leading-3">
                  {run.status === "failed" ? "failing" : "stale"}
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
      <p className="text-ui-text text-xs leading-4 font-semibold">
        {node.title}
      </p>
      {metric ? (
        <p className="text-ui-text mt-0.5 text-[0.8125rem] leading-5 font-semibold tabular-nums">
          {metric}
        </p>
      ) : null}
      {node.body ? (
        <p className="text-ui-text-muted mt-0.5 text-[0.6875rem] leading-4">
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
      className={`${className} hover:border-ui-accent block`}
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
    <dl className="mt-1.5 space-y-0.5 text-[0.625rem] leading-4">
      {[
        ["utm_source", "the platform"],
        ["utm_medium", "paid / organic / email / dm"],
        ["utm_campaign", "the thing promoted"],
        ["utm_content", "the post, ad or video"],
        ["utm_term", "the destination, never inferred"],
      ].map(([field, meaning]) => (
        <div key={field} className="flex gap-1.5">
          <dt className="text-ui-text shrink-0 font-mono">{field}</dt>
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

/** A halo keeps the label legible where it crosses its own edge. */
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
      className={`mt-1 size-1.5 shrink-0 rounded-full ${tone}`}
      title={status}
    />
  );
}
