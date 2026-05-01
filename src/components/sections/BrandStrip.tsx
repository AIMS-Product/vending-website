import Image from "next/image";
import { partnerLogos } from "@/lib/content/home";

export function BrandStrip() {
  return (
    <section
      aria-label="Featured partners"
      className="border-brand-100/60 bg-brand-50/40 border-t py-10"
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-around gap-x-12 gap-y-8 px-6 lg:px-10">
        {partnerLogos.map((logo) => (
          <Image
            key={logo.name}
            src={logo.src}
            alt={logo.name}
            width={logo.width}
            height={logo.height}
            className="h-10 w-auto opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"
          />
        ))}
      </div>
    </section>
  );
}
