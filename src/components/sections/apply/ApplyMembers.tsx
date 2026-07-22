import Image from "next/image";
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
        {applyMembers.members.map((member) =>
          member.image ? (
            <li
              key={member.name}
              className="flex items-center gap-4 rounded-[12px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#55b8e8]"
            >
              <Image
                src={member.image}
                alt={member.name}
                width={52}
                height={52}
                className="size-13 shrink-0 rounded-[10px] border-2 border-[#111111] object-cover"
              />
              <div>
                <h3 className="text-base font-black text-[#111111]">
                  {member.name}
                </h3>
                <p className="mt-0.5 text-sm leading-snug font-semibold text-slate-700">
                  {member.result}
                </p>
              </div>
            </li>
          ) : (
            // No headshot yet — name-forward layout, no avatar placeholder.
            <li
              key={member.name}
              className="flex flex-col justify-center gap-1 rounded-[12px] border-2 border-[#111111] bg-white p-5 shadow-[5px_5px_0_#55b8e8]"
            >
              <h3 className="text-base font-black tracking-wide text-[#111111] uppercase">
                {member.name}
              </h3>
              <p className="text-sm leading-snug font-semibold text-slate-700">
                {member.result}
              </p>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
