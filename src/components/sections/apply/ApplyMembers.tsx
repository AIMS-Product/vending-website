import { applyMembers } from "@/lib/content/apply-page";

export function ApplyMembers() {
  return (
    <section className="mx-auto max-w-[1080px] px-5 py-24 lg:px-10">
      <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
        {applyMembers.eyebrow}
      </p>
      <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
        {applyMembers.title}
      </h2>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {applyMembers.members.map((member) => (
          <li
            key={member.name}
            className="flex items-center gap-4 rounded-[12px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#55b8e8]"
          >
            <span className="flex size-13 shrink-0 items-center justify-center rounded-[10px] border-2 border-[#111111] bg-[#fdece0] text-base font-black text-[#e65f1f]">
              {member.initial}
            </span>
            <div>
              <h3 className="text-base font-black text-[#111111]">
                {member.name}
              </h3>
              <p className="mt-0.5 text-sm leading-snug font-semibold text-slate-700">
                {member.result}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
