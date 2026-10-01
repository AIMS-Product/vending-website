"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const GHL_FORM_LOADING = "Loading your application…";
const GHL_FORM_FALLBACK = "Open the application";
const NEW_TAB_NOTE = " (opens in a new tab)";

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

/** Grey label / field / text bars; the submit bar carries the button blue. */
const bar = "rounded-control bg-slate-100";
const label = `${bar} h-4 w-40 self-start`;
const field = `${bar} h-[42px] w-full`;

/**
 * Sits under the GHL iframe (z-0 under its z-10) and fills the slot's
 * reserved height with the loaded form's shape, so the card is never a blank
 * screen while form_embed.js loads (2-12s). It stays until the iframe has
 * fired `load` AND form_embed.js has revealed it, then fades; a white form
 * covers it either way, so a missed event only leaves it hidden underneath.
 *
 * If form_embed.js or the iframe is blocked (ad blockers, strict networks),
 * neither ever happens. After GHL_FORM_STALL_MS the spinner label becomes a
 * link to the same form on GHL (same UTM params) and the layer rises over the
 * iframe so the link can be clicked; a late load still fades it away.
 */
export function GhlFormLoading({
  iframeId,
  fallbackHref,
}: {
  iframeId: string;
  /** The form's own URL, opened in a new tab if the embed never loads. */
  fallbackHref: string;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (loaded) return;
    return watchForStall(() => setStalled(true));
  }, [loaded]);

  useEffect(() => {
    const slot = layer.current?.parentElement;
    if (!slot) return;
    let poll: ReturnType<typeof setInterval> | undefined;
    let frame: HTMLIFrameElement | null = null;

    const shown = (el: HTMLElement) => {
      const style = getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        el.offsetHeight > 0
      );
    };
    // form_embed.js hides the iframe until it has sized it, which can be a
    // beat after `load`; wait for the reveal so the slot never shows blank.
    const onLoad = () => {
      poll = setInterval(() => {
        if (frame && shown(frame)) {
          clearInterval(poll);
          setLoaded(true);
        }
      }, 150);
    };
    const attach = () => {
      const found = document.getElementById(iframeId);
      if (!(found instanceof HTMLIFrameElement) || found === frame) return;
      frame = found;
      frame.addEventListener("load", onLoad, { once: true });
    };

    // The iframe mounts later (within 200px of the viewport).
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(slot, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearInterval(poll);
      frame?.removeEventListener("load", onLoad);
    };
  }, [iframeId]);

  return (
    <>
      <p role="status" className="sr-only">
        {loaded
          ? ""
          : stalled
            ? GHL_FORM_FALLBACK + NEW_TAB_NOTE
            : GHL_FORM_LOADING}
      </p>
      <div
        ref={layer}
        aria-hidden={stalled && !loaded ? undefined : true}
        className={cn(
          "absolute inset-0 px-[18px] pt-[25px] transition-opacity duration-300 motion-reduce:transition-none sm:pt-[65px]",
          loaded ? "pointer-events-none opacity-0" : "opacity-100",
          stalled && !loaded ? "z-20" : "z-0",
        )}
      >
        <PhoneSkeleton
          action={<FormAction stalled={stalled} href={fallbackHref} />}
        />
        <WideSkeleton
          action={<FormAction stalled={stalled} href={fallbackHref} />}
        />
      </div>
    </>
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
