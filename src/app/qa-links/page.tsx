import type { Metadata } from "next";
import Link from "next/link";
import {
  legacyLeadRoutes,
  type LegacyLeadRoute,
} from "@/lib/content/legacy-routes";

export const metadata: Metadata = {
  title: "Staging Page Index — All Pages",
  robots: { index: false, follow: false },
};

type LinkRow = {
  path: string;
  slug: string;
  reference: string;
};

/** Calendly event slug shown next to the link, e.g. "vending-accelerator-call". */
function calendlyLabel(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? url;
  } catch {
    return url;
  }
}

function toRow(route: LegacyLeadRoute): LinkRow {
  return { path: route.path, slug: route.slug, reference: route.metadataTitle };
}

const calendlyRows: LinkRow[] = legacyLeadRoutes
  .filter((route) => route.embed?.kind === "calendly")
  .map((route) => ({
    ...toRow(route),
    reference:
      route.embed?.kind === "calendly"
        ? calendlyLabel(route.embed.url)
        : route.slug,
  }));

// No-embed legacy routes fall back to the built-in lead form, plus the two
// top-level native-form pages that live outside the legacy registry.
const nativeRows: LinkRow[] = [
  { path: "/apply", slug: "apply", reference: "Apply — native lead form" },
  {
    path: "/contact",
    slug: "contact",
    reference: "Contact — native lead form",
  },
  ...legacyLeadRoutes
    .filter((route) => !route.embed)
    .map((route) => ({ ...toRow(route), reference: "native lead form" })),
];

// Core marketing/content pages — replicated from Webflow, defined in code
// (edited by a developer, not the CMS). All live and reachable.
const marketingRows: LinkRow[] = [
  { path: "/", slug: "home", reference: "Home" },
  { path: "/about", slug: "about", reference: "About" },
  { path: "/case-studies", slug: "case-studies", reference: "Case studies" },
  { path: "/news", slug: "news", reference: "News / blog landing" },
  {
    path: "/pre-call-resources",
    slug: "pre-call-resources",
    reference: "Pre-call resources",
  },
  { path: "/terms", slug: "terms", reference: "Terms" },
  { path: "/privacy", slug: "privacy", reference: "Privacy policy" },
];

// Pages that ARE editable in the admin backend (CMS), not code.
const cmsRows: LinkRow[] = [
  {
    path: "/admin/pages",
    slug: "admin-pages",
    reference: "SEO pages — create & edit in the admin",
  },
  {
    path: "/admin/news",
    slug: "admin-news",
    reference: "Blog & news articles — create & edit in the admin",
  },
];

type Group = {
  title: string;
  blurb: string;
  rows: LinkRow[];
};

const groups: Group[] = [
  {
    title: "Marketing & content pages",
    blurb:
      "Core pages replicated from Webflow. Live and reachable, but defined in code — edited by a developer, not the CMS.",
    rows: marketingRows,
  },
  {
    title: "Native lead form",
    blurb:
      "Built-in Vendingpreneurs form — captures the lead in our database with full UTM/source attribution. Former Typeform pages now live here. Code-managed.",
    rows: nativeRows,
  },
  {
    title: "Calendly embeds",
    blurb:
      "Native in-page Calendly scheduler with UTM passed as utm_* params. Code-managed.",
    rows: calendlyRows,
  },
  {
    title: "Editable in the admin (CMS)",
    blurb:
      "These are managed in the backend — an admin can create and edit them directly, no developer needed. Everything above is code-managed.",
    rows: cmsRows,
  },
];

const total = calendlyRows.length + nativeRows.length + marketingRows.length;

export default function QaLinksPage() {
  return (
    <main className="min-h-screen bg-[#f5fbff] px-5 pt-28 pb-24 lg:px-10">
      <div className="mx-auto max-w-[1250px]">
        <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
          Staging Index · Internal
        </p>
        <h1 className="mt-8 text-[clamp(2rem,3.4vw,3.4rem)] leading-[1] font-black text-[#111111] uppercase">
          All Pages
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 font-semibold text-slate-700">
          Every page on the site, grouped. {total} code-managed pages
          (marketing, lead-form, and Calendly) — open any link to view it live.
          The last group is editable in the admin backend (CMS). This index is
          noindex; do not share outside the team.
        </p>

        <div className="mt-12 flex flex-col gap-10">
          {groups.map((group) => (
            <section key={group.title}>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-2xl font-black text-[#111111] uppercase">
                  {group.title}
                </h2>
                <span className="rounded-[6px] border-2 border-[#111111] bg-white px-2 py-0.5 text-xs font-black text-[#111111]">
                  {group.rows.length}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-base leading-7 font-semibold text-slate-700">
                {group.blurb}
              </p>

              <ul className="mt-5 grid gap-3 md:grid-cols-2">
                {group.rows.map((row) => (
                  <li key={row.path}>
                    <Link
                      className="flex items-center justify-between gap-4 rounded-[10px] border-2 border-[#111111] bg-white p-4 shadow-[6px_6px_0_#55b8e8] transition-transform hover:-translate-y-0.5"
                      href={row.path}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-base font-black text-[#111111]">
                          {row.path}
                        </span>
                        <span className="mt-1 block truncate text-sm font-semibold text-slate-500">
                          {row.reference}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-[6px] border-2 border-[#55b8e8] bg-[#111111] px-3 py-1 text-xs font-black text-white uppercase">
                        Open
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
