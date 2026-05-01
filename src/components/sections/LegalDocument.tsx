import type {
  LegalBlock,
  LegalDoc,
  LegalListItem,
  LegalSection,
} from "@/lib/content/legal";

type LegalDocumentProps = {
  doc: LegalDoc;
};

export function LegalDocument({ doc }: LegalDocumentProps) {
  return (
    <article className="mx-auto max-w-[820px] px-6 pt-32 pb-20 lg:pt-40 lg:pb-24">
      <header className="border-b border-slate-100 pb-10">
        <h1 className="text-brand-500 text-4xl font-semibold tracking-tight sm:text-5xl">
          {doc.title}
        </h1>
        <p className="mt-4 text-sm text-slate-500">
          <strong className="text-brand-600 font-semibold">
            Last Updated:
          </strong>{" "}
          {doc.lastUpdated}
        </p>
      </header>

      <div className="mt-12 space-y-12">
        {doc.sections.map((section) => (
          <LegalSectionView key={section.number} section={section} />
        ))}
      </div>
    </article>
  );
}

function LegalSectionView({ section }: { section: LegalSection }) {
  return (
    <section>
      <h2 className="text-brand-600 text-2xl font-semibold tracking-tight sm:text-3xl">
        {section.number}. {section.heading}
      </h2>
      <div className="mt-5 space-y-4 leading-relaxed text-slate-700">
        {section.blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
      </div>
    </section>
  );
}

function BlockView({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <p>{block.text}</p>;
    case "p-strong":
      return <p className="text-brand-600 font-semibold">{block.text}</p>;
    case "h3":
      return (
        <h3 className="text-brand-500 mt-6 text-base font-semibold">
          {block.text}
        </h3>
      );
    case "ul":
      return (
        <ul className="marker:text-brand-400 ml-5 list-disc space-y-2">
          {block.items.map((item, i) => (
            <ListItemView key={i} item={item} />
          ))}
        </ul>
      );
  }
}

function ListItemView({ item }: { item: LegalListItem }) {
  if (item.lead) {
    return (
      <li>
        <strong className="text-brand-600 font-semibold">{item.lead}</strong>{" "}
        {item.text}
      </li>
    );
  }
  return <li>{item.text}</li>;
}
