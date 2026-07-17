import type { Metadata } from "next";
import Link from "next/link";
import {
  legacyLeadRoutes,
  type LegacyLeadRoute,
} from "@/lib/content/legacy-routes";

export const metadata: Metadata = {
  title: "Conversion Pages — Staging Index",
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

const typeformRows: LinkRow[] = legacyLeadRoutes
  .filter((route) => route.embed?.kind === "typeform")
  .map((route) => ({
    ...toRow(route),
    reference:
      route.embed?.kind === "typeform" ? route.embed.formId : route.slug,
  }));

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

type Group = {
  title: string;
  blurb: string;
  rows: LinkRow[];
};

const groups: Group[] = [
  {
    title: "Typeform embeds",
    blurb: "Native in-page Typeform with UTM + source passed as hidden fields.",
    rows: typeformRows,
  },
  {
    title: "Calendly embeds",
    blurb: "Native in-page Calendly scheduler with UTM passed as utm_* params.",
    rows: calendlyRows,
  },
  {
    title: "Native lead form",
    blurb: "Built-in Vendingpreneurs form (no external embed wired yet).",
    rows: nativeRows,
  },
];

const total = typeformRows.length + calendlyRows.length + nativeRows.length;

export default function QaLinksPage() {
  return (
    <main className="min-h-screen bg-[#f5fbff] px-5 pt-28 pb-24 lg:px-10">
      <div className="mx-auto max-w-[1250px]">
        <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
          Staging Index · Internal
        </p>
        <h1 className="mt-8 text-[clamp(2rem,3.4vw,3.4rem)] leading-[1] font-black text-[#111111] uppercase">
          Conversion Pages
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 font-semibold text-slate-700">
          Every conversion page and its embed. Open a link to see the live
          Typeform or Calendly in the branded page. {total} pages total. These
          pages are noindex; do not share outside the team.
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
