"use client";

import { useEffect, useState } from "react";
import { CheckoutLink } from "@/components/sections/playbook/CheckoutLink";
import { stickyBuy } from "@/lib/content/playbook";

/** Below this scroll depth the hero's own buy button is still on screen. */
const HERO_BUY_CLEARS_AT = 900;
/** The last stretch of the page holds the final offer and its own button. */
const FINAL_OFFER_ZONE = 1400;

/**
 * A bottom buy bar for the long /playbook page: in once the hero's buy button
 * has scrolled away, out again near the end where the final offer has its
 * own button. Same checkout link and checkout_clicked event (placement
 * "sticky") as every other buy button.
 */
export function PlaybookStickyBuy({ href }: { href: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const fromBottom =
        document.body.offsetHeight - (window.innerHeight + window.scrollY);
      setVisible(
        window.scrollY > HERO_BUY_CLEARS_AT && fromBottom > FINAL_OFFER_ZONE,
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={`border-ink fixed inset-x-0 bottom-0 z-40 border-t-2 bg-white shadow-[0_-6px_20px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3 lg:px-10">
        <span className="text-ink text-[15px] font-black max-sm:hidden">
          {stickyBuy.text}
        </span>
        <CheckoutLink
          href={href}
          placement="sticky"
          className="w-full sm:w-auto"
        >
          {stickyBuy.cta}
        </CheckoutLink>
      </div>
    </div>
  );
}
