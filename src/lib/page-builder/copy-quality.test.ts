import { describe, expect, it } from "vitest";
import type { PageBlock, PageContent } from "./blocks";
import { assessSeoCopyQuality } from "./copy-quality";
import { SEO_COPY_STANDARDS, seoCopyPromptRules } from "./copy-standards";

const KEYWORD = "coffee vending machines for offices";

function pageWith(blocks: PageBlock[]): PageContent {
  return {
    version: 1,
    sections: [
      {
        id: "section_1",
        preset: "standard",
        background: "default",
        spacing: "standard",
        columns: [{ id: "column_1", width: "1/1", blocks }],
      },
    ],
  };
}

const sentence = (lead: string, words: number) =>
  `${lead} ${Array.from({ length: Math.max(0, words - 2) }, (_, i) => `detail${i}`).join(" ")} today.`;

function hero(body: string): PageBlock {
  return {
    id: "block_hero",
    type: "hero",
    variant: "standard",
    props: {
      eyebrow: "Office refreshments",
      heading: `Reliable ${KEYWORD} without the admin`,
      body,
      ctaLabel: "Book a consultation",
      ctaHref: "/contact",
      ctaTrackingName: "hero_contact",
    },
  };
}

const goodHeroBody =
  "Keep your team focused with managed machines that handle brewing, restocking, and cleaning for you. Most offices are pouring drinks within two weeks of an initial site walk-through, so book the assessment now.";

function richText(text: string, id = "block_text"): PageBlock {
  return {
    id,
    type: "rich_text",
    variant: "default",
    props: {
      eyebrow: "Planning",
      heading: "What an office coffee rollout actually involves",
      body: { version: 1, nodes: [{ type: "paragraph", text }] },
    },
  };
}

const goodRichTextBody =
  "Before committing to equipment, walk the floor and count how many people pass the proposed location between nine and eleven in the morning. Plumbed machines need a water line within a few metres, while tank-fed units trade convenience for a weekly refill task someone must own. Confirm who restocks beans and milk, how faults get reported, and what happens during office shutdown weeks. A trial month with usage reporting tells you more than any brochure, and it gives facilities a clean exit if uptake disappoints.";

function faq(
  items: { question: string; answer: string }[],
  id = "block_faq",
): PageBlock {
  return {
    id,
    type: "faq",
    variant: "standard",
    props: { heading: "Common questions", items },
  };
}

const goodAnswer =
  "Plan for a site assessment first, which usually takes under an hour. Installation follows within one to two weeks depending on whether the machine needs a plumbed water line or can run from an internal tank.";

const goodFaqItems = [
  { question: "How long does installation take?", answer: goodAnswer },
  {
    question: "Who restocks the machine?",
    answer:
      "Fully managed plans include scheduled restocking visits, typically weekly for offices under eighty staff. Self-managed plans cost less but someone internal owns ordering and loading consumables.",
  },
  {
    question: "What happens if the machine breaks down?",
    answer:
      "Report faults through the support line and most issues are resolved remotely the same day. On-site repairs are usually scheduled within two business days, with loan equipment offered for longer outages.",
  },
];

function cards(
  list: { title: string; body: string }[],
  id = "block_cards",
): PageBlock {
  return {
    id,
    type: "card_grid",
    variant: "standard",
    props: {
      heading: "Choosing between machine types",
      cards: list.map((card) => ({ ...card, href: "/contact" })),
    },
  };
}

const goodCards = [
  {
    title: "Bean-to-cup machines",
    body: "Grind fresh beans per cup and suit offices that care about taste. Expect more counter space and a daily rinse routine someone must own.",
  },
  {
    title: "Tank-fed units",
    body: "Skip the plumbing requirement entirely, which makes them the fastest to install. The trade-off is a refill task that falls to facilities each week.",
  },
  {
    title: "Fully managed service",
    body: "Restocking, cleaning, and fault response are handled for you on a schedule. It costs more per month but removes every recurring task from your team.",
  },
];

const robustPage = pageWith([
  hero(goodHeroBody),
  richText(goodRichTextBody),
  cards(goodCards),
  faq(goodFaqItems),
  {
    id: "block_cta",
    type: "cta",
    variant: "primary",
    props: { label: "Talk to us", href: "/contact", trackingName: "cta" },
  },
]);

function codes(
  content: PageContent,
  options?: Parameters<typeof assessSeoCopyQuality>[1],
) {
  return assessSeoCopyQuality(content, {
    targetKeyword: KEYWORD,
    ...options,
  }).findings.map((finding) => finding.code);
}

describe("assessSeoCopyQuality", () => {
  it("passes a robust page with no hard failures", () => {
    const result = assessSeoCopyQuality(robustPage, { targetKeyword: KEYWORD });

    expect(
      result.findings.filter((finding) => finding.severity === "fail"),
    ).toEqual([]);
    expect(result.verdict).toBe("pass");
    expect(result.metrics.visibleWordCount).toBeGreaterThanOrEqual(
      SEO_COPY_STANDARDS.pageMinVisibleWords,
    );
  });

  it("fails a thin hero body", () => {
    const content = pageWith([hero("Great coffee for offices.")]);
    expect(codes(content, { scope: "fragment" })).toContain("thin_hero_body");
  });

  it("fails short rich_text without bullets but passes it with a bullet list", () => {
    const shortText = sentence("Office machines need planning", 45);
    expect(
      codes(pageWith([richText(shortText)]), { scope: "fragment" }),
    ).toContain("thin_rich_text");

    const withBullets: PageBlock = {
      id: "block_text",
      type: "rich_text",
      variant: "default",
      props: {
        eyebrow: "",
        heading: "Planning checklist",
        body: {
          version: 1,
          nodes: [
            { type: "paragraph", text: shortText },
            {
              type: "list",
              style: "bullet",
              items: [
                "Count peak-hour foot traffic past the proposed spot",
                "Confirm a water line or accept tank refills",
                "Agree who owns restocking before installation",
              ],
            },
          ],
        },
      },
    };
    expect(codes(pageWith([withBullets]), { scope: "fragment" })).not.toContain(
      "thin_rich_text",
    );
  });

  it("fails FAQs with too few items or thin answers", () => {
    const fewItems = pageWith([faq(goodFaqItems.slice(0, 2))]);
    expect(codes(fewItems, { scope: "fragment" })).toContain("thin_faq");

    const thinAnswer = pageWith([
      faq([
        ...goodFaqItems.slice(0, 2),
        { question: "Is it worth it?", answer: "Yes, usually." },
      ]),
    ]);
    expect(codes(thinAnswer, { scope: "fragment" })).toContain(
      "thin_faq_answer",
    );
  });

  it("fails thin card bodies and warns on sparse grids", () => {
    const result = assessSeoCopyQuality(
      pageWith([
        cards([
          { title: "Machines", body: "Good machines for offices." },
          goodCards[1]!,
        ]),
      ]),
      { scope: "fragment" },
    );
    const byCode = Object.fromEntries(
      result.findings.map((finding) => [finding.code, finding.severity]),
    );
    expect(byCode.thin_card_body).toBe("fail");
    expect(byCode.sparse_card_grid).toBe("warn");
  });

  it("fails filler phrases with the phrase named in the message", () => {
    const content = pageWith([
      hero(
        "Our state-of-the-art machines elevate your breakroom with reliable drinks your team can pour quickly between meetings every single working day.",
      ),
    ]);
    const findings = assessSeoCopyQuality(content, {
      scope: "fragment",
    }).findings.filter((finding) => finding.code === "filler_phrase");
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings[0]!.message).toMatch(/state.of.the.art|elevate your/);
  });

  it("fails duplicated body copy across blocks", () => {
    const content = pageWith([
      richText(goodRichTextBody, "block_text_1"),
      richText(goodRichTextBody, "block_text_2"),
    ]);
    expect(codes(content, { scope: "fragment" })).toContain("duplicated_copy");
  });

  it("warns on repetitive sentence openers", () => {
    const repetitive = Array.from({ length: 7 }, (_, i) =>
      sentence(`Vending suits workplace ${i}`, 12),
    ).join(" ");
    expect(
      codes(pageWith([richText(repetitive)]), { scope: "fragment" }),
    ).toContain("repetitive_sentence_openers");
  });

  it("fails keyword stuffing and absent keywords at page scope only", () => {
    const stuffed = pageWith([
      hero(
        `${KEYWORD} are the best ${KEYWORD} because ${KEYWORD} beat other ${KEYWORD} for every office considering ${KEYWORD} today.`,
      ),
    ]);
    expect(codes(stuffed, { scope: "fragment" })).toContain("keyword_stuffing");

    const noKeyword = pageWith([
      hero(goodHeroBody.replace(/machines/g, "units")),
      richText(goodRichTextBody),
      faq(goodFaqItems),
    ]);
    expect(
      codes(noKeyword, { targetKeyword: "espresso catering perth" }),
    ).toContain("keyword_absent");
    expect(
      codes(noKeyword, {
        targetKeyword: "espresso catering perth",
        scope: "fragment",
      }),
    ).not.toContain("keyword_absent");
  });

  it("applies page minimums only at page scope", () => {
    const fragment = pageWith([hero(goodHeroBody)]);
    expect(codes(fragment)).toEqual(
      expect.arrayContaining(["thin_page_copy", "shallow_structure"]),
    );
    expect(codes(fragment, { scope: "fragment" })).not.toContain(
      "thin_page_copy",
    );
  });
});

describe("seoCopyPromptRules", () => {
  it("stays in sync with the enforced standards", () => {
    const rules = seoCopyPromptRules();
    expect(rules).toContain(
      `${SEO_COPY_STANDARDS.heroBodyWords.min}-${SEO_COPY_STANDARDS.heroBodyWords.max} words`,
    );
    expect(rules).toContain(
      `below ${SEO_COPY_STANDARDS.pageMinVisibleWords} visible words`,
    );
    expect(rules).toContain(`at least ${SEO_COPY_STANDARDS.faqMinItems} items`);
    expect(rules).toContain(
      `${SEO_COPY_STANDARDS.completeDraft.minVisibleWords}+ visible words`,
    );
    expect(rules).toContain(
      `${SEO_COPY_STANDARDS.completeDraft.minFaqItems}+ FAQ items`,
    );
    for (const phrase of SEO_COPY_STANDARDS.fillerPhrases.slice(0, 3)) {
      expect(rules).toContain(phrase);
    }
  });
});
