import { reportCopy } from "@/lib/content/masterclass-review-report";

const H2 =
  "v2-display text-ink mt-14 text-[2rem] leading-none text-balance uppercase";
/** Flow lists and tables: bordered, flat. */
const CARD = "rounded-card border-ink border-2 bg-white";
/** The four "How it was tested" stat cards: the only raised boxes here. */
const CARD_RAISED = "rounded-card border-ink shadow-card border-2 bg-white";

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
              <p className="text-ink flex flex-wrap items-center gap-x-2 gap-y-1 font-black">
                <span className="text-balance">{item.step}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-black tracking-wider uppercase ${
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
          <li key={item.label} className={`${CARD_RAISED} p-5`}>
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
      <ul className="mt-5 grid gap-2.5">
        {reportCopy.better.map((line) => (
          <li key={line} className="flex gap-3 py-1 text-[15px] text-slate-700">
            <span aria-hidden className="text-brand-700 font-black">
              +
            </span>
            {line}
          </li>
        ))}
      </ul>

      <h2 className={H2}>{reportCopy.decisionsHeading}</h2>
      <ol className={`${CARD} mt-5`}>
        {reportCopy.decisions.map((decision, index) => (
          <li
            key={typeof decision === "string" ? decision : decision.lead}
            className="flex gap-4 border-b border-slate-200 p-4 text-[15px] text-slate-700 last:border-b-0"
          >
            <span className="border-ink text-ink grid size-7 shrink-0 place-items-center rounded-md border-2 bg-white text-sm font-black tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 pt-[3px] [overflow-wrap:anywhere]">
              {typeof decision === "string" ? (
                decision
              ) : (
                <>
                  <p>{decision.lead}</p>
                  <ul className="mt-2 grid gap-1.5 text-[15px]">
                    {decision.items.map((item) => (
                      <li key={item.name} className="flex gap-2">
                        <span
                          aria-hidden
                          className="text-eyebrow shrink-0 font-black"
                        >
                          &ndash;
                        </span>
                        <span className="min-w-0">
                          <strong className="text-ink">{item.name}:</strong>{" "}
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">{decision.tail}</p>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      <h2 className={H2}>{reportCopy.swapHeading}</h2>
      {/* One flat list with outlined numbers: a plan to read, not the
          action steps (those keep the solid badges). */}
      <ol className="rounded-card border-ink mt-5 border-2 bg-white">
        {reportCopy.swap.map((line, index) => (
          <li
            key={line}
            className="flex gap-4 border-b border-slate-200 p-4 last:border-b-0"
          >
            <span className="border-ink text-ink grid size-7 shrink-0 place-items-center rounded-md border-2 bg-white text-sm font-black tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 pt-[3px] text-[15px] [overflow-wrap:anywhere] text-slate-700">
              {line}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
