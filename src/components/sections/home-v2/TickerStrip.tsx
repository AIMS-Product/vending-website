import { tickerV2 } from "@/lib/content/home-v2";

/**
 * Ink-black text marquee. The moving copy is decorative (aria-hidden,
 * duplicated for the seamless loop) — screen readers get the static
 * summary, reduced-motion users get a stopped strip, and hover pauses it.
 */
export function TickerStrip() {
  const row = Array.from({ length: 4 }, () => tickerV2.items).flat();

  return (
    <section
      aria-label="Vendingpreneurs highlights"
      className="overflow-hidden border-y-2 border-[#111111] bg-[#111111] py-5"
    >
      <p className="sr-only">{tickerV2.srSummary}</p>
      <div
        aria-hidden
        className="v2-marquee flex w-max items-center gap-10 hover:[animation-play-state:paused]"
      >
        {row.map((item, index) => (
          <span key={index} className="flex items-center gap-10">
            <span className="v2-display text-2xl tracking-wide whitespace-nowrap text-white uppercase lg:text-3xl">
              {item}
            </span>
            <Star />
          </span>
        ))}
      </div>
    </section>
  );
}

function Star() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-5 shrink-0 text-[#f47b3b]"
      aria-hidden
    >
      <path d="M10 1.5l2.7 5.5 6 0.9-4.3 4.3 1 6-5.4-2.9-5.4 2.9 1-6L1.3 7.9l6-0.9z" />
    </svg>
  );
}
