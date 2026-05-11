"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { signOut } from "@/app/admin/actions";

type AdminSection = "pages" | "posts" | "media" | "libraries";
type AdminIcon =
  | "archive"
  | "book"
  | "file"
  | "image"
  | "layers"
  | "log-out"
  | "shield"
  | "target";

type AdminNavSection = {
  id: AdminSection;
  label: string;
  href: string;
  description: string;
  icon: AdminIcon;
  createHref?: string;
  createLabel?: string;
};

const sections: AdminNavSection[] = [
  {
    id: "pages",
    label: "Resource pages",
    href: "/admin/pages",
    description: "SEO page content",
    icon: "file",
    createHref: "/admin/pages/new",
    createLabel: "Resource page",
  },
  {
    id: "posts",
    label: "Blog and news",
    href: "/admin/news",
    description: "Articles and updates",
    icon: "book",
    createHref: "/admin/news/new",
    createLabel: "Blog post",
  },
  {
    id: "media",
    label: "Media library",
    href: "/admin/media",
    description: "Images and source assets",
    icon: "image",
  },
  {
    id: "libraries",
    label: "Content libraries",
    href: "/admin/libraries",
    description: "Claims, proof, CTAs",
    icon: "layers",
  },
];

const plannedSections = [
  {
    label: "Landing pages",
    description: "Conversion pages",
    icon: "book" as const,
  },
  {
    label: "Campaign pages",
    description: "Offer pages",
    icon: "target" as const,
  },
];

export function AdminShell({
  activeSection,
  eyebrow,
  title,
  description,
  userEmail,
  userRole,
  actions,
  immersive = false,
  children,
}: {
  activeSection: AdminSection;
  eyebrow: string;
  title: string;
  description?: string;
  userEmail?: string | null;
  userRole?: string | null;
  actions?: ReactNode;
  immersive?: boolean;
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeLabel =
    sections.find((section) => section.id === activeSection)?.label ?? "Studio";

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-[#0f172a]">
      <div className="border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <details>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-950 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0b63f6] text-sm font-semibold text-white">
                S
              </span>
              <span className="min-w-0">
                <span className="block">Studio</span>
                <span className="block truncate text-xs font-medium text-slate-500">
                  {activeLabel}
                </span>
              </span>
            </span>
            <span className="text-slate-500" aria-hidden="true">
              <AdminChevron />
            </span>
          </summary>
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4">
            <nav aria-label="Admin sections" className="grid gap-2">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className={clsx(
                    "flex items-center gap-2 rounded-md border text-sm transition",
                    activeSection === section.id
                      ? "border-[#cfe0ff] bg-[#f4f8ff] text-slate-950"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  <Link
                    href={section.href}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3"
                    aria-current={
                      activeSection === section.id ? "page" : undefined
                    }
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#0b63f6]"
                      aria-hidden="true"
                    >
                      <AdminIconGlyph icon={section.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {section.label}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {section.description}
                      </span>
                    </span>
                  </Link>
                  {section.createHref ? (
                    <Link
                      href={section.createHref}
                      aria-label={`Create ${section.createLabel}`}
                      className="mr-3 rounded-full border border-[#d8e6ff] bg-white px-2.5 py-1 text-xs font-semibold text-[#0b63f6]"
                    >
                      New
                    </Link>
                  ) : null}
                </div>
              ))}
            </nav>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-950 shadow-sm"
              >
                <span className="text-slate-700" aria-hidden="true">
                  <AdminIconGlyph icon="log-out" />
                </span>
                Sign out
              </button>
            </form>
          </div>
        </details>
      </div>
      <div
        className={clsx(
          "mx-auto grid w-full max-w-[1680px] transition-[grid-template-columns] duration-200 lg:min-h-screen",
          sidebarCollapsed
            ? "lg:grid-cols-[84px_minmax(0,1fr)]"
            : "lg:grid-cols-[292px_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden overflow-y-auto border-b border-slate-200 bg-white/95 backdrop-blur lg:sticky lg:top-0 lg:block lg:h-screen lg:border-r lg:border-b-0">
          <div
            className={clsx(
              "flex h-full flex-col pt-6 pb-5 transition-[padding] duration-200",
              sidebarCollapsed ? "px-3" : "px-4",
            )}
          >
            <div className="flex items-start justify-between gap-3 px-2">
              <div
                className={clsx(
                  "flex min-w-0 items-start gap-3",
                  sidebarCollapsed && "justify-center",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#0b63f6] text-lg font-semibold text-white shadow-sm">
                  S
                </div>
                <div className={clsx("min-w-0", sidebarCollapsed && "hidden")}>
                  <h2 className="text-base font-semibold text-slate-950">
                    Studio
                  </h2>
                  <p className="text-sm text-slate-500">Admin CMS</p>
                </div>
              </div>
              <button
                type="button"
                aria-label={
                  sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
              >
                <span
                  className={clsx(
                    "transition-transform",
                    sidebarCollapsed ? "rotate-180" : "",
                  )}
                  aria-hidden="true"
                >
                  <AdminChevron />
                </span>
              </button>
            </div>
            <p
              className={clsx(
                "mt-5 px-2 text-sm text-slate-600",
                sidebarCollapsed && "hidden",
              )}
            >
              Create, govern, publish.
            </p>

            <div
              className={clsx(
                "border-t border-slate-200 pt-6",
                sidebarCollapsed ? "mt-5" : "mt-7",
              )}
            >
              <p
                className={clsx(
                  "mb-3 px-2 text-xs font-semibold text-slate-500 uppercase",
                  sidebarCollapsed && "sr-only",
                )}
              >
                Content
              </p>
              <nav aria-label="Admin sections" className="grid gap-2">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={clsx(
                      "group flex items-center gap-2 rounded-md border text-sm transition",
                      activeSection === section.id
                        ? "border-[#cfe0ff] bg-[#f4f8ff] shadow-[inset_3px_0_0_#0b63f6]"
                        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950",
                    )}
                  >
                    <Link
                      href={section.href}
                      title={sidebarCollapsed ? section.label : undefined}
                      className={clsx(
                        "flex min-w-0 flex-1 items-center rounded-md py-3 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none",
                        sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3",
                      )}
                      aria-current={
                        activeSection === section.id ? "page" : undefined
                      }
                    >
                      <span
                        className={clsx(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          activeSection === section.id
                            ? "text-[#0b63f6]"
                            : "text-slate-500",
                        )}
                        aria-hidden="true"
                      >
                        <AdminIconGlyph icon={section.icon} />
                      </span>
                      <span
                        className={clsx(
                          "min-w-0",
                          sidebarCollapsed && "hidden",
                        )}
                      >
                        <span className="block font-semibold text-slate-950">
                          {section.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {section.description}
                        </span>
                      </span>
                    </Link>
                    {section.createHref && !sidebarCollapsed ? (
                      <Link
                        href={section.createHref}
                        aria-label={`Create ${section.createLabel}`}
                        className="mr-3 shrink-0 rounded-full border border-[#d8e6ff] bg-white px-2.5 py-1 text-xs font-semibold text-[#0b63f6] transition hover:bg-[#edf4ff] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                      >
                        New
                      </Link>
                    ) : null}
                  </div>
                ))}
              </nav>
            </div>

            <div
              className={clsx(
                "mt-7 border-t border-slate-200 pt-5",
                sidebarCollapsed && "hidden",
              )}
            >
              <p className="mb-3 px-2 text-xs font-semibold text-slate-500 uppercase">
                Planned
              </p>
              <div className="grid gap-2">
                {plannedSections.map((section) => (
                  <div
                    key={section.label}
                    className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-slate-500"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500"
                      aria-hidden="true"
                    >
                      <AdminIconGlyph icon={section.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-700">
                        {section.label}
                      </span>
                      <span className="mt-0.5 block text-xs">
                        {section.description}
                      </span>
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      Later
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto border-t border-slate-200 pt-6">
              {userEmail ? (
                <div
                  className={clsx(
                    "mb-4 flex items-center gap-3 px-2",
                    sidebarCollapsed && "justify-center",
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-800">
                    {adminInitials(userEmail)}
                  </div>
                  <p
                    className={clsx(
                      "min-w-0 text-xs leading-5 text-slate-500",
                      sidebarCollapsed && "hidden",
                    )}
                  >
                    Signed in as
                    <span className="block truncate text-sm font-medium text-slate-950">
                      {userEmail}
                    </span>
                    {userRole ? (
                      <span className="block truncate">{userRole}</span>
                    ) : null}
                  </p>
                </div>
              ) : null}
              <form action={signOut}>
                <button
                  type="submit"
                  title={sidebarCollapsed ? "Sign out" : undefined}
                  className={clsx(
                    "flex w-full items-center rounded-md border border-slate-200 bg-white py-3 text-left text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none",
                    sidebarCollapsed ? "justify-center px-2" : "gap-3 px-4",
                  )}
                >
                  <span className="text-slate-700" aria-hidden="true">
                    <AdminIconGlyph icon="log-out" />
                  </span>
                  <span className={clsx(sidebarCollapsed && "hidden")}>
                    Sign out
                  </span>
                </button>
              </form>
            </div>
          </div>
        </aside>

        <section
          aria-label={immersive ? title : undefined}
          aria-labelledby={immersive ? undefined : "admin-shell-title"}
          className={clsx(
            "min-w-0",
            immersive ? "p-0" : "px-5 py-6 sm:px-8 lg:px-10",
          )}
        >
          {!immersive && (
            <header className="mb-7">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-sm font-semibold text-[#0b63f6]">
                  <span>{eyebrow}</span>
                  <span className="text-slate-400" aria-hidden="true">
                    <AdminChevron />
                  </span>
                </div>
                <div className="flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm">
                  <span className="text-slate-700" aria-hidden="true">
                    <AdminIconGlyph icon="shield" />
                  </span>
                  {userRole ? `${userRole} access` : "Admin access"}
                </div>
              </div>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <h1
                    id="admin-shell-title"
                    className="text-4xl font-semibold tracking-normal text-slate-950"
                  >
                    {title}
                  </h1>
                  {description ? (
                    <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                      {description}
                    </p>
                  ) : null}
                </div>
                {actions ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {actions}
                  </div>
                ) : null}
              </div>
            </header>
          )}
          {children}
        </section>
      </div>
    </div>
  );
}

function adminInitials(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function AdminChevron() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>
  );
}

function AdminIconGlyph({ icon }: { icon: AdminIcon }) {
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.8,
    className: "h-5 w-5",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (icon) {
    case "archive":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M6 7v11h12V7" />
          <path d="M9 11h6" />
          <path d="M7 4h10l1 3H6l1-3Z" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z" />
          <path d="M9 8h6" />
          <path d="M9 12h5" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7V3Z" />
          <path d="M14 3v5h5" />
          <path d="M10 12h5" />
          <path d="M10 16h4" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4V5Z" />
          <path d="m5 17 5-5 4 4 2-2 3 3" />
          <path d="M15 9h.01" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </svg>
      );
    case "log-out":
      return (
        <svg {...common}>
          <path d="M10 17H5V7h5" />
          <path d="M14 8l4 4-4 4" />
          <path d="M18 12H9" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 19 6v5c0 4-2.5 7-7 10-4.5-3-7-6-7-10V6l7-3Z" />
          <path d="m9.5 12 1.8 1.8 3.7-4" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
          <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
        </svg>
      );
  }
}
