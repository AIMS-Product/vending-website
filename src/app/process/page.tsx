import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  processIndex,
  processSectionIsHeldBack,
  processSteps,
} from "@/lib/content/process";

export const metadata: Metadata = {
  title: "The Vendingpreneurs Process",
  description: processIndex.intro,
  alternates: { canonical: "/process" },
  ...(processSectionIsHeldBack
    ? { robots: { index: false, follow: true } }
    : {}),
};

export default function ProcessIndexPage() {
  return (
    <section className="bg-white px-5 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-[1500px]">
        <p className="text-brand-700 text-xs font-black tracking-[0.14em] uppercase">
          {processIndex.eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
          {processIndex.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 font-semibold text-slate-700">
          {processIndex.intro}
        </p>

        <ol className="mt-14 grid gap-8 lg:grid-cols-3">
          {processSteps.map((step, index) => (
            <li key={step.slug}>
              <Link
                href={`/process/${step.slug}`}
                className="block h-full rounded-[12px] border-2 border-[#111111] bg-white p-7 shadow-[8px_8px_0_#55b8e8] transition hover:-translate-y-0.5 hover:shadow-[10px_10px_0_#55b8e8] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <p className="text-brand-700 text-xs font-black tracking-[0.14em] uppercase">
                  Step {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 text-xl font-black text-[#111111] uppercase">
                  {step.breadcrumb}
                </h2>
                <p className="mt-3 font-semibold text-slate-700">
                  {step.blurb}
                </p>
              </Link>
            </li>
          ))}
        </ol>

        <div className="mt-14">
          <Button href="/contact">Talk to an operator</Button>
        </div>
      </div>
    </section>
  );
}
