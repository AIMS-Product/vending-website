import { reportCopy } from "@/lib/content/masterclass-review-report";

const H2 =
  "v2-display text-ink mt-14 text-[2rem] leading-none text-balance uppercase";
const CARD = "rounded-card border-ink shadow-card border-2 bg-white";

/** The briefing half of /masterclass-review: journey, testing, decisions, swap plan. */
export function ReviewReport() {
  return (
    <>
      <h2 className={H2}>{reportCopy.journeyHeading}</h2>
      <p className="mt-3 text-[15px] text-slate-600">
        {reportCopy.journeyIntro}
      </p>
      <ol className={`${CARD} mt-5`}>
        {reportCopy.journey.map((item, index) => (
          <li
            key={item.step}
            className="flex gap-4 border-b border-slate-200 p-4 last:border-b-0"
          >
            {/* Outlined: a system flow to read, not steps to do. */}
            <span className="border-ink text-ink grid size-7 shrink-0 place-items-center rounded-md border-2 bg-white text-sm font-black tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-ink font-black">
                {item.step}
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 align-middle text-[11px] font-black tracking-wider uppercase ${
                    item.who === "GHL"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-tint text-eyebrow"
                  }`}
                >
                  {item.who === "GHL" ? "GoHighLevel" : "Our site"}
                </span>
              </p>
              <p className="mt-0.5 text-sm text-slate-600">{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className={H2}>{reportCopy.testedHeading}</h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {reportCopy.tested.map((item) => (
          <li key={item.label} className={`${CARD} p-5`}>
            <p className="v2-display text-brand-700 text-4xl leading-none">
              {item.figure}
            </p>
            <p className="text-ink mt-1 font-black uppercase">{item.label}</p>
            <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
          </li>
        ))}
      </ul>

      <h3 className="text-ink mt-8 text-lg font-black uppercase">
        {reportCopy.timingsHeading}
      </h3>
      <dl className={`${CARD} mt-3 grid sm:grid-cols-2`}>
        {reportCopy.timings.map((row) => (
          <div
            key={row.system}
            className="flex items-baseline justify-between gap-4 border-b border-slate-200 px-4 py-3"
          >
            <dt className="text-sm text-slate-700">{row.system}</dt>
            <dd className="text-ink text-sm font-black whitespace-nowrap">
              {row.time}
            </dd>
          </div>
        ))}
      </dl>

      <h2 className={H2}>{reportCopy.betterHeading}</h2>
      <ul className="mt-5 grid gap-3">
        {reportCopy.better.map((line) => (
          <li
            key={line}
            className="bg-tint rounded-card flex gap-3 p-4 text-[15px] text-slate-700"
          >
            <span aria-hidden className="text-brand-700 font-black">
              +
            </span>
            {line}
          </li>
        ))}
      </ul>

      <h2 className={H2}>{reportCopy.decisionsHeading}</h2>
      <ol className={`${CARD} mt-5`}>
        {reportCopy.decisions.map((line, index) => (
          <li
            key={line}
            className="flex gap-3 border-b border-slate-200 p-4 text-[15px] text-slate-700 last:border-b-0"
          >
            <span className="text-eyebrow w-5 shrink-0 font-black">
              {index + 1}
            </span>
            {line}
          </li>
        ))}
      </ol>

      <h2 className={H2}>{reportCopy.swapHeading}</h2>
      <ol className="mt-5 grid gap-3">
        {reportCopy.swap.map((line, index) => (
          <li key={line} className={`${CARD} flex items-center gap-4 p-4`}>
            <span className="bg-brand-700 grid size-8 shrink-0 place-items-center rounded-md text-sm font-black text-white">
              {index + 1}
            </span>
            <span className="min-w-0 text-[15px] [overflow-wrap:anywhere] text-slate-700">
              {line}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
