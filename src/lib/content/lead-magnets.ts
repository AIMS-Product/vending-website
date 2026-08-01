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
  financeTemplatesThankYouPage,
];
