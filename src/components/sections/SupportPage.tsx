type SupportPageProps = {
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
};

export function SupportPage({ eyebrow, title, body, items }: SupportPageProps) {
  return (
    <section className="relative isolate overflow-hidden bg-[#f5fbff] px-5 pt-28 pb-20 lg:px-10 lg:pt-32 lg:pb-28">
      <div className="mx-auto max-w-3xl">
        <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
          {eyebrow}
        </p>
        <h1 className="mt-8 text-[clamp(3rem,6vw,5.5rem)] leading-[0.95] font-black text-[#111111] uppercase">
          {title}
        </h1>
        <p className="mt-7 text-xl leading-8 font-semibold text-slate-700">
          {body}
        </p>
        <ul className="mt-10 grid gap-4">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-[8px] border-2 border-[#111111] bg-white px-5 py-4 font-semibold text-slate-700 shadow-[5px_5px_0_#55b8e8]"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
