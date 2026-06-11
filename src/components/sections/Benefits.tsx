import Image from "next/image";
import { benefits, type Benefit } from "@/lib/content/home";

export function Benefits() {
  return (
    <section className="bg-white px-5 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-[1500px] items-stretch gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="relative aspect-square w-full overflow-hidden rounded-[12px] border-2 border-[#111111] shadow-[10px_10px_0_#55b8e8] lg:aspect-auto lg:h-full">
          <Image
            src={benefits.image.src}
            alt={benefits.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            loading="eager"
            className="object-cover"
          />
        </div>

        <div className="flex h-full flex-col justify-center">
          <h2 className="text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
            {benefits.title}
          </h2>
          <p className="mt-6 max-w-md text-lg leading-8 font-semibold text-slate-700">
            {benefits.body}
          </p>

          <ul className="mt-10 space-y-8">
            {benefits.items.map((item) => (
              <BenefitRow key={item.title} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function BenefitRow({ item }: { item: Benefit }) {
  return (
    <li className="flex gap-5">
      <div
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-[#eaf8ff] text-[#111111] shadow-[4px_4px_0_#55b8e8]"
      >
        <BenefitIcon icon={item.icon} />
      </div>
      <div>
        <h3 className="text-lg font-black text-[#111111] uppercase">
          {item.title}
        </h3>
        <p className="mt-2 font-semibold text-slate-700">{item.body}</p>
      </div>
    </li>
  );
}

export function BenefitIcon({ icon }: { icon: Benefit["icon"] }) {
  switch (icon) {
    case "trend":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-6">
          <path
            d="M4 17l5-5 4 4 7-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 7h6v6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "people":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-6">
          <circle
            cx="9"
            cy="9"
            r="3.25"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="17"
            cy="10"
            r="2.5"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M3 19c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5M14 17c2.8 0 5 1.5 5 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "percent":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-6">
          <path
            d="M5 19L19 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="7.5"
            cy="7.5"
            r="2.25"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="16.5"
            cy="16.5"
            r="2.25"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-6">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path
            d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
