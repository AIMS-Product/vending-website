type SupportPageProps = {
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
};

export function SupportPage({ eyebrow, title, body, items }: SupportPageProps) {
  return (
    <section className="relative isolate overflow-hidden px-6 pt-32 pb-20 lg:px-10 lg:pt-40 lg:pb-28">
      <div className="absolute inset-0 -z-10 [background:var(--gradient-soft)]" />
      <div className="mx-auto max-w-3xl">
        <p className="text-brand-600 text-sm font-semibold tracking-[0.08em] uppercase">
          {eyebrow}
        </p>
        <h1 className="text-brand-500 mt-4 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">{body}</p>
        <ul className="mt-10 grid gap-4">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-slate-100 bg-white px-5 py-4 text-slate-700 shadow-sm"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
