"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const GHL_FORM_LOADING = "Loading your application…";
const GHL_FORM_FALLBACK = "Open the application";
const NEW_TAB_NOTE = " (opens in a new tab)";
/** UI status line over the stalled form's link; not offer copy. */
const GHL_FORM_STALLED = "The application didn't load here.";

/** How long the form may take before the visitor is offered a way round it. */
export const GHL_FORM_STALL_MS = 15_000;

/**
 * Calls `onStall` once if not cancelled within `ms`; returns the cancel.
 * Kept outside the component so the timing is testable without a DOM.
 */
export function watchForStall(onStall: () => void, ms = GHL_FORM_STALL_MS) {
  const timer = setTimeout(onStall, ms);
  return () => clearTimeout(timer);
}

/**
 * Arms the stall clock only while the iframe exists and has not loaded; until
 * then there is nothing to wait for, so no fallback can appear. Returns the
 * cancel, or undefined when nothing was armed. The component's effect is a
 * thin call to this, so the rule is testable without a DOM.
 */
export function armStallWatch({
  loaded,
  mounted,
  onStall,
  ms = GHL_FORM_STALL_MS,
}: {
  loaded: boolean;
  mounted: boolean;
  onStall: () => void;
  ms?: number;
}) {
  if (loaded || !mounted) return undefined;
  return watchForStall(onStall, ms);
}

/** The GHL form's own origins: api.leadconnectorhq.com, *.msgsndr.com. */
const GHL_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*(leadconnectorhq|msgsndr)\.com$/i;

export function isGhlOrigin(origin: string) {
  return GHL_ORIGIN.test(origin);
}

/** What the tracker needs of the iframe; an HTMLIFrameElement satisfies it. */
type GhlFrame = { style: { height: string } };

/**
 * Watches a mounted GHL iframe until the form has really arrived, and offers
 * the fallback if it has not within `stallMs`.
 *
 * The iframe's own `load` is deliberately not a signal: when GHL is blocked
 * the aborted navigation still fires it, over a blank frame. The form counts
 * as arrived only once its page has spoken: a postMessage from a GHL origin
 * (iFrameResizer's "Ready"/size message, "iframeLoaded"), or form_embed.js
 * giving the iframe an explicit height. It is then shown once `isShown()`
 * (form_embed.js hides the frame until it has sized it), so the skeleton
 * never fades to a blank card. A form that arrives after the stall still
 * calls `onLoaded`, which hides the fallback. Returns the cleanup.
 */
export function trackGhlForm({
  frame,
  messages,
  isShown,
  onLoaded,
  onStall,
  stallMs = GHL_FORM_STALL_MS,
  pollMs = 150,
}: {
  frame: GhlFrame;
  /** Where the form's postMessages land: the page's window. */
  messages: EventTarget;
  isShown: () => boolean;
  onLoaded: () => void;
  onStall: () => void;
  stallMs?: number;
  pollMs?: number;
}) {
  let spoke = false;
  const onMessage = (event: Event) => {
    if (event instanceof MessageEvent && isGhlOrigin(event.origin)) {
      spoke = true;
    }
  };
  const cancelStall = watchForStall(onStall, stallMs);
  const poll = setInterval(() => {
    if ((spoke || frame.style.height !== "") && isShown()) {
      cleanup();
      onLoaded();
    }
  }, pollMs);
  messages.addEventListener("message", onMessage);
  function cleanup() {
    cancelStall();
    clearInterval(poll);
    messages.removeEventListener("message", onMessage);
  }
  return cleanup;
}

/** Grey label / field / text bars; the submit bar carries the button blue. */
const bar = "rounded-control bg-slate-100";
const label = `${bar} h-4 w-40 self-start`;
const field = `${bar} h-[42px] w-full`;

/**
 * The GHL form's slot, and the layer under its iframe (z-0 under its z-10)
 * that fills the slot's reserved height with the loaded form's shape, so the
 * card is never a blank screen while form_embed.js loads (2-12s). It stays
 * until the form inside the iframe has messaged the page (see trackGhlForm)
 * and the iframe is revealed, then fades; a white form covers it either way,
 * so a missed event only leaves it hidden underneath.
 *
 * If GHL is blocked (ad blockers, strict networks) no message ever comes,
 * even though the aborted iframe still fires `load`. GHL_FORM_STALL_MS after
 * the iframe mounts, the skeleton gives way to a short panel (one line and a
 * link to the same form on GHL, same UTM params) and the slot sets
 * `data-stalled`, which drops its reserved height and collapses the blank
 * iframe to zero, so the card shrinks to the panel instead of leaving the
 * link under a column of fields that never load. A late form is sized by
 * form_embed.js's inline height (beating the collapse), which counts as
 * loaded: the attribute goes, the slot takes its height back and the panel
 * fades away over it.
 */
export function GhlFormLoading({
  iframeId,
  fallbackHref,
  slotId,
  className,
  children,
}: {
  iframeId: string;
  /** The form's own URL, opened in a new tab if the embed never loads. */
  fallbackHref: string;
  slotId?: string;
  /** The slot's classes; `data-stalled` variants can target it. */
  className?: string;
  /** The iframe (and its loader), rendered in the slot over the layer. */
  children?: ReactNode;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const slot = layer.current?.parentElement;
    if (!slot) return;
    let frame: HTMLIFrameElement | null = null;
    let stopTracking: (() => void) | undefined;

    const shown = (el: HTMLElement) => {
      const style = getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        el.offsetHeight > 0
      );
    };
    // The iframe mounts only near the viewport, so the stall clock starts
    // when it exists: a visitor who watches the replay first never scrolls
    // down to a fallback for a form that had no chance to load.
    const attach = () => {
      const found = document.getElementById(iframeId);
      if (!(found instanceof HTMLIFrameElement) || found === frame) return;
      frame = found;
      const current = found;
      stopTracking?.();
      stopTracking = trackGhlForm({
        frame: current,
        messages: window,
        isShown: () => shown(current),
        onLoaded: () => setLoaded(true),
        onStall: () => setStalled(true),
      });
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(slot, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      stopTracking?.();
    };
  }, [iframeId]);

  const showFallback = stalled && !loaded;
  return (
    <div
      id={slotId}
      data-stalled={showFallback ? "" : undefined}
      className={className}
    >
      <p role="status" className="sr-only">
        {loaded
          ? ""
          : stalled
            ? GHL_FORM_FALLBACK + NEW_TAB_NOTE
            : GHL_FORM_LOADING}
      </p>
      <div ref={layer} aria-hidden={showFallback ? undefined : true}>
        <GhlFormLayer loaded={loaded} stalled={stalled} href={fallbackHref} />
      </div>
      {children}
    </div>
  );
}

/**
 * What the layer shows: the form's skeleton while loading, the short
 * fallback panel once stalled. Pure, so each state renders in a test.
 */
export function GhlFormLayer({
  loaded,
  stalled,
  href,
}: {
  loaded: boolean;
  stalled: boolean;
  href: string;
}) {
  const showFallback = stalled && !loaded;
  return (
    <div
      className={cn(
        "transition-opacity duration-300 motion-reduce:transition-none",
        loaded ? "pointer-events-none opacity-0" : "opacity-100",
        // Stalled, the panel sits in flow at the top of the (now unreserved)
        // slot, over the collapsed iframe; it clears the slot's pull-up.
        showFallback
          ? "relative z-20 px-[18px] pt-[33px] pb-2 sm:px-6 sm:pt-[72px]"
          : "absolute inset-0 z-0 px-[18px] pt-[25px] sm:pt-[65px]",
      )}
    >
      {showFallback ? (
        <div data-ghl-fallback="">
          <p className="text-ink text-[17px] font-bold">{GHL_FORM_STALLED}</p>
          <div className="pt-[25px]">
            <FormAction stalled href={href} />
          </div>
        </div>
      ) : (
        <div data-ghl-skeleton="">
          <PhoneSkeleton action={<FormAction stalled={false} href={href} />} />
          <WideSkeleton action={<FormAction stalled={false} href={href} />} />
        </div>
      )}
    </div>
  );
}

/*
 * Both skeletons trace the loaded GHL form at its own offsets (slot pixels):
 * a label bar per field, 42px fields on a 97px pitch, the two-line "first
 * machine" label, a 320px (full-width on phones) submit, then the two consent
 * paragraphs with their checkboxes.
 */

function Field({ twoLineLabel = false }: { twoLineLabel?: boolean }) {
  return (
    <div className="flex flex-col">
      <div className={label} />
      {twoLineLabel ? <div className={`${bar} mt-3.5 h-4 w-24`} /> : null}
      <div className={`${field} mt-[15px]`} />
    </div>
  );
}

/**
 * The submit bar: a spinner while loading, then (stalled) the page's button
 * linking to the form on GHL. One instance per skeleton; only one is shown.
 */
export function FormAction({
  stalled,
  href,
}: {
  stalled: boolean;
  href: string;
}) {
  if (!stalled) return <SubmitBar />;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={buttonClass({ size: "md", className: "w-full px-4" })}
    >
      <span className="text-center leading-tight">{GHL_FORM_FALLBACK}</span>
      <span className="sr-only">{NEW_TAB_NOTE}</span>
    </a>
  );
}

function SubmitBar() {
  return (
    <div className="rounded-control flex h-[42px] w-full items-center justify-center gap-2 bg-[var(--brand-700)]/15 text-sm font-semibold text-[var(--brand-700)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="size-4 motion-safe:animate-spin"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      {GHL_FORM_LOADING}
    </div>
  );
}

/** Below sm: one column of seven labelled fields, then a full-width submit. */
function PhoneSkeleton({ action }: { action: ReactNode }) {
  return (
    <div className="flex flex-col sm:hidden">
      <div className="flex flex-col gap-6">
        {Array.from({ length: 7 }, (_, index) => (
          <Field key={index} twoLineLabel={index === 6} />
        ))}
      </div>
      <div className="mt-9">{action}</div>
      <Consent lines={5} className="mt-6" />
      <Consent lines={7} className="mt-7" />
    </div>
  );
}

/** sm and up: GHL's two-column grid, a half-width field, button, small print. */
function WideSkeleton({ action }: { action: ReactNode }) {
  return (
    <div className="hidden flex-col sm:flex">
      <div className="grid w-full grid-cols-2 gap-x-[26px] gap-y-6">
        {Array.from({ length: 7 }, (_, index) => (
          <Field key={index} twoLineLabel={index === 6} />
        ))}
      </div>
      <div className="mt-[34px] w-[320px] self-center">{action}</div>
      <Consent lines={3} className="mt-6" />
      <Consent lines={4} className="mt-6" />
    </div>
  );
}

/** A consent checkbox and its paragraph of small print. */
function Consent({ lines, className }: { lines: number; className: string }) {
  return (
    <div className={`flex gap-5 ${className}`}>
      <div className="mt-0.5 size-4 shrink-0 rounded-[3px] border-2 border-slate-200" />
      <div className="flex flex-1 flex-col gap-2">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`${bar} h-3 ${index === lines - 1 ? "w-1/2" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}
