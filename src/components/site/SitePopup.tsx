"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  POPUPS,
  isFrequencyCapped,
  pickPopup,
  popupFrequencyKey,
  safePopupHref,
  type Popup,
  type PopupCta,
} from "@/lib/content/popups";

/**
 * Structural subset of `window` used by trigger wiring, so triggers are
 * testable in the node vitest environment with a fake window.
 */
export interface TriggerWindow {
  addEventListener(
    type: string,
    listener: (event: MouseEvent) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: MouseEvent) => void,
    options?: EventListenerOptions | boolean,
  ): void;
  document: {
    addEventListener(type: string, listener: (event: MouseEvent) => void): void;
    removeEventListener(
      type: string,
      listener: (event: MouseEvent) => void,
    ): void;
    documentElement: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
    };
  };
}

const IDLE_ACTIVITY_EVENTS = ["pointermove", "keydown", "scroll", "touchstart"];

/** Wires the popup's trigger, calls `fire` when it hits, returns cleanup. */
export function wireTrigger(
  popup: Popup,
  fire: () => void,
  win: TriggerWindow,
): () => void {
  const threshold = popup.triggerThreshold;
  switch (popup.trigger) {
    case "IMMEDIATE": {
      fire();
      return () => {};
    }
    case "TIME_ON_PAGE": {
      const timer = setTimeout(fire, (threshold ?? 5) * 1000);
      return () => clearTimeout(timer);
    }
    case "IDLE_TIME": {
      const delayMs = (threshold ?? 30) * 1000;
      let timer = setTimeout(fire, delayMs);
      const reset = () => {
        clearTimeout(timer);
        timer = setTimeout(fire, delayMs);
      };
      for (const type of IDLE_ACTIVITY_EVENTS)
        win.addEventListener(type, reset, { passive: true });
      return () => {
        clearTimeout(timer);
        for (const type of IDLE_ACTIVITY_EVENTS)
          win.removeEventListener(type, reset);
      };
    }
    case "SCROLL_DEPTH": {
      const onScroll = () => {
        const root = win.document.documentElement;
        const scrollable = root.scrollHeight - root.clientHeight;
        const percent =
          scrollable <= 0 ? 100 : (root.scrollTop / scrollable) * 100;
        if (percent >= (threshold ?? 50)) fire();
      };
      win.addEventListener("scroll", onScroll, { passive: true });
      return () => win.removeEventListener("scroll", onScroll);
    }
    case "EXIT_INTENT": {
      const onMouseOut = (event: MouseEvent) => {
        if (event.clientY <= 0 && !event.relatedTarget) fire();
      };
      win.document.addEventListener("mouseout", onMouseOut);
      return () => win.document.removeEventListener("mouseout", onMouseOut);
    }
  }
}

export function SitePopup() {
  const pathname = usePathname() ?? "/";
  const [visible, setVisible] = useState<Popup | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("vppopup");
    if (mode === "off") return;
    if (mode === "clear") clearShownKeys();
    const preview = mode === "preview";

    const popup = pickPopup(pathname, POPUPS, { preview });
    if (!popup) return;
    if (
      !preview &&
      isFrequencyCapped(popup, (key) => readShown(popup, key), Date.now())
    )
      return;

    let fired = false;
    const show = () => {
      if (fired) return;
      fired = true;
      setVisible(popup);
      if (!preview) markShown(popup);
    };
    if (preview) {
      show();
      return;
    }
    return wireTrigger(popup, show, window);
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(null);
      else if (event.key === "Tab") trapFocus(event, dialogRef.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [visible]);

  if (!visible) return null;
  const close = () => setVisible(null);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <PopupCard popup={visible} onClose={close} dialogRef={dialogRef} />
    </div>
  );
}

/**
 * The one popup card. The admin preview (slice 3) must render this same
 * component — never a second rendering codepath. Every optional field is
 * presence-gated so one card covers every campaign.
 */
export function PopupCard({
  popup,
  onClose,
  dialogRef,
}: {
  popup: Popup;
  onClose: () => void;
  dialogRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`vp-popup-title-${popup.id}`}
      tabIndex={-1}
      className="relative w-full max-w-md overflow-hidden rounded-[8px] border-2 border-[#111111] bg-white shadow-[6px_6px_0_#111111] outline-none motion-safe:animate-[vp-popup-in_200ms_ease-out]"
    >
      {popup.accentColor ? (
        <div
          className="h-1.5"
          style={{
            background: `linear-gradient(90deg, ${popup.accentColor}, #111111)`,
          }}
        />
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#111111] hover:bg-[#f3f4f6] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:outline-none"
      >
        <CloseIcon />
      </button>
      <div className="flex flex-col gap-4 p-6">
        {popup.eyebrow ? (
          <p className="text-xs font-black tracking-wide text-[#066a99] uppercase">
            {popup.eyebrow}
          </p>
        ) : null}
        <h2
          id={`vp-popup-title-${popup.id}`}
          className="pr-8 text-2xl font-black text-[#111111]"
        >
          {popup.headline}
        </h2>
        <p className="text-base text-[#374151]">{popup.body}</p>
        {popup.featuredValue ? (
          <div className="rounded-[8px] border-2 border-[#111111] bg-[#f8fafc] p-4">
            <p className="text-xs font-black tracking-wide text-[#6b7280] uppercase">
              {popup.featuredValue.label}
            </p>
            <p className="text-lg font-black text-[#111111]">
              {popup.featuredValue.value}
            </p>
            {popup.featuredValue.note ? (
              <p className="text-sm text-[#374151]">
                {popup.featuredValue.note}
              </p>
            ) : null}
          </div>
        ) : null}
        {popup.offerCode ? (
          <p className="rounded-[8px] border-2 border-dashed border-[#111111] px-4 py-2 text-center font-mono text-sm font-bold text-[#111111]">
            {popup.offerCode}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <CtaLink
            cta={popup.primaryCta}
            primary
            accentColor={popup.accentColor}
            onNavigate={onClose}
          />
          {popup.secondaryCta ? (
            <CtaLink cta={popup.secondaryCta} onNavigate={onClose} />
          ) : null}
        </div>
        {popup.dismissText ? (
          <button
            type="button"
            onClick={onClose}
            className="self-center text-sm text-[#6b7280] underline underline-offset-2 hover:text-[#111111] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:outline-none"
          >
            {popup.dismissText}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const PRIMARY_CTA_CLASSES =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border-2 border-[#111111] bg-[#f47b3b] px-6 text-sm font-black text-[#111111] uppercase shadow-[4px_4px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_CTA_CLASSES =
  "inline-flex min-h-12 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-white px-6 text-sm font-black text-[#111111] uppercase focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none";

function CtaLink({
  cta,
  primary = false,
  accentColor = null,
  onNavigate,
}: {
  cta: PopupCta;
  primary?: boolean;
  accentColor?: string | null;
  onNavigate: () => void;
}) {
  const href = safePopupHref(cta.href);
  if (!href) return null;
  const className = primary ? PRIMARY_CTA_CLASSES : SECONDARY_CTA_CLASSES;
  const style: CSSProperties | undefined =
    primary && accentColor ? { backgroundColor: accentColor } : undefined;
  const children = (
    <>
      {cta.label}
      {primary ? <ArrowIcon /> : null}
    </>
  );
  return href.startsWith("/") ? (
    <Link href={href} className={className} style={style} onClick={onNavigate}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} style={style} onClick={onNavigate}>
      {children}
    </a>
  );
}

function trapFocus(event: KeyboardEvent, dialog: HTMLElement | null) {
  if (!dialog) return;
  const focusables = dialog.querySelectorAll<HTMLElement>(
    'a[href], button, [tabindex]:not([tabindex="-1"])',
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function storageFor(popup: Popup): Storage | null {
  try {
    return popup.frequency === "session"
      ? window.sessionStorage
      : window.localStorage;
  } catch {
    return null;
  }
}

function readShown(popup: Popup, key: string): string | null {
  try {
    return storageFor(popup)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function markShown(popup: Popup) {
  try {
    storageFor(popup)?.setItem(
      popupFrequencyKey(popup.id),
      popup.frequency === "once_per_day" ? String(Date.now()) : "1",
    );
  } catch {
    // Storage unavailable (private mode) — popup just shows again next time.
  }
}

function clearShownKeys() {
  for (const popup of POPUPS) {
    try {
      const key = popupFrequencyKey(popup.id);
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
