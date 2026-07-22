import { applyTools } from "@/lib/content/apply-page";
import { ApplyCtaButton } from "./ApplyCtaButton";
import { ToolIcon } from "./icons";

export function ApplyTools() {
  return (
    <section className="border-y-2 border-[#111111] bg-white">
      <div className="mx-auto max-w-[1180px] px-5 py-24 lg:px-10">
        <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          {applyTools.eyebrow}
        </p>
        <h2 className="mx-auto mt-4 max-w-[20ch] text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
          {applyTools.title}
        </h2>
        <p className="mx-auto mt-5 max-w-[66ch] text-center text-lg leading-relaxed font-semibold text-slate-700">
          {applyTools.body}
        </p>

        <ul className="mt-13 grid gap-6 sm:grid-cols-2">
          {applyTools.items.map((tool) => (
            <li
              key={tool.title}
              className="flex gap-5 rounded-[12px] border-2 border-[#111111] bg-[#eaf8ff] p-7 shadow-[6px_6px_0_#55b8e8]"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-white text-[#066a99]">
                <ToolIcon icon={tool.icon} className="size-6" />
              </span>
              <div>
                <h3 className="text-base font-black tracking-wide text-[#111111] uppercase">
                  {tool.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed font-semibold text-slate-700">
                  {tool.body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex justify-center">
          <ApplyCtaButton>{applyTools.ctaLabel}</ApplyCtaButton>
        </div>
      </div>
    </section>
  );
}
