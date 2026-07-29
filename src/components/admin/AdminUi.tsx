import type { ReactNode } from "react";

export type AdminIconName =
  | "archive"
  | "book"
  | "check"
  | "crown"
  | "file"
  | "filter"
  | "help"
  | "image"
  | "layers"
  | "list"
  | "log-out"
  | "mail"
  | "more"
  | "newspaper"
  | "pencil"
  | "plus"
  | "save"
  | "search"
  | "settings"
  | "shield"
  | "target"
  | "trash"
  | "upload";

/* Shared admin design layer. ~40 files import from here, so this file is
   what makes every /admin screen look like one product. Colours, radii and
   shadows come from the --ui-* tokens in globals.css. Don't add raw hex
   here, and don't invent a second button or card shape in a page. */

// One button height, one radius, one shadow. Primary is the only filled
// control on a screen; everything else is a bordered surface.
const BUTTON_BASE =
  "inline-flex h-9 items-center justify-center gap-2 rounded-ui px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export const adminPanelClass =
  "overflow-hidden rounded-ui-lg border border-ui-line bg-ui-surface shadow-ui";

export const adminCardClass =
  "rounded-ui-lg border border-ui-line bg-ui-surface p-4 shadow-ui";

export const adminInputClass =
  "mt-1.5 w-full rounded-ui border border-ui-line-strong bg-ui-surface px-2.5 py-1.5 text-sm text-ui-text transition outline-none placeholder:text-ui-text-subtle focus:border-ui-accent focus:ring-2 focus:ring-ui-accent/15";

export const adminTextareaClass =
  "mt-1.5 w-full rounded-ui border border-ui-line-strong bg-ui-surface px-2.5 py-1.5 text-sm leading-6 text-ui-text transition outline-none placeholder:text-ui-text-subtle focus:border-ui-accent focus:ring-2 focus:ring-ui-accent/15";

export const adminLabelClass = "text-sm font-medium text-ui-text";

export const adminPrimaryButtonClass = `${BUTTON_BASE} bg-ui-accent text-white shadow-ui hover:bg-ui-accent-hover`;

export const adminSecondaryButtonClass = `${BUTTON_BASE} border border-ui-line-strong bg-ui-surface text-ui-text shadow-ui hover:bg-ui-canvas`;

export const adminSmallButtonClass = `${BUTTON_BASE} h-8 border border-ui-line-strong bg-ui-surface px-2.5 text-[0.8125rem] text-ui-text-muted shadow-ui hover:bg-ui-canvas hover:text-ui-text`;

// Destructive actions read as text, not as a red button. The red button is
// reserved for the confirmation step, where it is the actual commitment.
export const adminDangerButtonClass = `${BUTTON_BASE} h-8 border border-ui-line-strong bg-ui-surface px-2.5 text-[0.8125rem] text-ui-bad hover:border-ui-bad/40 hover:bg-ui-bad/5`;

export const adminLinkClass =
  "font-medium text-ui-accent underline-offset-2 transition hover:underline";

// Page-level type scale. Fixed rem, ~1.2 ratio. An admin title does not
// need to be 30px; the content below it is the point.
export const adminPageTitleClass =
  "text-[1.375rem] leading-7 font-semibold tracking-[-0.01em] text-ui-text";

export const adminSectionTitleClass = "text-sm font-semibold text-ui-text";

export const adminEyebrowClass =
  "text-[0.6875rem] font-semibold tracking-[0.08em] text-ui-text-subtle uppercase";

// One bordered strip, divided into columns. Four separate cards each with
// their own border and shadow is four times the visual weight for the same
// four numbers.
export function AdminMetricStrip({ children }: { children: ReactNode }) {
  return (
    <section className={`${adminPanelClass} mb-4`} aria-label="Admin summary">
      <div className="divide-ui-line grid divide-y sm:grid-cols-2 sm:divide-x xl:grid-cols-4 xl:divide-y-0">
        {children}
      </div>
    </section>
  );
}

export function AdminMetricPanel({
  tone,
  label,
  value,
  caption,
  delta,
}: {
  /** Kept for call-site compatibility. The number carries the meaning; a
   *  pastel icon chip behind it never did. */
  icon?: AdminIconName;
  tone?: "amber" | "blue" | "green" | "purple" | "slate";
  label: string;
  value: number | string;
  caption: string;
  /** Optional movement chip, rendered ahead of the caption. */
  delta?: ReactNode;
}) {
  return (
    <div className="px-4 py-3.5">
      <p className={adminEyebrowClass}>{label}</p>
      <p className="text-ui-text mt-2 text-2xl leading-none font-semibold tracking-[-0.02em] tabular-nums">
        {value}
      </p>
      <p className="text-ui-text-muted mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        {delta}
        {tone && tone !== "blue" && tone !== "slate" ? (
          <AdminStatusDot tone={tone === "green" ? "ok" : "warn"} />
        ) : null}
        {caption}
      </p>
    </div>
  );
}

/**
 * Horizontal magnitude bar for a ranked list. `share` is this row's value over
 * the largest value in the same panel.
 *
 * One hue, and length is the only encoding. Tinting a bar darker because it is
 * longer spends the colour channel restating what the length already says.
 *
 * There is deliberately no track behind the fill: a full-width grey rail under
 * every row is what made a 25% row and a 2% row read as the same object, since
 * the eye anchors on the rail, which is identical on every row. Without it the
 * panel's silhouette is the ranking. The fill is square where it starts and
 * rounded only at the data end, so a short bar still reads as a short bar
 * rather than as a pill.
 */
export function AdminBar({ share }: { share: number }) {
  const pct = Math.min(1, Math.max(0, share)) * 100;
  return (
    // The value is printed as text beside every bar, so the bar is decoration
    // for a screen reader.
    <div className="h-1.5 w-full" aria-hidden="true">
      <div
        className="bg-ui-accent h-1.5 rounded-r-[3px]"
        // A row with one lead out of four hundred is still a row that happened;
        // the floor keeps it visible instead of rounding it out of existence.
        style={{ width: pct > 0 ? `max(2px, ${pct}%)` : undefined }}
      />
    </div>
  );
}

/**
 * Movement against the prior window. Direction is carried by the sign as well
 * as the colour, so it survives being read in greyscale.
 */
export function AdminDeltaChip({
  tone,
  children,
}: {
  tone: "up" | "down" | "neutral";
  children: ReactNode;
}) {
  const toneClass =
    tone === "up"
      ? "bg-ui-ok-fill text-ui-ok-ink"
      : tone === "down"
        ? "bg-ui-bad-fill text-ui-bad-ink"
        : "bg-ui-idle-fill text-ui-idle-ink";
  return (
    <span
      className={`rounded-ui inline-flex w-fit items-center px-1.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap tabular-nums ${toneClass}`}
    >
      {children}
    </span>
  );
}

function AdminStatusDot({ tone }: { tone: "ok" | "warn" | "bad" | "idle" }) {
  const fill =
    tone === "ok"
      ? "bg-ui-ok"
      : tone === "warn"
        ? "bg-ui-warn"
        : tone === "bad"
          ? "bg-ui-bad"
          : "bg-ui-idle";
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-1.5 shrink-0 rounded-full ${fill}`}
    />
  );
}

/* Status is a soft tinted chip. A bare dot is too small to pick out when you
   are scanning a long column, so the whole chip carries the colour. The fill
   stays pale and the word is always present, so it reads at a glance without
   relying on colour alone. */
const STATUS_CHIP_CLASS: Record<"ok" | "warn" | "bad" | "idle", string> = {
  ok: "bg-ui-ok-fill text-ui-ok-ink",
  warn: "bg-ui-warn-fill text-ui-warn-ink",
  bad: "bg-ui-bad-fill text-ui-bad-ink",
  idle: "bg-ui-idle-fill text-ui-idle-ink",
};

export function AdminStatusBadge({
  status,
  label,
}: {
  status: string;
  /** Override the visible text without changing the stored status value. */
  label?: string;
}) {
  return (
    <span
      className={`rounded-ui inline-flex w-fit items-center px-2 py-0.5 text-[0.8125rem] font-medium whitespace-nowrap ${
        STATUS_CHIP_CLASS[adminStatusTone(status)]
      }`}
    >
      {label ?? formatAdminStatus(status)}
    </span>
  );
}

export function AdminIcon({ icon }: { icon: AdminIconName }) {
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.9,
    className: "h-5 w-5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (icon) {
    case "archive":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M6 7v11h12V7" />
          <path d="M9 11h6" />
          <path d="M7 4h10l1 3H6l1-3Z" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z" />
          <path d="M9 8h6" />
          <path d="M9 12h5" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
          <path d="m8.8 12.2 2 2 4.4-4.6" />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="M4 18h16" />
          <path d="M6 18V11l3 2.5L12 8l3 4.5L18 11v7" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7V3Z" />
          <path d="M14 3v5h5" />
          <path d="M10 12h5" />
          <path d="M10 16h4" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4V5Z" />
          <path d="m5 17 5-5 4 4 2-2 3 3" />
          <path d="M15 9h.01" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 6h12" />
          <path d="M8 12h12" />
          <path d="M8 18h12" />
          <path d="M4 6h.01" />
          <path d="M4 12h.01" />
          <path d="M4 18h.01" />
        </svg>
      );
    case "log-out":
      return (
        <svg {...common}>
          <path d="M10 17H5V7h5" />
          <path d="M14 8l4 4-4 4" />
          <path d="M18 12H9" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <path d="M4 6h16v12H4V6Z" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <path d="M12 5h.01" />
          <path d="M12 12h.01" />
          <path d="M12 19h.01" />
        </svg>
      );
    case "newspaper":
      return (
        <svg {...common}>
          <path d="M5 5h12a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2V5Z" />
          <path d="M8 9h8" />
          <path d="M8 13h3" />
          <path d="M13 13h3" />
          <path d="M8 17h8" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
          <path d="m14 7 3 3" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "save":
      return (
        <svg {...common}>
          <path d="M5 4h11l3 3v13H5V4Z" />
          <path d="M8 4v6h7V4" />
          <path d="M8 20v-6h8v6" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <path d="m21 21-4.3-4.3" />
          <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.25" />
          <path d="M12 2v2.5" />
          <path d="M12 19.5V22" />
          <path d="M2 12h2.5" />
          <path d="M19.5 12H22" />
          <path d="m4.9 4.9 1.8 1.8" />
          <path d="m17.3 17.3 1.8 1.8" />
          <path d="m4.9 19.1 1.8-1.8" />
          <path d="m17.3 6.7 1.8-1.8" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 21s7-3.5 7-10V5l-7-3-7 3v6c0 6.5 7 10 7 10Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
          <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
      );
  }
}

/* Every status used to fall through to the same pale amber, so a synced
   lead and a permanently failed one looked identical. Explicit sets first,
   then a keyword fallback so an unlisted status still lands somewhere sane
   instead of silently reading as "in progress".
   Order matters: "needs_review" must be caught as bad before the "review"
   keyword pushes it into warn. */
const OK_STATUSES = new Set([
  "active",
  "approved",
  "complete",
  "completed",
  "delivered",
  "published",
  "qualified",
  "sent",
  "stored",
  "synced",
]);

const BAD_STATUSES = new Set([
  "dead_letter",
  "error",
  "failed",
  "high",
  "needs_review",
  "qualification_expired",
]);

const WARN_STATUSES = new Set([
  "in_progress",
  "medium",
  "pending",
  "pending_setup",
  "processing",
  "qualification_pending",
  "qualification_stale",
  "queued",
  "retrying",
  "stale",
]);

const IDLE_STATUSES = new Set([
  "archived",
  "draft",
  "external",
  "low",
  "none",
  "unknown",
]);

export function adminStatusTone(
  status: string,
): "ok" | "warn" | "bad" | "idle" {
  if (BAD_STATUSES.has(status)) return "bad";
  if (OK_STATUSES.has(status)) return "ok";
  if (WARN_STATUSES.has(status)) return "warn";
  if (IDLE_STATUSES.has(status)) return "idle";

  if (/fail|expired|dead|error|reject|block/.test(status)) return "bad";
  if (/pending|retry|progress|stale|review|queue|wait/.test(status)) {
    return "warn";
  }
  if (/synced|complete|qualified|publish|approve|active|success/.test(status)) {
    return "ok";
  }
  return "idle";
}

function formatAdminStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}
