import { Button } from "@/components/ui/Button";
import { accelerator } from "@/lib/content/home";

export function AcceleratorProgram() {
  return (
    <section className="border-t border-slate-100 px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <h2 className="text-brand-500 text-4xl font-semibold tracking-tight sm:text-5xl">
            {accelerator.title}
          </h2>
          <p className="mt-6 max-w-md text-slate-600">{accelerator.body}</p>

          <dl className="mt-10 max-w-md divide-y divide-slate-100">
            {accelerator.stats.map((stat) => (
              <div
                key={stat.label}
                className="grid grid-cols-[auto_1fr] items-baseline gap-6 py-5"
              >
                <dt className="text-brand-500 text-3xl font-bold sm:text-4xl">
                  {stat.value}
                </dt>
                <dd className="text-brand-600 text-sm">{stat.label}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8">
            <Button href={accelerator.cta.href}>{accelerator.cta.label}</Button>
          </div>
        </div>

        <div className="bg-brand-50/70 rounded-3xl p-8 lg:p-10">
          <ul className="space-y-5">
            {accelerator.points.map((point) => (
              <li key={point} className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="text-brand-500 ring-brand-100 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white ring-1"
                >
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                    <path
                      d="M3 8.5l3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-slate-700">{point}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-slate-700">
            <strong className="text-brand-600">
              {accelerator.bonus.label}
            </strong>{" "}
            {accelerator.bonus.body}
          </p>

          <AcceleratorImagePlaceholder />
        </div>
      </div>
    </section>
  );
}

/** Slice 1b will swap in the live image of an entrepreneur with a kiosk. */
function AcceleratorImagePlaceholder() {
  return (
    <div
      aria-hidden
      className="from-brand-200 via-brand-300 to-brand-400 mt-8 aspect-[16/10] w-full overflow-hidden rounded-2xl bg-gradient-to-br shadow"
    >
      <div className="flex h-full items-end p-6">
        <p className="text-brand-700 rounded-lg bg-white/70 p-3 text-xs backdrop-blur">
          Image placeholder — swap to live asset in Slice 1b.
        </p>
      </div>
    </div>
  );
}
