"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import Link from "next/link";
import { clsx } from "clsx";
import { signOut } from "@/app/admin/actions";

type AdminSection =
  | "pages"
  | "posts"
  | "forms"
  | "leads"
  | "media"
  | "libraries"
  | "settings"
  | "routes";
type AdminIcon =
  | "archive"
  | "book"
  | "file"
  | "help"
  | "image"
  | "layers"
  | "mail"
  | "log-out"
  | "settings"
  | "shield"
  | "target";

type AdminNavSection = {
  id: AdminSection;
  label: string;
  href: string;
  description: string;
  icon: AdminIcon;
};

const blogSection: AdminNavSection = {
  id: "posts",
  label: "Blog and news",
  href: "/admin/news",
  description: "Articles and updates",
  icon: "book",
};

const contentSections: AdminNavSection[] = [
  {
    id: "pages",
    label: "SEO pages",
    href: "/admin/pages",
    description: "SEO page content",
    icon: "file",
  },
  blogSection,
  {
    id: "forms",
    label: "Qualification forms",
    href: "/admin/forms",
    description: "Post-submit intake forms",
    icon: "target",
  },
  {
    id: "leads",
    label: "Leads",
    href: "/admin/leads",
    description: "Qualification ops",
    icon: "mail",
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
    description: "Reusable content collections",
    icon: "archive",
  },
];

const accountSections: AdminNavSection[] = [
  {
    id: "settings",
    label: "Settings",
    href: "/admin/settings/users",
    description: "Users and access",
    icon: "settings",
  },
  {
    id: "routes",
    label: "Route prefixes",
    href: "/admin/settings/routes",
    description: "Builder URL prefixes",
    icon: "layers",
  },
];

const sections = [...contentSections, ...accountSections];

const adminIconGlyphCommonProps = {
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.8,
  className: "size-5",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type AdminShellProps = {
  activeSection: AdminSection;
  eyebrow?: string;
  title: string;
  description?: string;
  userEmail?: string | null;
  userRole?: string | null;
  actions?: ReactNode;
  immersive?: boolean;
  children: ReactNode;
};

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
}: AdminShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeLabel = getAdminActiveLabel(activeSection);
  const roleLabel = userRole ? formatAdminRole(userRole) : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f8fb] text-[#0f172a]">
      {!immersive && (
        <AdminMobileNav
          activeLabel={activeLabel}
          activeSection={activeSection}
        />
      )}
      <div
        className={clsx(
          "grid w-full transition-[grid-template-columns] duration-200 xl:min-h-screen",
          !immersive &&
            (sidebarCollapsed
              ? "xl:grid-cols-[76px_minmax(0,1fr)]"
              : "xl:grid-cols-[236px_minmax(0,1fr)] 2xl:grid-cols-[252px_minmax(0,1fr)]"),
        )}
      >
        {!immersive && (
          <AdminDesktopSidebar
            activeSection={activeSection}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            roleLabel={roleLabel}
            userEmail={userEmail}
          />
        )}

        <AdminShellContent
          actions={actions}
          description={description}
          eyebrow={eyebrow}
          immersive={immersive}
          title={title}
        >
          {children}
        </AdminShellContent>
      </div>
    </div>
  );
}

function getAdminActiveLabel(activeSection: AdminSection) {
  return (
    (activeSection === blogSection.id
      ? blogSection.label
      : sections.find((section) => section.id === activeSection)?.label) ??
    "Studio"
  );
}

function AdminMobileNav({
  activeLabel,
  activeSection,
}: {
  activeLabel: string;
  activeSection: AdminSection;
}) {
  return (
    <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur xl:hidden">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-950 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#0b63f6] text-sm font-semibold text-white">
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
          <AdminMobileNavList
            activeSection={activeSection}
            ariaLabel="Admin sections"
            sections={contentSections}
          />
          <AdminMobileNavList
            activeSection={activeSection}
            ariaLabel="Account sections"
            className="border-t border-slate-200 pt-4"
            sections={accountSections}
          />
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-950 shadow-sm"
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
  );
}

function AdminMobileNavList({
  activeSection,
  ariaLabel,
  className,
  sections: navSections,
}: {
  activeSection: AdminSection;
  ariaLabel: string;
  className?: string;
  sections: AdminNavSection[];
}) {
  return (
    <nav aria-label={ariaLabel} className={clsx("grid gap-1.5", className)}>
      {navSections.map((section) => (
        <MobileNavLink
          key={section.id}
          section={section}
          isActive={activeSection === section.id}
        />
      ))}
    </nav>
  );
}

function AdminDesktopSidebar({
  activeSection,
  collapsed,
  onToggleCollapsed,
  roleLabel,
  userEmail,
}: {
  activeSection: AdminSection;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  roleLabel: string | null;
  userEmail?: string | null;
}) {
  return (
    <aside className="relative hidden border-b border-slate-200 bg-white/95 backdrop-blur xl:sticky xl:top-0 xl:block xl:h-screen xl:border-r xl:border-b-0">
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggleCollapsed}
        className="absolute top-5 right-0 z-10 inline-flex size-8 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
      >
        <span
          className={clsx(
            "transition-transform",
            collapsed ? "rotate-180" : "",
          )}
          aria-hidden="true"
        >
          <AdminChevron />
        </span>
      </button>
      <div
        className={clsx(
          "flex h-full flex-col overflow-y-auto pt-5 pb-4 transition-[padding] duration-200",
          collapsed ? "px-3" : "px-4",
        )}
      >
        <AdminDesktopBrand collapsed={collapsed} />
        <AdminDesktopNavGroup
          activeSection={activeSection}
          ariaLabel="Admin sections"
          collapsed={collapsed}
          label="Content"
          sections={contentSections}
        />
        <AdminAccountBlock
          activeSection={activeSection}
          collapsed={collapsed}
          roleLabel={roleLabel}
          userEmail={userEmail}
        />
      </div>
    </aside>
  );
}

function AdminDesktopBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-2">
      <div
        className={clsx(
          "flex min-w-0 items-start gap-3",
          collapsed && "justify-center",
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#0b63f6] text-base font-semibold text-white shadow-sm">
          S
        </div>
        <div className={clsx("min-w-0", collapsed && "hidden")}>
          <h2 className="text-sm font-semibold text-slate-950">Studio</h2>
          <p className="text-xs text-slate-500">Admin CMS</p>
        </div>
      </div>
    </div>
  );
}

function AdminDesktopNavGroup({
  activeSection,
  ariaLabel,
  collapsed,
  label,
  sections: navSections,
}: {
  activeSection: AdminSection;
  ariaLabel: string;
  collapsed: boolean;
  label: string;
  sections: AdminNavSection[];
}) {
  return (
    <div
      className={clsx(
        "border-t border-slate-200 pt-4",
        collapsed ? "mt-4" : "mt-5",
      )}
    >
      <p
        className={clsx(
          "mb-2 px-2 text-xs font-semibold text-slate-500 uppercase",
          collapsed && "sr-only",
        )}
      >
        {label}
      </p>
      <nav aria-label={ariaLabel} className="grid gap-1">
        {navSections.map((section) => (
          <AdminDesktopNavItem
            key={section.id}
            collapsed={collapsed}
            isActive={activeSection === section.id}
            section={section}
          />
        ))}
      </nav>
    </div>
  );
}

function AdminDesktopNavItem({
  collapsed,
  isActive,
  section,
}: {
  collapsed: boolean;
  isActive: boolean;
  section: AdminNavSection;
}) {
  return (
    <div
      className={clsx(
        "group flex items-center gap-2 rounded-md border text-sm transition",
        isActive
          ? "border-[#cfe0ff] bg-[#f4f8ff] shadow-[inset_3px_0_0_#0b63f6]"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950",
      )}
    >
      <Link
        href={section.href}
        title={
          collapsed ? section.label : `${section.label}: ${section.description}`
        }
        className={clsx(
          "flex min-w-0 flex-1 items-center rounded-md py-2 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none",
          collapsed ? "justify-center px-2" : "gap-2 px-3",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <span
          className={clsx(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            isActive ? "text-[#0b63f6]" : "text-slate-500",
          )}
          aria-hidden="true"
        >
          <AdminIconGlyph icon={section.icon} />
        </span>
        <span className={clsx("min-w-0", collapsed && "hidden")}>
          <span className="block font-semibold text-slate-950">
            {section.label}
          </span>
          <span className="sr-only">
            {": "}
            {section.description}
          </span>
        </span>
      </Link>
    </div>
  );
}

function AdminAccountBlock({
  activeSection,
  collapsed,
  roleLabel,
  userEmail,
}: {
  activeSection: AdminSection;
  collapsed: boolean;
  roleLabel: string | null;
  userEmail?: string | null;
}) {
  return (
    <div className="mt-auto border-t border-slate-200 pt-4">
      <nav
        aria-label="Account settings"
        className={clsx("mb-3 grid gap-1", collapsed && "mb-4")}
      >
        {accountSections.map((section) => (
          <AdminDesktopNavItem
            key={section.id}
            collapsed={collapsed}
            isActive={activeSection === section.id}
            section={section}
          />
        ))}
      </nav>
      {userEmail ? (
        <div
          className={clsx(
            "mb-3 flex items-center gap-2 px-2",
            collapsed && "justify-center",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-800">
            {adminInitials(userEmail)}
          </div>
          <p
            className={clsx(
              "min-w-0 text-xs leading-4 text-slate-500",
              collapsed && "hidden",
            )}
          >
            Signed in as
            <span className="block truncate text-sm font-medium text-slate-950">
              {userEmail}
            </span>
            {roleLabel ? (
              <span className="block truncate">{roleLabel}</span>
            ) : null}
          </p>
        </div>
      ) : null}
      {/* N19 / I20 item 2: a minimal help/support entry point. (Round 1 dropped
          this as "internal tool"; the round-2 triage re-included it.) A mailto
          keeps it dependency-free until a docs site exists. */}
      <a
        href="mailto:support@vendingpreneurs.com?subject=SEO%20Page%20Builder%20help"
        title="Help & support"
        className={clsx(
          "mb-2 flex w-full items-center rounded-md py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none",
          collapsed ? "justify-center px-2" : "gap-2 px-3",
        )}
      >
        <span className="text-slate-500" aria-hidden="true">
          <AdminIconGlyph icon="help" />
        </span>
        <span className={clsx(collapsed && "hidden")}>Help &amp; support</span>
      </a>
      <form action={signOut}>
        <button
          type="submit"
          title={collapsed ? "Sign out" : undefined}
          className={clsx(
            "flex w-full items-center rounded-md border border-slate-200 bg-white py-2.5 text-left text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none",
            collapsed ? "justify-center px-2" : "gap-2 px-3",
          )}
        >
          <span className="text-slate-700" aria-hidden="true">
            <AdminIconGlyph icon="log-out" />
          </span>
          <span className={clsx(collapsed && "hidden")}>Sign out</span>
        </button>
      </form>
    </div>
  );
}

function AdminShellContent({
  actions,
  children,
  description,
  eyebrow,
  immersive,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  immersive: boolean;
  title: string;
}) {
  return (
    <section
      aria-labelledby="admin-shell-title"
      className={clsx(
        "min-w-0",
        immersive ? "p-0" : "px-5 py-5 sm:px-8 xl:px-10",
      )}
    >
      {immersive ? (
        <h1 id="admin-shell-title" className="sr-only">
          {title}
        </h1>
      ) : null}
      {!immersive && (
        <header className="mb-5">
          {eyebrow ? (
            <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-[#0b63f6]">
              <span>{eyebrow}</span>
              <span className="text-slate-400" aria-hidden="true">
                <AdminChevron />
              </span>
            </div>
          ) : null}
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <h1
                id="admin-shell-title"
                className="text-3xl font-semibold tracking-normal text-slate-950"
              >
                {title}
              </h1>
              {description ? (
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-3">{actions}</div>
            ) : null}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

export function AdminPageActionButton({
  label,
  pendingLabel = "Working...",
  tone = "default",
  confirmMessage,
}: {
  label: string;
  pendingLabel?: string;
  tone?: "default" | "danger";
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  const confirmTitleId = useId();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const confirmedSubmitRef = useRef(false);

  const confirmTitle =
    tone === "danger" ? `Confirm ${label.toLowerCase()}` : "Confirm action";

  useEffect(() => {
    if (!isConfirmOpen) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    cancelButtonRef.current?.focus();

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isConfirmOpen]);

  function closeConfirmDialog() {
    if (pending) return;
    setIsConfirmOpen(false);
  }

  function submitConfirmedAction() {
    confirmedSubmitRef.current = true;
    if (buttonRef.current?.form) {
      buttonRef.current.form.requestSubmit(buttonRef.current);
    }
    confirmedSubmitRef.current = false;
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        disabled={pending}
        aria-busy={pending ? "true" : undefined}
        onClick={(event) => {
          if (confirmMessage && !confirmedSubmitRef.current) {
            event.preventDefault();
            setIsConfirmOpen(true);
          }
        }}
        className={clsx(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
          tone === "danger"
            ? "text-red-700 hover:bg-red-50"
            : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
        )}
      >
        {/* N17 / I12: a non-colour cue for destructive actions so the danger
            state does not rely on red text alone. */}
        {tone === "danger" ? <DangerActionGlyph /> : null}
        {pending ? pendingLabel : label}
      </button>
      {isConfirmOpen &&
        createPortal(
          <dialog
            ref={dialogRef}
            aria-labelledby={confirmTitleId}
            className="fixed inset-0 z-[100] m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-slate-950/35"
            onCancel={(event) => {
              if (pending) {
                event.preventDefault();
                return;
              }
              setIsConfirmOpen(false);
            }}
          >
            <div className="flex min-h-full items-center justify-center px-4 py-6">
              <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                <h2
                  id={confirmTitleId}
                  className="text-base font-semibold text-slate-950"
                >
                  {confirmTitle}
                </h2>
                <p className="mt-3 text-sm leading-6 whitespace-pre-line text-slate-600">
                  {confirmMessage}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    ref={cancelButtonRef}
                    type="button"
                    disabled={pending}
                    className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={closeConfirmDialog}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-busy={pending ? "true" : undefined}
                    className={clsx(
                      "inline-flex min-h-10 items-center rounded-md px-4 text-sm font-semibold text-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70",
                      tone === "danger"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-[#0b63f6] hover:bg-[#0756d6]",
                    )}
                    onClick={submitConfirmedAction}
                  >
                    {pending ? pendingLabel : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}

// N17 / I12: small triangular warning glyph that gives destructive menu
// actions a non-colour cue alongside the red text.
function DangerActionGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
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

function formatAdminRole(role: string) {
  const normalized = role.split("_").filter(Boolean).join(" ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function MobileNavLink({
  section,
  isActive,
}: {
  section: AdminNavSection;
  isActive: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-md border text-sm transition",
        isActive
          ? "border-[#cfe0ff] bg-[#f4f8ff] text-slate-950"
          : "border-slate-200 bg-white text-slate-600",
      )}
    >
      <Link
        href={section.href}
        title={`${section.label}: ${section.description}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 p-2.5"
        aria-current={isActive ? "page" : undefined}
      >
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#0b63f6]"
          aria-hidden="true"
        >
          <AdminIconGlyph icon={section.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{section.label}</span>
          <span className="sr-only">
            {": "}
            {section.description}
          </span>
        </span>
      </Link>
    </div>
  );
}

function AdminChevron() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
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
  switch (icon) {
    case "archive":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="M4 7h16" />
          <path d="M6 7v11h12V7" />
          <path d="M9 11h6" />
          <path d="M7 4h10l1 3H6l1-3Z" />
        </svg>
      );
    case "book":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z" />
          <path d="M9 8h6" />
          <path d="M9 12h5" />
        </svg>
      );
    case "file":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="M7 3h7l4 4v14H7V3Z" />
          <path d="M14 3v5h5" />
          <path d="M10 12h5" />
          <path d="M10 16h4" />
        </svg>
      );
    case "image":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="M4 5h16v14H4V5Z" />
          <path d="m5 17 5-5 4 4 2-2 3 3" />
          <path d="M15 9h.01" />
        </svg>
      );
    case "layers":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </svg>
      );
    case "mail":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="M4 6h16v12H4V6Z" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "settings":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <circle cx="12" cy="12" r="3.25" />
          <path d="M12 2v2.5" />
          <path d="M12 19.5V22" />
          <path d="M2 12h2.5" />
          <path d="M19.5 12H22" />
          <path d="m4.9 4.9 1.8 1.8" />
          <path d="m17.3 17.3 1.8 1.8" />
          <path d="m4.9 19.1 1.8-1.8" />
          <path d="m17.3 6.7 1.8-1.8" />
        </svg>
      );
    case "help":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "log-out":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="M10 17H5V7h5" />
          <path d="M14 8l4 4-4 4" />
          <path d="M18 12H9" />
        </svg>
      );
    case "shield":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="M12 3 19 6v5c0 4-2.5 7-7 10-4.5-3-7-6-7-10V6l7-3Z" />
          <path d="m9.5 12 1.8 1.8 3.7-4" />
        </svg>
      );
    case "target":
      return (
        <svg {...adminIconGlyphCommonProps}>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
          <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
        </svg>
      );
  }
}
