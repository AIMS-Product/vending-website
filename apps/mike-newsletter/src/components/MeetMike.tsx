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

        <div className="lg:pt-2">
          <p className="eyebrow text-ink-subtle">{meetMike.timelineLabel}</p>
          <ol className="mt-4 border-t border-rule">
            {meetMike.timeline.map((item) => (
              <li
                key={item.year}
                className="flex items-baseline gap-4 border-b border-rule py-4"
              >
                <span className="eyebrow tabular-nums text-accent">
                  {item.year}
                </span>
                <span className="leading-7">{item.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
