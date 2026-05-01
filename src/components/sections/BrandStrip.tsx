import { partnerLogos } from "@/lib/content/home";

export function BrandStrip() {
  return (
    <section
      aria-label="Featured partners"
      className="border-brand-100/60 bg-brand-50/40 border-t py-10"
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-around gap-x-12 gap-y-6 px-6 lg:px-10">
        {partnerLogos.map((logo) => (
          <span
            key={logo.name}
            className="text-base font-semibold tracking-tight text-slate-500 grayscale transition hover:grayscale-0"
          >
            {logo.name}
          </span>
        ))}
      </div>
    </section>
  );
}
