import type { Metadata } from "next";
import Link from "next/link";
import { solutions, solutionsIndex } from "@/lib/content/solutions";

export const metadata: Metadata = {
  title: "Solutions",
  description: solutionsIndex.intro,
  alternates: { canonical: "/solutions" },
};

export default function SolutionsIndexPage() {
  return (
    <section className="bg-white px-5 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-[1500px]">
        <p className="text-brand-700 text-xs font-black tracking-[0.14em] uppercase">
          {solutionsIndex.eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
          {solutionsIndex.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 font-semibold text-slate-700">
          {solutionsIndex.intro}
        </p>

        <ul className="mt-14 grid gap-8 lg:grid-cols-3">
          {solutions.map((solution) => (
            <li key={solution.slug}>
              <Link
                href={`/solutions/${solution.slug}`}
                className="block h-full rounded-[12px] border-2 border-[#111111] bg-white p-7 shadow-[8px_8px_0_#55b8e8] transition hover:-translate-y-0.5 hover:shadow-[10px_10px_0_#55b8e8] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <p className="text-brand-700 text-xs font-black tracking-[0.14em] uppercase">
                  {solution.eyebrow}
                </p>
                <h2 className="mt-3 text-xl font-black text-[#111111] uppercase">
                  {solution.title}
                </h2>
                <p className="mt-3 font-semibold text-slate-700">
                  {solution.intro}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
