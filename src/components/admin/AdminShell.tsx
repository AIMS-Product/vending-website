import type { ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { signOut } from "@/app/admin/actions";

type AdminSection = "pages" | "posts" | "media" | "libraries";

type AdminNavSection = {
  id: AdminSection;
  label: string;
  href: string;
  description: string;
};

const sections: AdminNavSection[] = [
  {
    id: "pages",
    label: "Resource pages",
    href: "/admin/pages",
    description: "SEO block pages",
  },
  {
    id: "posts",
    label: "Blog and news",
    href: "/admin/news",
    description: "Articles and updates",
  },
  {
    id: "media",
    label: "Media library",
    href: "/admin/media",
    description: "Images and source assets",
  },
  {
    id: "libraries",
    label: "Content libraries",
    href: "/admin/libraries",
    description: "Claims, proof, CTAs",
  },
];

const plannedSections = [
  {
    label: "Landing pages",
    description: "Conversion pages",
  },
  {
    label: "Campaign pages",
    description: "Offer pages",
  },
];

export function AdminShell({
  activeSection,
  eyebrow,
  title,
  description,
  userEmail,
  userRole,
  children,
}: {
  activeSection: AdminSection;
  eyebrow: string;
  title: string;
  description?: string;
  userEmail?: string | null;
  userRole?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="mx-auto grid w-full max-w-[1600px] lg:min-h-screen lg:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-b border-black/10 bg-white/80 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
          <div className="flex h-full flex-col gap-7 px-5 pt-5 pb-16 lg:pb-8">
            <div className="rounded-lg bg-[#1d1d1f] px-4 py-4 text-white shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
              <p className="text-xs font-medium text-white/60 uppercase">
                Admin CMS
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                Studio
              </h2>
              <p className="mt-2 text-sm leading-5 text-white/70">
                Create, govern, publish.
              </p>
            </div>

            <div>
              <p className="mb-2 px-3 text-xs font-semibold text-[#86868b] uppercase">
                Content
              </p>
              <nav aria-label="Admin sections" className="grid gap-1">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={clsx(
                      "group flex items-center gap-2 rounded-lg text-sm transition",
                      activeSection === section.id
                        ? "bg-[#e8e8ed]"
                        : "text-[#6e6e73] hover:bg-white/75 hover:text-[#1d1d1f]",
                    )}
                  >
                    <Link
                      href={section.href}
                      className="min-w-0 flex-1 rounded-lg px-3 py-2.5 focus-visible:ring-2 focus-visible:ring-[#0071e3]/30 focus-visible:outline-none"
                      aria-current={
                        activeSection === section.id ? "page" : undefined
                      }
                    >
                      <span className="block font-semibold text-[#1d1d1f]">
                        {section.label}
                      </span>
                      <span
                        className={clsx(
                          "mt-0.5 block text-xs",
                          activeSection === section.id
                            ? "text-[#424245]"
                            : "text-[#86868b]",
                        )}
                      >
                        {section.description}
                      </span>
                    </Link>
                  </div>
                ))}
              </nav>
            </div>

            <div className="border-t border-black/10 pt-5">
              <p className="mb-2 px-3 text-xs font-semibold text-[#86868b] uppercase">
                Planned
              </p>
              <div className="grid gap-1">
                {plannedSections.map((section) => (
                  <div
                    key={section.label}
                    className="rounded-lg px-3 py-2.5 text-sm text-[#86868b]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{section.label}</span>
                      <span className="rounded-full bg-[#e8e8ed] px-2 py-0.5 text-[11px] font-semibold text-[#6e6e73]">
                        Later
                      </span>
                    </div>
                    <span className="mt-0.5 block text-xs">
                      {section.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto mb-10 border-t border-black/10 pt-5">
              {userEmail ? (
                <p className="mb-3 rounded-lg bg-white/60 px-3 py-2 text-xs leading-5 text-[#6e6e73]">
                  Signed in as{" "}
                  <span className="font-medium text-[#1d1d1f]">
                    {userEmail}
                  </span>
                  {userRole ? ` (${userRole})` : null}
                </p>
              ) : null}
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-black/10 bg-white/75 px-3 py-2 text-left text-sm font-semibold text-[#424245] transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[#0071e3]/30 focus-visible:outline-none"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </aside>

        <section
          aria-labelledby="admin-shell-title"
          className="min-w-0 px-5 py-7 sm:px-8 lg:px-12 lg:py-10"
        >
          <header className="mb-8 flex flex-col gap-5 border-b border-black/10 pb-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-sm font-medium text-[#0071e3]">{eyebrow}</p>
              <h1
                id="admin-shell-title"
                className="mt-2 text-4xl font-semibold tracking-normal text-[#1d1d1f]"
              >
                {title}
              </h1>
              {description ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6e6e73]">
                  {description}
                </p>
              ) : null}
            </div>
            <div className="w-fit self-start rounded-full border border-black/10 bg-white/75 px-4 py-2 text-sm font-medium text-[#424245] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {userRole ? `${userRole} access` : "Admin access"}
            </div>
          </header>
          {children}
        </section>
      </div>
    </div>
  );
}
