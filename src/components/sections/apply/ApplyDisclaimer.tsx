import Link from "next/link";
import { applyFooter } from "@/lib/content/apply-page";

// Dark disclaimer band that carries the verbatim compliance disclaimer from the
// mockup. It sits above the site's global footer (which owns nav + the logo),
// so this band renders the wordmark as text rather than the dark PNG asset,
// which would be invisible on the dark surface.
export function ApplyDisclaimer() {
  return (
    <section className="border-t-2 border-[#111111] bg-[#111111]">
      <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-4 px-5 py-11 text-center lg:px-10">
        <p className="text-lg font-black tracking-wide text-white uppercase">
          Vendingpreneurs
        </p>
        <p className="max-w-[70ch] text-[13px] leading-relaxed font-medium text-white/50">
          {applyFooter.disclaimer}
        </p>
        <p className="text-[13px] font-medium text-white/50">
          By applying you agree to our{" "}
          <Link
            href="/privacy"
            className="text-[#8bd0ff] underline underline-offset-2 hover:text-white"
          >
            Privacy Policy
          </Link>
          . We never sell your data.
        </p>
      </div>
    </section>
  );
}
