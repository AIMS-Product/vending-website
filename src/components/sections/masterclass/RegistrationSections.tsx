import Image from "next/image";
import { buttonClass } from "@/components/ui/Button";
import { APPLY_QUIZ_ANCHOR } from "@/lib/content/apply-page";
import {
  fitCopy,
  fitFor,
  hostCopy,
  notFitFor,
  operators,
  operatorsCopy,
} from "@/lib/content/masterclass";
import { cn } from "@/lib/utils";
import type { MasterclassEvent } from "@/lib/services/masterclass-event";

type AnthonyStats = NonNullable<MasterclassEvent["anthony"]>;

/** Anthony's live GHL numbers beside his photo. */
export function HostBand({ stats }: { stats: AnthonyStats }) {
  const rows = [
    [hostCopy.statLabels.locations, stats.locations],
    [hostCopy.statLabels.machines, stats.machines],
    [hostCopy.statLabels.revenue, stats.revenue],
  ];
  return (
    <section className="border-ink bg-ink border-y-2 text-white">
      <div className="mx-auto grid max-w-[1180px] items-center gap-8 px-5 py-12 lg:grid-cols-[320px_1fr] lg:px-10">
        <Image
          src="/images/masterclass/anthony-machine.jpg"
          alt={hostCopy.photoAlt}
          width={640}
          height={800}
          className="rounded-card mx-auto aspect-[4/5] w-full max-w-[320px] border-2 border-white object-cover"
        />
        <div>
          <p className="text-xs font-black tracking-[0.14em] text-[#8bd0ff] uppercase">
            {hostCopy.eyebrow}
          </p>
          <p className="mt-3 max-w-[40ch] text-2xl font-black uppercase">
            {hostCopy.line}
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-4">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="text-xs font-black tracking-[0.12em] text-white/60 uppercase">
                  {label}
                </dt>
                <dd className="text-[clamp(1.6rem,4vw,2.6rem)] font-black tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-white/50">{hostCopy.footnote}</p>
        </div>
      </div>
    </section>
  );
}

/** Five members, photo first: the proof reads at a glance instead of in paragraphs. */
export function OperatorGrid() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          {operatorsCopy.eyebrow}
        </p>
        <h2 className="text-ink mt-3 text-[clamp(1.8rem,3.6vw,2.8rem)] font-black uppercase">
          {operatorsCopy.heading}
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {operators.map((op) => (
            <li
              key={op.name}
              className="rounded-card border-ink shadow-card overflow-hidden border-2 bg-white"
            >
              <Image
                src={op.photo}
                alt={op.name}
                width={400}
                height={400}
                className="aspect-square w-full object-cover"
              />
              <div className="p-4">
                <p className="text-ink font-black uppercase">{op.name}</p>
                <p className="text-xs font-semibold text-slate-500">
                  {op.before}
                </p>
                <p className="text-eyebrow mt-3 text-sm font-bold">
                  {op.result}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Who it is for, then one CTA back to the form in the hero. */
export function FitSection() {
  return (
    <section className="border-ink bg-tint border-t-2">
      <div className="mx-auto grid max-w-[1180px] gap-6 px-5 py-16 md:grid-cols-2 lg:px-10">
        <FitCard title={fitCopy.forTitle} items={fitFor} good />
        <FitCard title={fitCopy.notForTitle} items={notFitFor} />
      </div>
      <div className="flex justify-center pb-16">
        <a
          href={`#${APPLY_QUIZ_ANCHOR}`}
          className={buttonClass({ size: "lg" })}
        >
          {fitCopy.cta}
        </a>
      </div>
    </section>
  );
}

function FitCard({
  title,
  items,
  good = false,
}: {
  title: string;
  items: readonly string[];
  good?: boolean;
}) {
  return (
    <div className="rounded-card border-ink shadow-card border-2 bg-white p-6">
      <p className="text-ink text-lg font-black uppercase">{title}</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-3 text-[15px] font-medium text-slate-700"
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-black text-white",
                good ? "bg-brand-700" : "bg-slate-400",
              )}
            >
              {good ? "✓" : "–"}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
