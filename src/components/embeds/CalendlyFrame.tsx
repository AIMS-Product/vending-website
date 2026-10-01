"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { isCalendlyOrigin } from "./calendly-origin";

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
 * extension or network), the skeleton is dropped, the iframe is shown anyway
 * (a working scheduler whose message was late or missing must never be hidden)
 * and a strip below it offers "Open the calendar in a new tab" to the same
 * src, UTMs included. The strip never overlays the iframe.
 *
 * The same real page_height also sizes the iframe, so the card hugs
 * Calendly's month view instead of leaving dead tint under it.
 * `heightClassName` stays as the pre-load minimum.
 */
const CALENDLY_STALL_MS = 15_000;
const CALENDLY_FALLBACK = "Open the calendar in a new tab";
/** Anything shorter is Calendly's redirect page, not the scheduler. */
const MIN_SCHEDULER_HEIGHT = 300;

type CalendlyMessage = Pick<MessageEvent, "origin" | "data">;

function calendlyEventName(event: CalendlyMessage): string | null {
  if (!isCalendlyOrigin(event.origin)) return null;
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

/** The IntersectionObserver constructor shape the watcher uses. */
type ObserverCtor = new (
  callback: (
    entries: Pick<IntersectionObserverEntry, "isIntersecting">[],
  ) => void,
  options?: IntersectionObserverInit,
) => Pick<IntersectionObserver, "observe" | "disconnect">;

/**
 * Listens for Calendly's messages: every scheduler height goes to `onHeight`,
 * the first painted-scheduler message calls `onLoaded`, and `onStall` fires
 * once if none has arrived within `stallMs`. Only the Calendly postMessage
 * counts as loaded, never the iframe's load event. Returns the cleanup. Kept
 * outside the component so the timing is testable without a DOM.
 *
 * The listener is attached at once, but the stall clock starts only when
 * `target` first comes within 200px of the viewport: Chrome does not paint an
 * offscreen cross-origin iframe, so a clock started at mount showed a false
 * fallback to visitors who scrolled down after 15s. With no target or no
 * IntersectionObserver, the clock starts at mount.
 */
function watchCalendly({
  source,
  onHeight,
  onLoaded,
  onStall,
  frameWindow,
  stallMs = CALENDLY_STALL_MS,
  target = null,
  Observer = typeof IntersectionObserver === "undefined"
    ? undefined
    : IntersectionObserver,
}: {
  source: MessageSource;
  onHeight: (height: number) => void;
  onLoaded: () => void;
  onStall: () => void;
  /** When set, only messages from this window count (the iframe's own). */
  frameWindow?: () => Window | null;
  stallMs?: number;
  target?: Element | null;
  Observer?: ObserverCtor;
}) {
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observer: Pick<IntersectionObserver, "disconnect"> | undefined;
  const startClock = () => {
    observer?.disconnect();
    observer = undefined;
    if (done || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      done = true;
      onStall();
    }, stallMs);
  };
  const onMessage = (event: MessageEvent) => {
    if (frameWindow) {
      const win = frameWindow();
      if (win === null || event.source !== win) return;
    }
    const measured = schedulerHeight(event);
    if (measured !== null) onHeight(measured);
    if (!isCalendlyMessage(event)) return;
    clearTimeout(timer);
    timer = undefined;
    done = true;
    observer?.disconnect();
    observer = undefined;
    onLoaded();
  };
  source.addEventListener("message", onMessage);
  if (target === null || Observer === undefined) {
    startClock();
  } else {
    const io = new Observer(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) startClock();
      },
      { rootMargin: "200px" },
    );
    observer = io;
    io.observe(target);
  }
  return () => {
    clearTimeout(timer);
    observer?.disconnect();
    source.removeEventListener("message", onMessage);
  };
}

/** A 7x5 month grid for the loading layer's calendar skeleton. */
const SKELETON_DAYS = Array.from({ length: 35 }, (_, i) => i);

const CALENDLY_STALLED_LINE = "The calendar didn't load here.";

/** The skeleton behind the iframe while loading. Never rendered once stalled. */
function LoadingLayer({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      aria-hidden
      className="bg-tint absolute inset-0 z-0 flex flex-col items-center justify-start gap-3 pt-16"
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
      <div className="mt-3 grid w-full max-w-[360px] grid-cols-7 justify-items-center gap-2 px-4">
        {SKELETON_DAYS.map((day) => (
          <span key={day} className="size-9 rounded-full bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

/** In normal flow below the iframe, so it can never cover a working scheduler. */
function StalledStrip({ frameSrc }: { frameSrc: string }) {
  return (
    <div className="bg-tint flex flex-wrap items-center justify-center gap-3 px-4 py-3">
      <p className="text-sm font-semibold text-slate-600">
        {CALENDLY_STALLED_LINE}
      </p>
      <a
        href={frameSrc}
        target="_blank"
        rel="noopener"
        className={buttonClass({ size: "md", className: "px-5" })}
      >
        {CALENDLY_FALLBACK}
      </a>
    </div>
  );
}

function FrameView({
  loaded,
  stalled,
  frameSrc,
  title,
  heightClassName,
  height,
  layerRef,
  iframeRef,
}: {
  loaded: boolean;
  stalled: boolean;
  frameSrc: string | null;
  title: string;
  heightClassName: string;
  height: number | null;
  layerRef?: Ref<HTMLDivElement>;
  iframeRef?: Ref<HTMLIFrameElement>;
}) {
  const showSkeleton = !loaded && !stalled;
  return (
    <>
      {showSkeleton ? <LoadingLayer ref={layerRef} /> : null}
      {frameSrc === null ? (
        <div aria-hidden className={cn("w-full", heightClassName)} />
      ) : (
        <iframe
          ref={iframeRef}
          className={cn(
            "relative z-10 block w-full border-0",
            showSkeleton ? "opacity-0" : "opacity-100",
            "motion-safe:transition-opacity",
            heightClassName,
          )}
          style={height === null ? undefined : { height: `${height}px` }}
          loading="eager"
          src={frameSrc}
          title={title}
        />
      )}
      {!loaded && stalled && frameSrc !== null ? (
        <StalledStrip frameSrc={frameSrc} />
      ) : null}
    </>
  );
}

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
  const layerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(
    () =>
      watchCalendly({
        source: window,
        target: layerRef.current,
        frameWindow: () => iframeRef.current?.contentWindow ?? null,
        onHeight: setReported,
        onLoaded: () => setLoaded(true),
        onStall: () => setStalled(true),
      }),
    [],
  );

  return (
    <FrameView
      loaded={loaded}
      stalled={stalled}
      frameSrc={frameSrc}
      title={title}
      heightClassName={heightClassName}
      height={height}
      layerRef={layerRef}
      iframeRef={iframeRef}
    />
  );
}

export const __testing = {
  appliedHeight,
  FrameView,
  CALENDLY_STALLED_LINE,
  isCalendlyMessage,
  schedulerHeight,
  watchCalendly,
  CALENDLY_FALLBACK,
  CALENDLY_STALL_MS,
};
