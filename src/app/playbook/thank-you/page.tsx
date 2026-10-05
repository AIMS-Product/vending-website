import type { Metadata } from "next";
import Image from "next/image";
import "../../home-v2.css";
import { anton } from "../../fonts";
import { Wordmark } from "@/components/site/Wordmark";
import { Button } from "@/components/ui/Button";
import { EYEBROW } from "@/components/sections/playbook/PlaybookCta";
import { PlaybookThankYouBreakout } from "@/components/sections/playbook/PlaybookThankYou";
import { PLAYBOOK_ACCESS_URL, images, thankYou } from "@/lib/content/playbook";

export const metadata: Metadata = {
  title: "You're in · Mike Hoffmann's Vending Playbook",
  robots: { index: false, follow: false },
};

export default function PlaybookThankYouPage() {
  return (
    <div className={`${anton.variable} bg-brand-50 min-h-screen`}>
      <PlaybookThankYouBreakout />
      <header className="border-ink border-b-2 bg-white">
        <div className="mx-auto max-w-[1240px] px-5 py-4 lg:px-10">
          <Wordmark height={36} eager />
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-5 py-12 text-center lg:py-16">
        <p className={EYEBROW}>{thankYou.eyebrow}</p>
        <h1 className="v2-display text-ink mt-3 text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] uppercase">
          {thankYou.title}
        </h1>
        <p className="text-ink/80 mx-auto mt-4 max-w-xl text-lg leading-snug">
          {thankYou.body}
        </p>
        <Button href={PLAYBOOK_ACCESS_URL} size="lg" showArrow className="mt-8">
          {thankYou.cta}
        </Button>
        <Image
          src={images.productTrimmed.src}
          alt={images.productTrimmed.alt}
          width={images.productTrimmed.width}
          height={images.productTrimmed.height}
          sizes="(min-width:768px) 680px, 100vw"
          className="mx-auto mt-10 h-auto w-full max-w-[680px]"
        />
      </main>
    </div>
  );
}
