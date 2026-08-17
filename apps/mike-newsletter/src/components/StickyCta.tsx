"use client";

import { useEffect, useState } from "react";
import { stickyCta } from "@/lib/content";
import { SUBSCRIBED_EVENT } from "@/lib/subscribe-state";

/**
 * A phone-only bar that follows the reader down the page.
 *
 * On a small screen the hero form is the only ask until the very bottom, and
 * everything between the two is a long scroll with no way to act. This keeps
 * the ask one thumb-reach away without covering either real form: it shows
 * once the hero form has left the viewport, hides again whenever a form is on
 * screen, and disappears for good once someone has actually subscribed.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const forms = [
      document.getElementById("subscribe"),
      document.getElementById("closing"),
    ].filter((el): el is HTMLElement => el !== null);

    if (forms.length === 0) return;

    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScreen.add(entry.target);
          else onScreen.delete(entry.target);
        }
        setVisible(onScreen.size === 0);
      },
      // A form counts as "on screen" a little before it truly is, so the bar
      // is already gone by the time the reader looks at the real field.
      { rootMargin: "-64px 0px -96px 0px" },
    );

    for (const form of forms) observer.observe(form);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onSubscribed = () => setDone(true);
    window.addEventListener(SUBSCRIBED_EVENT, onSubscribed);
    return () => window.removeEventListener(SUBSCRIBED_EVENT, onSubscribed);
  }, []);

  const shown = visible && !done;

  return (
    <div
      // aria-hidden while off-screen: the same two forms it points at are
      // already in the tab order, so an extra hidden CTA is only noise.
      aria-hidden={!shown}
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-rule-strong bg-paper-raised/95 backdrop-blur transition-transform duration-200 lg:hidden motion-reduce:transition-none ${
        shown ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <p className="text-[0.8125rem] leading-tight font-medium text-ink-muted">
          {stickyCta.label}
        </p>
        <a
          href="#subscribe"
          tabIndex={shown ? undefined : -1}
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-[0.9375rem] font-semibold text-white transition hover:bg-accent-hover"
        >
          {stickyCta.button}
        </a>
      </div>
    </div>
  );
}
