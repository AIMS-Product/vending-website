import Image from "next/image";
import { benefits, type Benefit } from "@/lib/content/home";

export function Benefits() {
  return (
    <section className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] items-stretch gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl shadow-lg lg:aspect-auto lg:h-full">
          <Image
            src={benefits.image.src}
            alt={benefits.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        <div className="flex h-full flex-col justify-center">
          <h2 className="text-brand-500 text-4xl font-semibold tracking-tight sm:text-5xl">
            {benefits.title}
          </h2>
          <p className="mt-6 max-w-md text-slate-600">{benefits.body}</p>

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
        className="bg-brand-50 text-brand-500 flex size-12 shrink-0 items-center justify-center rounded-2xl"
      >
        <BenefitIcon icon={item.icon} />
      </div>
      <div>
        <h3 className="text-brand-600 text-lg font-semibold">{item.title}</h3>
        <p className="mt-1 text-slate-600">{item.body}</p>
      </div>
    </li>
  );
}

function BenefitIcon({ icon }: { icon: Benefit["icon"] }) {
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
