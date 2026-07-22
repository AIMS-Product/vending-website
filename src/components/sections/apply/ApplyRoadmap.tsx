import { applyRoadmap } from "@/lib/content/apply-page";
import { ApplyCtaButton } from "./ApplyCtaButton";

export function ApplyRoadmap() {
  return (
    <section
      className="border-y-2 border-[#111111] bg-[#eaf6ff]"
      style={{
        backgroundImage:
          "radial-gradient(rgba(42,143,204,0.16) 1.4px, transparent 1.4px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="mx-auto max-w-[1080px] px-5 py-24 lg:px-10">
        <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          {applyRoadmap.eyebrow}
        </p>
        <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
          {applyRoadmap.title}
        </h2>
        <p className="mx-auto mt-5 max-w-[64ch] text-center text-lg leading-relaxed font-semibold text-slate-700">
          {applyRoadmap.body}
        </p>

        <ol className="mt-13 flex flex-col gap-5">
          {applyRoadmap.phases.map((phase) => (
            <li
              key={phase.num}
              className="flex items-start gap-6 rounded-[12px] border-2 border-[#111111] bg-white p-7 shadow-[6px_6px_0_#111111]"
            >
              <span
                className="shrink-0 text-4xl leading-none font-black text-transparent"
                style={{ WebkitTextStroke: "1.6px #2a8fcc" }}
                aria-hidden
              >
                {phase.num}
              </span>
              <div>
                <h3 className="text-lg font-black text-[#111111]">
                  {phase.range}
                </h3>
                <p className="mt-0.5 text-base font-black text-[#f47b3b]">
                  {phase.title}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed font-semibold text-slate-700">
                  {phase.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex justify-center">
          <ApplyCtaButton>{applyRoadmap.ctaLabel}</ApplyCtaButton>
        </div>
      </div>
    </section>
  );
}
