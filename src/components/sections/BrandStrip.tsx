import Image from "next/image";
import { partnerLogos } from "@/lib/content/home";

export function BrandStrip() {
  return (
    <section
      aria-label="Featured partners"
      className="border-brand-100/60 bg-brand-50/40 overflow-hidden border-t py-10"
    >
      <div className="brand-marquee flex w-max items-center gap-16 px-6 lg:px-10">
        {[...partnerLogos, ...partnerLogos].map((logo, index) => (
          <Image
            key={`${logo.name}-${index}`}
            src={logo.src}
            alt={logo.name}
            width={logo.width}
            height={logo.height}
            className="h-10 w-auto shrink-0 opacity-80 brightness-75 contrast-125 grayscale transition hover:opacity-100 hover:brightness-100 hover:grayscale-0"
          />
        ))}
      </div>
    </section>
  );
}
