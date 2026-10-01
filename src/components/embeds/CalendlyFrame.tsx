"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * The Calendly iframe plus a light "Loading available times…" layer behind
 * it, so the card is never a blank box while the scheduler loads. The layer
 * is removed once Calendly itself reports a painted scheduler: Calendly's page
 * is transparent outside its own card, and the surface around it should read
 * as the card, not the loading state.
 *
 * The iframe's own load event is not used. Calendly's first document loads in
 * ~3s, then redirects and paints the calendar several seconds later, so
 * clearing on `onLoad` left a blank tint box in between. Not every
 * `calendly.*` message works either: the redirect page posts page_height
 * "26px" / "2px" 1-2s before the calendar paints. So the layer clears on
 * `calendly.event_type_viewed`, or on a page_height tall enough to be the
 * scheduler. The iframe stays transparent until then, so Calendly's own
 * loading dots never show on top of ours.
 *
 * If no such message arrives within CALENDLY_STALL_MS (Calendly blocked by an
 * extension or network), the layer offers "Open the calendar in a new tab" to
 * the same src, UTMs included, so the page's only booking path never dead-ends.
 * A Calendly message that arrives after the stall still clears the layer.
 *
 * The same real page_height also sizes the iframe, so the card hugs
 * Calendly's month view instead of leaving dead tint under it.
 * `heightClassName` stays as the pre-load minimum.
 */
const CALENDLY_STALL_MS = 15_000;
const CALENDLY_FALLBACK = "Open the calendar in a new tab";
const CALENDLY_ORIGIN = "https://calendly.com";
/** Anything shorter is Calendly's redirect page, not the scheduler. */
const MIN_SCHEDULER_HEIGHT = 300;

type CalendlyMessage = Pick<MessageEvent, "origin" | "data">;

function calendlyEventName(event: CalendlyMessage): string | null {
  if (event.origin !== CALENDLY_ORIGIN) return null;
  const data: unknown = event.data;
  if (typeof data !== "object" || data === null) return null;
  const name = (data as { event?: unknown }).event;
  return typeof name === "string" && name.startsWith("calendly.") ? name : null;
}

/** The scheduler's painted height, or null if this message does not carry one. */
function schedulerHeight(event: CalendlyMessage): number | null {
  if (calendlyEventName(event) !== "calendly.page_height") return null;
  const payload = (event.data as { payload?: unknown }).payload;
  if (typeof payload !== "object" || payload === null) return null;
  const raw = (payload as { height?: unknown }).height;
  const height =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseInt(raw, 10)
        : NaN;
  return Number.isFinite(height) && height >= MIN_SCHEDULER_HEIGHT
    ? height
    : null;
}

/** The phone frame's pre-load height (h-[520px] at the call sites). */
const PHONE_MIN_HEIGHT = 520;
/**
 * Calendly's phone date picker reports ~80px more than it paints, which left
 * ~120px of blank white in the card. Six-row months still fit at -80.
 */
const PHONE_HEIGHT_TRIM = 80;

/** The height applied to the iframe: phone date picker clamped, else as reported. */
function appliedHeight(reported: number | null, phoneBranch: boolean) {
  if (reported === null || !phoneBranch) return reported;
  return Math.max(PHONE_MIN_HEIGHT, reported - PHONE_HEIGHT_TRIM);
}

/** True once a message shows the scheduler has painted. */
function isCalendlyMessage(event: CalendlyMessage) {
  return (
    calendlyEventName(event) === "calendly.event_type_viewed" ||
    schedulerHeight(event) !== null
  );
}

/** What the watcher needs of window; a Window satisfies it. */
type MessageSource = Pick<Window, "addEventListener" | "removeEventListener">;

/**
 * Listens for Calendly's messages: every scheduler height goes to `onHeight`,
 * the first painted-scheduler message calls `onLoaded`, and `onStall` fires
 * once if none has arrived within `stallMs`. Only the Calendly postMessage
 * counts as loaded, never the iframe's load event. Returns the cleanup. Kept
 * outside the component so the timing is testable without a DOM.
 */
function watchCalendly({
  source,
  onHeight,
  onLoaded,
  onStall,
  stallMs = CALENDLY_STALL_MS,
}: {
  source: MessageSource;
  onHeight: (height: number) => void;
  onLoaded: () => void;
  onStall: () => void;
  stallMs?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timer = undefined;
    onStall();
  }, stallMs);
  const onMessage = (event: MessageEvent) => {
    const measured = schedulerHeight(event);
    if (measured !== null) onHeight(measured);
    if (!isCalendlyMessage(event)) return;
    clearTimeout(timer);
    timer = undefined;
    onLoaded();
  };
  source.addEventListener("message", onMessage);
  return () => {
    clearTimeout(timer);
    source.removeEventListener("message", onMessage);
  };
}

/** A 7x5 month grid for the loading layer's calendar skeleton. */
const SKELETON_DAYS = Array.from({ length: 35 }, (_, i) => i);

const PHONE_QUERY = "(max-width: 767px)";
const noSubscribe = () => () => {};
const isPhone = () => window.matchMedia(PHONE_QUERY).matches;
const unknownOnServer = () => null;

export function CalendlyFrame({
  src,
  phoneSrc,
  title,
  heightClassName,
}: {
  src: string;
  /**
   * A phone-only src. When set, the iframe waits for the client to know the
   * viewport and then loads exactly one of the two, so it never loads twice
   * and the server markup never disagrees with the client's.
   */
  phoneSrc?: string;
  title: string;
  heightClassName: string;
}) {
  const phone = useSyncExternalStore<boolean | null>(
    noSubscribe,
    isPhone,
    unknownOnServer,
  );
  const frameSrc =
    phoneSrc === undefined
      ? src
      : phone === null
        ? null
        : phone
          ? phoneSrc
          : src;
  const [loaded, setLoaded] = useState(false);
  const [reported, setReported] = useState<number | null>(null);
  const height = appliedHeight(
    reported,
    phoneSrc !== undefined && phone === true,
  );

  const [stalled, setStalled] = useState(false);

  useEffect(
    () =>
      watchCalendly({
        source: window,
        onHeight: setReported,
        onLoaded: () => setLoaded(true),
        onStall: () => setStalled(true),
      }),
    [],
  );

  return (
    <>
      {loaded ? null : (
        <div
          aria-hidden={stalled ? undefined : true}
          className={cn(
            "bg-tint absolute inset-0 flex flex-col items-center justify-start gap-3 pt-16",
            stalled ? "z-20" : "z-0",
          )}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6 text-[var(--brand-700)] motion-safe:animate-spin"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-sm font-semibold text-slate-600">
            Loading available times…
          </p>
          {stalled && frameSrc !== null ? (
            <a
              href={frameSrc}
              target="_blank"
              rel="noopener"
              className={buttonClass({ size: "md", className: "px-5" })}
            >
              {CALENDLY_FALLBACK}
            </a>
          ) : null}
          <div className="mt-3 grid w-full max-w-[360px] grid-cols-7 justify-items-center gap-2 px-4">
            {SKELETON_DAYS.map((day) => (
              <span key={day} className="size-9 rounded-full bg-slate-100" />
            ))}
          </div>
        </div>
      )}
      {frameSrc === null ? (
        <div aria-hidden className={cn("w-full", heightClassName)} />
      ) : (
        <iframe
          className={cn(
            "relative z-10 block w-full border-0",
            loaded ? "opacity-100" : "opacity-0",
            "motion-safe:transition-opacity",
            heightClassName,
          )}
          style={height === null ? undefined : { height: `${height}px` }}
          loading="eager"
          src={frameSrc}
          title={title}
        />
      )}
    </>
  );
}

export const __testing = {
  appliedHeight,
  isCalendlyMessage,
  schedulerHeight,
  watchCalendly,
  CALENDLY_FALLBACK,
  CALENDLY_STALL_MS,
};
