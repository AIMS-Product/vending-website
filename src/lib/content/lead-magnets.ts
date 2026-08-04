import type { PageContent } from "@/lib/page-builder/blocks";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";

/**
 * Lead-magnet landing and thank-you pages, held as code rather than as
 * page-builder rows.
 *
 * They are still expressed as `PageContent` so they render through the same
 * block components as every builder page — the copy lives here, but the hero,
 * card grid, lead form and CTA are the shared ones, so these pages cannot
 * visually drift from the rest of the site.
 *
 * Trade-off: marketing cannot edit these without a deploy. Move a page back
 * into the builder when that stops being acceptable.
 */

// Kody's lead-gen-only qualification form (admin → Forms → Entrepreneur Lead
// Magnet). Both magnets share it.
export const LEAD_MAGNET_FORM_ID = "2d3b9fbc-c270-4cd4-a970-97aeb95cd5ec";

const ROADMAP_PDF =
  "https://drive.google.com/file/d/1iORHjmg_UzU3tr5EKcEBp8XIQ-8qoNSm/view";
const FINANCE_SHEET =
  "https://docs.google.com/spreadsheets/d/1zShV2i0rJiIsuNuJXO9q89fvSjO8lIRPzbKa-LE10Rk/view";
const FINANCE_XLSX =
  "https://docs.google.com/spreadsheets/d/1zShV2i0rJiIsuNuJXO9q89fvSjO8lIRPzbKa-LE10Rk/export?format=xlsx";
const FINANCE_GUIDE_PDF =
  "https://drive.google.com/file/d/1N5UQAd63qMYUHYiLeUke5HoY8CT-L_Jh/view";

const MEDIA_BASE =
  "https://aacisvhkmsaabqdvdmmf.supabase.co/storage/v1/object/public/page-builder-media/images";

function section(
  id: string,
  blocks: PageContent["sections"][number]["columns"][number]["blocks"],
) {
  return {
    id: `${id}_section`,
    preset: "standard" as const,
    background: "default" as const,
    spacing: "standard" as const,
    columns: [{ id: `${id}_column`, width: "1/1" as const, blocks }],
  };
}

function paragraph(text: string) {
  return { type: "paragraph" as const, text };
}

function richText(
  id: string,
  heading: string,
  nodes:
    | { type: "paragraph"; text: string }[]
    | { type: "list"; style: "bullet"; items: string[] }[],
) {
  return {
    id,
    type: "rich_text" as const,
    variant: "default" as const,
    props: {
      eyebrow: "",
      heading,
      body: { version: 1 as const, nodes },
      fieldVisibility: { eyebrow: false, heading: Boolean(heading) },
    },
  };
}

/** Bottom-of-page conversion block, identical on every thank-you page. */
function acceleratorCta(idPrefix: string) {
  return [
    richText(
      `${idPrefix}_cta_copy`,
      "Get a headstart on your vending business",
      [
        paragraph(
          "Join the Vending Accelerator Program to access 1:1 support, educational resources, machine discounts, and much more.",
        ),
      ],
    ),
    {
      id: `${idPrefix}_cta`,
      type: "cta" as const,
      variant: "primary" as const,
      props: {
        href: "/contact",
        label: "Book a call",
        trackingName: `${idPrefix}-book-a-call`,
      },
    },
  ];
}

function leadFormBlock(
  id: string,
  heading: string,
  body: string,
  redirectPath: string,
) {
  return {
    id,
    type: "lead_form" as const,
    variant: "standard" as const,
    props: {
      heading,
      body,
      submitLabel: "Download Now",
      trackingName: `${id}-form`,
      calendlyUrl: "",
      qualification: {
        formId: LEAD_MAGNET_FORM_ID,
        completionRedirectPath: redirectPath,
        experimentKey: "",
        variantKey: "",
      },
    },
  };
}

const roadmapLandingContent: PageContent = {
  version: 1,
  sections: [
    section("roadmap", [
      {
        id: "roadmap_hero",
        type: "hero",
        variant: "split",
        props: {
          eyebrow: "Vending Accelerator 101",
          heading: "The 90-Day Vending Route Roadmap",
          body: "Your step-by-step plan to choose the right machine, land profitable locations, and build a vending route — without burning your savings on beginner mistakes.",
          ctaLabel: "",
          ctaHref: "",
          ctaTrackingName: "",
          mediaSrc: `${MEDIA_BASE}/e2279f89-462d-4426-bbc3-89ff0d9212a7-90-day-blueprint-cover.png`,
          mediaAltText: "90 day blueprint cover",
          mediaCaption: "",
          proofText: "",
          fieldVisibility: {
            cta: false,
            body: true,
            eyebrow: true,
            mediaCaption: false,
          },
        },
      },
      leadFormBlock(
        "roadmap_form",
        "Get the 90-day roadmap",
        "Tell us where to send it and it's yours.",
        "/resources/roadmap-thank-you",
      ),
      {
        id: "roadmap_cards",
        type: "card_grid",
        variant: "standard",
        props: {
          heading: "What's Included in Your 90-Day Roadmap",
          fieldVisibility: { heading: true },
          cards: [
            {
              title: "Establishing Your Foundation",
              body: "Research the business, choose your machine type, learn the real numbers, and shortlist five locations ranked by foot traffic. \n\nYou form your LLC and open a business bank account. \n\nYou don't buy anything yet.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Landing Your First Location",
              body: "Confirm foot traffic in person, reach the decision-maker, and pitch the machine as a free amenity. \n\nSign a simple one-page agreement, then order your machine and match your product list to the location.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Launch, Optimize, and Scale",
              body: "Set prices, stock conservatively, and treat month one as data collection. \n\nHand off restocking so the route stops eating your time, then use machine #1's numbers to make the case for machine #2.",
              href: "",
              linkLabel: "",
            },
          ],
        },
      },
      richText("roadmap_math", "What vending actually pays", [
        paragraph(
          "Before you talk to a single location, it helps to see the real math. Here's an illustrative breakdown for one machine doing $5,000 a month in sales.",
        ),
      ]),
      {
        id: "roadmap_table",
        type: "image",
        variant: "standard",
        props: {
          src: `${MEDIA_BASE}/859a98e1-526b-4f3a-aa33-548a901ace50-vending-unit-economics-table.png`,
          altText: "Vending unit economics table",
          caption: "",
          sourceRightsNotes: "Vendingpreneurs original artwork.",
          fieldVisibility: { caption: false },
        },
      },
      richText("roadmap_math_note", "", [
        paragraph(
          "Once a machine is dialed in, it tends to net somewhere between $2,000 and $2,500 a month. Stack a few and the picture changes: five machines become a real income stream, and ten become a real business.",
        ),
        paragraph(
          "These are example figures, not a promise of earnings. Your results depend on your location, product mix, costs, and how you run the route.",
        ),
      ]),
    ]),
  ],
};

const roadmapThankYouContent: PageContent = {
  version: 1,
  sections: [
    section("roadmap_ty", [
      {
        id: "roadmap_ty_hero",
        type: "hero",
        variant: "compact",
        props: {
          eyebrow: "",
          heading: "Your 90-day vending startup roadmap is ready",
          body: "The order to do things in for your first three months, so you're not guessing what comes next.",
          ctaLabel: "Download your roadmap",
          ctaHref: ROADMAP_PDF,
          ctaTrackingName: "roadmap-asset",
          mediaSrc: "",
          mediaAltText: "",
          mediaCaption: "",
          proofText: "",
        },
      },
      richText("roadmap_ty_inside", "What's inside", [
        {
          type: "list",
          style: "bullet",
          items: [
            "Month one: the paperwork, the setup, and your first location conversations",
            "Month two: narrowing to locations worth signing and getting agreements in place",
            "Month three: choosing and installing the machine, then tracking what it actually does",
          ],
        },
      ]),
      ...acceleratorCta("roadmap_ty"),
    ]),
  ],
};

const financeLandingContent: PageContent = {
  version: 1,
  sections: [
    section("finance", [
      {
        id: "finance_hero",
        type: "hero",
        variant: "split",
        props: {
          eyebrow: "Free Financial Template",
          heading: "Vending Machine Profit Worksheet",
          body: "Track the real financial performance of every machine and prep clean, lender-ready statements without guessing.",
          ctaLabel: "",
          ctaHref: "",
          ctaTrackingName: "",
          mediaSrc: "",
          mediaAltText: "",
          mediaCaption: "",
          proofText: "",
          fieldVisibility: {
            cta: false,
            body: true,
            eyebrow: true,
            mediaCaption: false,
          },
        },
      },
      leadFormBlock(
        "finance_form",
        "Get your free finance templates",
        "Tell us where to send them and they're yours.",
        "/resources/finance-templates-thank-you",
      ),
      richText("finance_profit", "How much does a machine profit?", [
        paragraph(
          "Most single machines gross $150 to $400 a month. After product, fees, and any location commission, the net margin lands around 20% to 35%, so real take-home is roughly $40 to $120 per machine, per month.",
        ),
        paragraph(
          "Across a year, a solid machine clears somewhere near $5,000 to $6,000 in profit before your own labor. That's a real return on a single asset, and it compounds every time you place another one well.",
        ),
        paragraph(
          "Those are averages, and averages hide a lot. A machine in a busy warehouse behaves nothing like the same model in a quiet office hallway. The number that decides which one you keep is return per machine, and you only see it once the costs are broken out.",
        ),
      ]),
      richText("finance_revenue", "Why revenue hides everything", [
        paragraph(
          "Whether you're sizing up your first machine or already running a handful, the same trap is waiting. Ask most operators what a machine made last month and you'll get a revenue number.",
        ),
        paragraph(
          "Revenue tells you a machine is busy. It doesn't tell you your cash-on-cash return, your payback period, or how many more placements you can afford. Those are the numbers that move your timeline.",
        ),
        paragraph(
          "Two operators can run the same $20,000 in yearly revenue and take home wildly different amounts, because one tracks margin per machine and one doesn't. The one flying blind can't pull the loser or clone the winner, so the whole route drifts.",
        ),
      ]),
      richText(
        "finance_statements_intro",
        "The three statements every operator needs",
        [
          paragraph(
            "Clean books for a vending route come down to three statements. Each answers a different question, and together they tell you the truth about your route.",
          ),
          paragraph(
            "Run one without the others and you're guessing. Run all three from the same data and every decision — restock, relocate, refinance, or buy the next machine — has a number behind it.",
          ),
        ],
      ),
      {
        id: "finance_statements_cards",
        type: "card_grid",
        variant: "standard",
        props: {
          heading: "",
          fieldVisibility: { heading: false },
          cards: [
            {
              title: "Income Statement (P&L)",
              body: "Am I making money, and which machines are pulling their weight? Surfaces contribution margin per machine, so you know what to keep and what to pull.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Cash Flow",
              body: "Do I have the cash to restock, service the loans, and fund the next placement? This is the view a bank or SBA lender expects to see.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Balance Sheet",
              body: "What do I own, what do I owe, and does the whole picture reconcile? When it balances, you know the books are clean.",
              href: "",
              linkLabel: "",
            },
          ],
        },
      },
      richText("finance_statements_note", "", [
        paragraph(
          "The free template builds all three for you, connected, so a change in one flows through the others automatically.",
        ),
      ]),
      richText("finance_costs_intro", "Your real costs, broken out", [
        paragraph(
          "Profit lives in the expenses, and vending has a specific set of them. The template pre-loads operator defaults for each so you can sanity-check your own numbers against the field.",
        ),
        paragraph(
          "None of these lines is dramatic on its own. Stacked together, they're the difference between a machine that funds the next placement and one that quietly runs at break-even for a year.",
        ),
      ]),
      {
        id: "finance_costs_cards",
        type: "card_grid",
        variant: "standard",
        props: {
          heading: "",
          fieldVisibility: { heading: false },
          cards: [
            {
              title: "Product (COGS)",
              body: "Your largest recurring cost. Industry sources assume around 50% of sales; lean operators buying through the right channels run closer to 33%, which is why disciplined margins read higher.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Location commission",
              body: "Property owners sometimes take 5% to 25% of gross. Many amenity placements ask for nothing, so leading with the amenity keeps the margin.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Processing and telemetry",
              body: "Card processing runs a few percent of every cashless sale, plus roughly $9 to $60 per machine per month for telemetry and software.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Financing",
              body: "Machines are often financed. A note at modest money down over five years is normal, and cash flow lets you kill it early.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Maintenance and labor",
              body: "Repairs, parts, and your own restocking time. If you run the route yourself, this is sweat rather than cash, but it's real.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Sales tax",
              body: "If your vend prices include tax, part of every sale was never yours. Back it out and your top line, your margin, and your tax bill all get honest at once.",
              href: "",
              linkLabel: "",
            },
          ],
        },
      },
      richText("finance_shrink_tip", "Tip: watch your shrink", [
        paragraph(
          "Track telemetry (DEX) sales every month, even when it's boring. The gap between what the machine says it sold and what you actually collected is your shrink.",
        ),
        paragraph(
          "A persistent gap over roughly 3% is theft, miscounts, or a jammed bill validator quietly eating your return — and it's the single easiest margin leak to close once you can see it.",
        ),
      ]),
      richText("finance_payback", "When does a machine pay for itself?", [
        paragraph(
          "A well-placed machine typically pays back its cost in 18 to 24 months. Past that window, it's worth reassessing the placement against your target return.",
        ),
        paragraph(
          "Scaling is where the real income question gets answered. One machine rarely covers living expenses. A route of 15 to 25 or more machines is usually what generates a meaningful full-time income, somewhere around $1,200 to $3,000+ per month in net profit, depending on your locations and how you run it.",
        ),
        paragraph(
          'The catch is cash. A new placement is often cash-negative for weeks before it self-funds, so the real question runs past "is it profitable" to "how many machines can I add before I run dry?"',
        ),
        paragraph(
          "That's exactly what a rolling cash forecast answers, and it's built into the template. Once you can see the next three months of cash, growth stops being a gamble and starts being a schedule.",
        ),
      ]),
      richText(
        "finance_built_for",
        "Built for the way vending actually works",
        [
          paragraph(
            "A general small-business template misses the three things that actually decide a vending route's margin. This one is built around them.",
          ),
          paragraph(
            "Each control below exists because operators lose real money without it — not because it makes the spreadsheet look thorough.",
          ),
        ],
      ),
      {
        id: "finance_controls_cards",
        type: "card_grid",
        variant: "standard",
        props: {
          heading: "",
          fieldVisibility: { heading: false },
          cards: [
            {
              title: "Shrink control",
              body: "Your card reader and telemetry know what should have sold. Compare that to what you collected, and a persistent gap is money leaking out. The template flags any month the variance clears 3%.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Sales-tax back-out",
              body: "If your vend prices include tax, that tax belongs to the state rather than your top line. Count it as revenue and you overstate both your profit and your tax bill. One checkbox backs it out correctly.",
              href: "",
              linkLabel: "",
            },
            {
              title: "Book vs. tax depreciation",
              body: "Expensing a whole machine is great for taxes and terrible for a loan application, because it can zero out your income right when a lender wants to see profit. The template holds both views side by side so you decide deliberately.",
              href: "",
              linkLabel: "",
            },
          ],
        },
      },
      richText("finance_template_intro", "The free template and guide", [
        paragraph(
          "The Vendingpreneurs Financial Statements Template is a complete, self-calculating workbook for your route. You enter data in two tabs. The other 12 build your three statements, a tax view, and a cash forecast on their own.",
        ),
        paragraph(
          "It's built to be lived in monthly, not filled out once. Ten minutes after each collection run and your books stay current all year.",
        ),
      ]),
      richText("finance_template_features", "", [
        {
          type: "list",
          style: "bullet",
          items: [
            "14 tabs, fully built — Income Statement, Cash Flow, Balance Sheet, plus inventory, commissions, depreciation, loan amortization, and a dashboard",
            "3 connected statements that update together",
            "2 tabs of data entry — register your machines once, then enter monthly sales",
            "Operator benchmarks pre-loaded, with industry figures beside them in grey so you can sanity-check your numbers against the field",
            "Plus the Know Your Numbers guide — a build walkthrough covering your accounting basis, the shrink and sales-tax controls, the book-versus-tax depreciation call, and the benchmark guardrails that tell you when to act.",
          ],
        },
      ]),
      richText(
        "finance_structure",
        "The structure our operators underwrite with",
        [
          paragraph(
            "Vendingpreneurs is a community of operators building profitable routes, with financing and equipment partners through VendHub and one-on-one guidance from vendors who've already done it.",
          ),
          paragraph(
            "This template is the same finance structure our operators use to underwrite a route: statements a lender reads, a tax-basis view, and a forecast that tells you when you can afford the next machine.",
          ),
          paragraph(
            "The benchmark figures throughout are directional, drawn from operator and vendor surveys rather than audited data. They're a compass for your own numbers, and this workbook is an educational tool, not financial, tax, or accounting advice. Confirm your specifics with a qualified CPA.",
          ),
        ],
      ),
      {
        id: "finance_faq",
        type: "faq",
        variant: "standard",
        props: {
          heading: "Vending machine profit FAQ",
          fieldVisibility: { heading: true },
          items: [
            {
              question: "How much money do vending machine owners make?",
              answer:
                "It varies widely by route size. A single machine nets roughly $40 to $120 a month after costs. A full-time income generally takes a route of 15 to 25 or more machines, in the range of $1,200 to $3,000+ per month net, depending on locations and effort.",
            },
            {
              question: "How many vending machines do you need to make $100K?",
              answer:
                "As a rough guide, at a few thousand dollars of net profit per machine per year, a six-figure net income points to a route in the low-to-mid dozens of well-placed machines. The template lets you model it with your own numbers rather than an average.",
            },
            {
              question:
                "How long does a vending machine take to pay for itself?",
              answer:
                "A well-placed machine typically pays back its cost in about 18 to 24 months. Beyond that window, it's worth reassessing the location against your target return.",
            },
            {
              question: "Is owning a vending machine worth it?",
              answer:
                "It can be, when the machines are placed well and tracked honestly. It's an asset you underwrite and manage rather than truly passive income. Knowing your real per-machine margin is what separates a worthwhile placement from a slow write-off.",
            },
            {
              question: "What makes the most money in a vending machine?",
              answer:
                'Product mix matters, but location and margin matter more. A machine matched to its audience, priced for margin, and kept stocked outperforms a "better" product in the wrong spot.',
            },
            {
              question: "Do I need an LLC to run a vending machine?",
              answer:
                "Many operators form one for liability and tax reasons, but requirements vary by state and situation. The guide covers your accounting basis and entity considerations at a high level; confirm the specifics with a CPA.",
            },
            {
              question: "What's the downside of owning a vending machine?",
              answer:
                "It isn't hands-off. Machines need restocking, repairs, and monitoring for shrink, and a single machine won't replace an income. The upside is that all of it is trackable, which is what the template is for.",
            },
            {
              question: "How much does a vending machine cost?",
              answer:
                "New and used equipment ranges widely, and most operators finance rather than pay cash. The template includes a full loan amortization schedule so the financing cost flows into your statements automatically.",
            },
          ],
        },
      },
      richText(
        "finance_final_note",
        "Know your numbers before your next machine",
        [
          paragraph(
            "Clean books tell you the truth about your route: which machines to keep, which to pull, and when you can afford to grow. Start with the numbers, and every decision after gets easier.",
          ),
        ],
      ),
      ...acceleratorCta("finance_final"),
    ]),
  ],
};

const financeThankYouContent: PageContent = {
  version: 1,
  sections: [
    section("finance_ty", [
      {
        id: "finance_ty_hero",
        type: "hero",
        variant: "compact",
        props: {
          eyebrow: "",
          heading: "Your vending financial statement templates are ready",
          body: "Run the numbers on a machine or a route before you spend anything on it.",
          ctaLabel: "Open your templates",
          ctaHref: FINANCE_SHEET,
          ctaTrackingName: "finance-asset",
          mediaSrc: "",
          mediaAltText: "",
          mediaCaption: "",
          proofText: "",
        },
      },
      richText("finance_ty_inside", "What's inside", [
        {
          type: "list",
          style: "bullet",
          items: [
            "A profit and loss template built for vending, with cost of goods, commission, and restocking time already broken out",
            "A cash flow view, so you can see what a machine ties up before it pays anything back",
            "Prefilled example figures you can overwrite with your own",
          ],
        },
      ]),
      {
        id: "finance_ty_extra",
        type: "rich_text",
        variant: "default",
        props: {
          eyebrow: "",
          heading: "",
          fieldVisibility: { eyebrow: false, heading: false },
          body: {
            version: 1,
            nodes: [
              {
                type: "paragraph",
                spans: [
                  { text: "Prefer a spreadsheet file? " },
                  { text: "Download the Excel version", href: FINANCE_XLSX },
                  { text: ". You can also read the " },
                  {
                    text: "Vending Financial Performance Guide",
                    href: FINANCE_GUIDE_PDF,
                  },
                  { text: "." },
                ],
              },
            ],
          },
        },
      },
      ...acceleratorCta("finance_ty"),
    ]),
  ],
};

type LeadMagnetPageSpec = {
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  /** Thank-you pages stay out of search so the asset links do not leak into results. */
  noindex: boolean;
  content: PageContent;
};

function toPage(spec: LeadMagnetPageSpec): PublishedSeoPage {
  const routePath = `/resources/${spec.slug}`;
  return {
    // Stable synthetic id: only used for React keys and attribution, never read
    // back from the database.
    id: `coded:${spec.slug}`,
    slug: spec.slug,
    route_prefix: "/resources",
    route_path: routePath,
    title: spec.title,
    target_keyword: null,
    published_content: spec.content,
    seo_title: spec.seoTitle,
    meta_description: spec.metaDescription,
    canonical_url: null,
    noindex: spec.noindex,
    sitemap_enabled: !spec.noindex,
    structured_data_settings: {},
    published_at: null,
    updated_at: "",
  };
}

export const roadmapLandingPage = toPage({
  slug: "roadmap",
  title: "The 90-Day Vending Route Roadmap",
  seoTitle: "90 Day Vending Route Roadmap | Vendingpreneurs",
  metaDescription:
    "Learn how to start, land locations, and scale your vending business in as little as 90 days.",
  noindex: false,
  content: roadmapLandingContent,
});

export const roadmapThankYouPage = toPage({
  slug: "roadmap-thank-you",
  title: "Your 90-day vending startup roadmap is ready",
  seoTitle: "90 Day Vending Route Roadmap | Vendingpreneurs",
  metaDescription:
    "Download the 90-day vending startup roadmap and follow the order to do things in for your first three months.",
  noindex: true,
  content: roadmapThankYouContent,
});

export const financeTemplatesLandingPage = toPage({
  slug: "finance-templates",
  title: "Vending Machine Profit Worksheet",
  seoTitle: "Vending Business Finance Templates | Vendingpreneurs",
  metaDescription:
    "Track machine-level P&L, cash flow, and balance sheet automatically. Download the free vending business finance templates.",
  noindex: false,
  content: financeLandingContent,
});

export const financeTemplatesThankYouPage = toPage({
  slug: "finance-templates-thank-you",
  title: "Your vending financial statement templates are ready",
  seoTitle: "Vending Business Finance Templates | Vendingpreneurs",
  metaDescription:
    "Download the vending profit and loss and cash flow templates and run the numbers before you buy a machine.",
  noindex: true,
  content: financeThankYouContent,
});

export const leadMagnetPages = [
  roadmapLandingPage,
  roadmapThankYouPage,
  financeTemplatesLandingPage,
  financeTemplatesThankYouPage,
];
