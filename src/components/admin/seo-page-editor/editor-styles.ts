import type { SeoReadinessStatus } from "@/lib/page-builder/seo-readiness";

export function labelForReadinessStatus(status: SeoReadinessStatus) {
  if (status === "blocked") return "Blocked";
  if (status === "needs_work") return "Needs work";
  if (status === "opportunities") return "Review";
  return "Strong";
}

export function readinessPillClass(status: SeoReadinessStatus) {
  if (status === "blocked") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (status === "needs_work") {
    return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  }
  if (status === "opportunities") {
    return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  }
  return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
}

export function readinessButtonClass(status: SeoReadinessStatus) {
  if (status === "blocked")
    return "border-red-200 bg-white text-red-700 hover:bg-red-50 ring-1 ring-inset ring-red-100";
  if (status === "needs_work") {
    return "border-amber-200 bg-white text-amber-700 hover:bg-amber-50 ring-1 ring-inset ring-amber-100";
  }
  if (status === "opportunities") {
    return "border-sky-200 bg-white text-sky-700 hover:bg-sky-50 ring-1 ring-inset ring-sky-100";
  }
  return "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 ring-1 ring-inset ring-emerald-100";
}

export function floatingRailButtonClass(status: SeoReadinessStatus) {
  const base =
    "inline-flex size-10 items-center justify-center rounded-full border bg-white shadow-lg transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none";

  if (status === "blocked") {
    return `${base} border-red-300 text-red-700 ring-4 ring-red-100 shadow-red-200/80`;
  }
  if (status === "needs_work") {
    return `${base} border-amber-300 text-amber-700 ring-4 ring-amber-100 shadow-amber-200/80`;
  }
  if (status === "opportunities") {
    return `${base} border-sky-300 text-sky-700 ring-4 ring-sky-100 shadow-sky-200/80`;
  }
  return `${base} border-emerald-300 text-emerald-700 ring-4 ring-emerald-100 shadow-emerald-200/80`;
}

export function readinessCategoryClass(status: SeoReadinessStatus) {
  if (status === "blocked") return "border-l-4 border-l-red-500";
  if (status === "needs_work") return "border-l-4 border-l-amber-500";
  if (status === "opportunities") return "border-l-4 border-l-sky-500";
  return "border-l-4 border-l-emerald-500";
}

export function findingDotClass(
  severity: "blocker" | "warning" | "opportunity",
) {
  if (severity === "blocker") return "bg-red-500";
  if (severity === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

export const leadInputClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-base leading-7 text-slate-600 outline-none transition placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10";

export const eyebrowInputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-bold tracking-wider text-indigo-600 uppercase outline-none transition-all placeholder:text-indigo-300 hover:bg-indigo-50/50 focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-100";

export const heroHeadingInputClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-3xl font-bold tracking-tight text-slate-900 outline-none transition-all placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10 md:text-4xl";

export const sectionHeadingInputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-2xl font-bold tracking-tight text-slate-900 outline-none transition-all placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10 md:text-3xl";

export const bodyTextareaClass =
  "w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-base leading-8 text-slate-600 outline-none transition-all placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:border-[#0b63f6]/30 focus:ring-4 focus:ring-[#0b63f6]/10";

export const disabledLeadFieldClass =
  "rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-400 shadow-sm";

export const compactInputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-all outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0b63f6] focus:ring-4 focus:ring-[#0b63f6]/10";

export const textareaClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 shadow-sm transition-all outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0b63f6] focus:ring-4 focus:ring-[#0b63f6]/10";

export const primaryButtonClass =
  "rounded-lg bg-[#0b63f6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0756d6] hover:shadow focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const smallButtonClass =
  "inline-flex max-w-full items-center justify-center rounded-lg bg-white px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition-all hover:bg-slate-50 hover:ring-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const miniButtonClass =
  "rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 transition-all hover:bg-slate-50 hover:ring-slate-400 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const menuButtonClass =
  "w-full rounded-lg bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none";

export const dangerButtonClass =
  "w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 hover:text-red-700 focus-visible:ring-4 focus-visible:ring-red-100 focus-visible:outline-none text-left";

export const iconButtonClass =
  "inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-4 focus-visible:ring-slate-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
