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
    <article className="bg-[#f5fbff] px-5 pt-28 pb-20 lg:px-10 lg:pt-32 lg:pb-24">
      <div className="mx-auto max-w-[920px]">
        <header className="border-b-2 border-[#bfeeff] pb-10">
          <h1 className="text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
            {doc.title}
          </h1>
          <p className="mt-4 text-sm font-semibold text-slate-600">
            <strong className="font-black text-[#111111]">Last Updated:</strong>{" "}
            {doc.lastUpdated}
          </p>
        </header>

        <div className="mt-12 space-y-12">
          {doc.sections.map((section) => (
            <LegalSectionView key={section.number} section={section} />
          ))}
        </div>
      </div>
    </article>
  );
}

function LegalSectionView({ section }: { section: LegalSection }) {
  return (
    <section>
      <h2 className="text-2xl font-black text-[#111111] uppercase sm:text-3xl">
        {section.number}. {section.heading}
      </h2>
      <div className="mt-5 space-y-4 leading-relaxed font-semibold text-slate-700">
        {section.blocks.map((block) => (
          <BlockView key={legalBlockKey(block)} block={block} />
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
      return <p className="font-black text-[#111111]">{block.text}</p>;
    case "h3":
      return (
        <h3 className="mt-6 text-base font-black text-[#111111] uppercase">
          {block.text}
        </h3>
      );
    case "ul":
      return (
        <ul className="ml-5 list-disc space-y-2 marker:text-[#066a99]">
          {block.items.map((item) => (
            <ListItemView key={legalListItemKey(item)} item={item} />
          ))}
        </ul>
      );
  }
}

function ListItemView({ item }: { item: LegalListItem }) {
  if (item.lead) {
    return (
      <li>
        <strong className="font-black text-[#111111]">{item.lead}</strong>{" "}
        {item.text}
      </li>
    );
  }
  return <li>{item.text}</li>;
}

function legalBlockKey(block: LegalBlock) {
  if (block.kind === "ul") {
    return `ul:${block.items.map(legalListItemKey).join("|")}`;
  }
  return `${block.kind}:${block.text}`;
}

function legalListItemKey(item: LegalListItem) {
  return `${item.lead ?? ""}:${item.text}`;
}
