import { meetMike } from "@/lib/content";

export function MeetMike() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:gap-20 lg:py-24">
        <div>
          <p className="eyebrow text-accent">{meetMike.eyebrow}</p>
          <h2 className="font-display mt-4 text-3xl leading-tight text-balance sm:text-4xl lg:text-[2.75rem]">
            {meetMike.heading}
          </h2>
          {meetMike.body.map((paragraph) => (
            <p
              key={paragraph.slice(0, 24)}
              className="mt-6 text-lg leading-8 text-ink-muted"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {/* The companies are the proof, so they get the list treatment rather
            than a second photo of the same person. Names only — see the note
            in content.ts. */}
        <div className="lg:pt-2">
          <p className="eyebrow text-ink-subtle">{meetMike.companiesLabel}</p>
          <ol className="mt-4 border-t border-rule">
            {meetMike.companies.map((company, index) => (
              <li
                key={company}
                className="flex items-baseline gap-4 border-b border-rule py-4"
              >
                <span className="eyebrow tabular-nums text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-xl">{company}</span>
              </li>
            ))}
          </ol>

          <dl className="mt-8 grid grid-cols-2 gap-6">
            <div>
              <dd className="font-display text-3xl tabular-nums">150+</dd>
              <dt className="eyebrow mt-1 text-ink-subtle">Machines</dt>
            </div>
            <div>
              <dd className="font-display text-3xl tabular-nums">$200k+</dd>
              <dt className="eyebrow mt-1 text-ink-subtle">Monthly revenue</dt>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
