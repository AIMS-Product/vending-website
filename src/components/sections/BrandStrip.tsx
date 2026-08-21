import Image from "next/image";
import { partnerLogos, partnerStrip } from "@/lib/content/home";

export function BrandStrip() {
  return (
    <section
      aria-label="Featured partners"
      className="overflow-hidden border-y-2 border-[#111111] bg-[#eaf8ff] py-12"
    >
      <p className="px-5 text-center text-sm font-black tracking-wide text-[#111111] uppercase lg:px-10">
        {partnerStrip.title}
      </p>
      <div className="brand-marquee mt-8 flex w-max items-center gap-20 px-5 lg:px-10">
        {[...partnerLogos, ...partnerLogos].map((logo, index) => (
          <Image
            key={`${logo.name}-${index}`}
            src={logo.src}
            alt={logo.name}
            width={logo.width}
            height={logo.height}
            className="h-14 w-auto shrink-0 opacity-90 brightness-75 contrast-125 grayscale transition hover:opacity-100 hover:brightness-100 hover:grayscale-0"
          />
        ))}
      </div>
    </section>
  );
}
