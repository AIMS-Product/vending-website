import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { applyFooter } from "@/lib/content/apply-page";

// Dark disclaimer band that carries the verbatim compliance disclaimer from the
// mockup. It sits above the site's global footer (which owns nav + the logo).
// The dark-on-transparent logo asset isn't delivered yet, so this checks for
// the light/transparent variant at build time and falls back to the text
// wordmark (never the dark PNG, which would be invisible here) until it lands.
const hasLightLogo = existsSync(
  join(process.cwd(), "public", applyFooter.lightLogo),
);

export function ApplyDisclaimer() {
  return (
    <section className="border-t-2 border-[#111111] bg-[#111111]">
      <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-4 px-5 py-11 text-center lg:px-10">
        {hasLightLogo ? (
          <Image
            src={applyFooter.lightLogo}
            alt="Vendingpreneurs"
            width={180}
            height={32}
            className="h-8 w-auto"
          />
        ) : (
          <p className="text-lg font-black tracking-wide text-white uppercase">
            Vendingpreneurs
          </p>
        )}
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
