"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import Link from "next/link";
import { clsx } from "clsx";
import { signOut } from "@/app/admin/actions";
import {
  AdminIcon,
  adminEyebrowClass,
  adminPageTitleClass,
  type AdminIconName,
} from "@/components/admin/AdminUi";

type AdminSection =
  | "overview"
  | "pages"
  | "posts"
  | "caseStudies"
  | "forms"
  | "leads"
  | "popups"
  | "chatbot"
  | "analytics"
  | "media"
  | "libraries"
  | "settings"
  | "routes"
  | "attribution";
type AdminShellIconName = Extract<
  AdminIconName,
  | "archive"
  | "book"
  | "crown"
  | "file"
  | "help"
  | "image"
  | "layers"
  | "list"
  | "mail"
  | "megaphone"
  | "message-square"
  | "log-out"
  | "search"
  | "settings"
  | "shield"
  | "target"
>;

type AdminNavSection = {
  id: AdminSection;
  label: string;
  href: string;
  description: string;
  icon: AdminShellIconName;
};

const blogSection: AdminNavSection = {
  id: "posts",
  label: "Blog and news",
  href: "/admin/news",
  description: "Articles and updates",
  icon: "book",
};

const caseStudiesSection: AdminNavSection = {
  id: "caseStudies",
  label: "Case studies",
  href: "/admin/case-studies",
  description: "Member video stories",
  icon: "crown",
};

const contentSections: AdminNavSection[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/admin",
    description: "Studio overview",
    icon: "list",
  },
  {
    id: "pages",
    label: "SEO pages",
    href: "/admin/pages",
    description: "SEO page content",
    icon: "file",
  },
  blogSection,
  caseStudiesSection,
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
    id: "popups",
    label: "Popups",
    href: "/admin/popups",
    description: "Site popup campaigns",
    icon: "megaphone",
  },
  {
    id: "chatbot",
    label: "Chatbot",
    href: "/admin/chatbot",
    description: "AI setter config & transcripts",
    icon: "message-square",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/admin/analytics",
    description: "Reporting & conversion",
    icon: "search",
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
  {
    id: "attribution",
    label: "Attribution health",
    href: "/admin/attribution",
    description: "Where leads come from",
    icon: "shield",
  },
];

const sections = [...contentSections, ...accountSections];

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
    <div
      data-admin-ui
      className="bg-ui-canvas text-ui-text min-h-screen overflow-x-hidden"
    >
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
    <div className="border-ui-line bg-ui-surface sticky top-0 z-50 border-b px-4 py-2.5 xl:hidden">
      <details>
        <summary className="text-ui-text flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="text-ui-text-subtle block text-xs">
              Vendingpreneurs Studio
            </span>
            <span className="block truncate font-semibold">{activeLabel}</span>
          </span>
          <span className="text-ui-text-subtle" aria-hidden="true">
            <AdminChevron />
          </span>
        </summary>
        <div className="border-ui-line mt-4 grid gap-4 border-t pt-4">
          <AdminMobileNavList
            activeSection={activeSection}
            ariaLabel="Admin sections"
            sections={contentSections}
          />
          <AdminMobileNavList
            activeSection={activeSection}
            ariaLabel="Account sections"
            className="border-ui-line border-t pt-4"
            sections={accountSections}
          />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-ui border-ui-line-strong bg-ui-surface text-ui-text shadow-ui flex w-full items-center gap-2.5 border px-3 py-2 text-left text-sm font-medium"
            >
              <span className="text-ui-text-subtle" aria-hidden="true">
                <AdminIcon icon="log-out" />
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
    // N1: the root layout (src/app/layout.tsx) owns the main#main-content
    // landmark that wraps every page, so rendering this sidebar as an aside
    // element nested a complementary landmark inside main and tripped axe's
    // landmark-complementary-is-top-level on every /admin route. A plain div
    // keeps the visuals; the inner nav labelled "Admin sections" remains the
    // discoverable landmark (same fix class as AdminLeadsManager I2 and
    // NewsEditorForm S5 — see AdminShell.landmarks.test.ts).
    <div className="border-ui-line bg-ui-sidebar relative hidden border-b xl:sticky xl:top-0 xl:block xl:h-screen xl:border-r xl:border-b-0">
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggleCollapsed}
        className="border-ui-line bg-ui-surface text-ui-text-subtle shadow-ui hover:text-ui-text absolute top-4 right-0 z-10 inline-flex size-6 translate-x-1/2 items-center justify-center rounded-full border transition"
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
          "flex h-full flex-col overflow-y-auto pt-4 pb-3 transition-[padding] duration-200",
          collapsed ? "px-2" : "px-3",
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
    </div>
  );
}

/* Type only. A blue tile with a letter in it is placeholder chrome, and
   "Studio / Admin CMS" named the same tool twice in eleven characters. */
function AdminDesktopBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={clsx(
        "flex min-w-0 items-center px-2",
        collapsed && "justify-center",
      )}
    >
      {collapsed ? (
        <span
          className="text-ui-text text-sm font-semibold"
          title="Vendingpreneurs Studio"
        >
          VP
        </span>
      ) : (
        <div className="min-w-0">
          <h2 className="text-ui-text truncate text-sm font-semibold">
            Vendingpreneurs
          </h2>
          <p className="text-ui-text-subtle text-xs">Studio</p>
        </div>
      )}
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
        "border-ui-line border-t pt-3",
        collapsed ? "mt-3" : "mt-4",
      )}
    >
      <p
        className={clsx(
          "text-ui-text-subtle mb-1.5 px-2 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase",
          collapsed && "sr-only",
        )}
      >
        {label}
      </p>
      <nav aria-label={ariaLabel} className="grid gap-0.5">
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
    // Selection is carried by a soft accent fill, not a coloured edge bar.
    <Link
      href={section.href}
      title={
        collapsed ? section.label : `${section.label}: ${section.description}`
      }
      aria-current={isActive ? "page" : undefined}
      className={clsx(
        "rounded-ui flex min-w-0 items-center py-1.5 text-[0.8125rem] transition",
        collapsed ? "justify-center px-2" : "gap-2.5 px-2",
        isActive
          ? "bg-ui-accent-soft text-ui-accent font-medium"
          : "text-ui-text-muted hover:bg-ui-line/50 hover:text-ui-text font-normal",
      )}
    >
      <span
        className={clsx(
          "flex size-4 shrink-0 items-center justify-center [&_svg]:size-4",
          isActive ? "text-ui-accent" : "text-ui-text-subtle",
        )}
        aria-hidden="true"
      >
        <AdminIcon icon={section.icon} />
      </span>
      <span className={clsx("min-w-0 truncate", collapsed && "hidden")}>
        {section.label}
        <span className="sr-only">
          {": "}
          {section.description}
        </span>
      </span>
    </Link>
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
    <div className="border-ui-line mt-auto border-t pt-3">
      <nav
        aria-label="Account settings"
        className={clsx("mb-3 grid gap-0.5", collapsed && "mb-4")}
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
          <div className="bg-ui-line text-ui-text-muted flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold">
            {adminInitials(userEmail)}
          </div>
          <p
            className={clsx("min-w-0 text-xs leading-4", collapsed && "hidden")}
          >
            <span className="text-ui-text block truncate font-medium">
              {userEmail}
            </span>
            {roleLabel ? (
              <span className="text-ui-text-subtle block truncate">
                {roleLabel}
              </span>
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
          "rounded-ui text-ui-text-muted hover:bg-ui-line/50 hover:text-ui-text mb-0.5 flex w-full items-center py-1.5 text-left text-[0.8125rem] transition",
          collapsed ? "justify-center px-2" : "gap-2.5 px-2",
        )}
      >
        <span
          className="text-ui-text-subtle flex size-4 items-center justify-center [&_svg]:size-4"
          aria-hidden="true"
        >
          <AdminIcon icon="help" />
        </span>
        <span className={clsx(collapsed && "hidden")}>Help &amp; support</span>
      </a>
      <form action={signOut}>
        <button
          type="submit"
          title={collapsed ? "Sign out" : undefined}
          className={clsx(
            "rounded-ui text-ui-text-muted hover:bg-ui-line/50 hover:text-ui-text flex w-full items-center py-1.5 text-left text-[0.8125rem] transition",
            collapsed ? "justify-center px-2" : "gap-2.5 px-2",
          )}
        >
          <span
            className="text-ui-text-subtle flex size-4 items-center justify-center [&_svg]:size-4"
            aria-hidden="true"
          >
            <AdminIcon icon="log-out" />
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
        immersive ? "p-0" : "px-5 py-5 sm:px-6 xl:px-8",
      )}
    >
      {immersive ? (
        <h1 id="admin-shell-title" className="sr-only">
          {title}
        </h1>
      ) : null}
      {!immersive && (
        <header className="mb-4">
          {eyebrow ? (
            <p className={`${adminEyebrowClass} mb-1.5`}>{eyebrow}</p>
          ) : null}
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <h1 id="admin-shell-title" className={adminPageTitleClass}>
                {title}
              </h1>
              {description ? (
                <p className="text-ui-text-muted mt-1 text-sm leading-6">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
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
          "rounded-ui flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[0.8125rem] transition disabled:cursor-not-allowed disabled:opacity-60",
          tone === "danger"
            ? "text-ui-bad hover:bg-ui-bad/5"
            : "text-ui-text-muted hover:bg-ui-line/50 hover:text-ui-text",
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
              <div
                data-admin-ui
                className="rounded-ui-lg border-ui-line bg-ui-surface shadow-ui-raised w-full max-w-sm border p-5"
              >
                <h2
                  id={confirmTitleId}
                  className="text-ui-text text-base font-semibold"
                >
                  {confirmTitle}
                </h2>
                <p className="text-ui-text-muted mt-2 text-sm leading-6 whitespace-pre-line">
                  {confirmMessage}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    ref={cancelButtonRef}
                    type="button"
                    disabled={pending}
                    className="rounded-ui border-ui-line-strong bg-ui-surface text-ui-text shadow-ui hover:bg-ui-canvas inline-flex h-9 items-center border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={closeConfirmDialog}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-busy={pending ? "true" : undefined}
                    className={clsx(
                      "rounded-ui shadow-ui inline-flex h-9 items-center px-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-70",
                      tone === "danger"
                        ? "bg-ui-bad hover:brightness-110"
                        : "bg-ui-accent hover:bg-ui-accent-hover",
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
    <Link
      href={section.href}
      title={`${section.label}: ${section.description}`}
      aria-current={isActive ? "page" : undefined}
      className={clsx(
        "rounded-ui flex min-w-0 items-center gap-2.5 px-2.5 py-2 text-sm transition",
        isActive
          ? "bg-ui-accent-soft text-ui-accent font-medium"
          : "text-ui-text-muted",
      )}
    >
      <span
        className={clsx(
          "flex size-4 shrink-0 items-center justify-center [&_svg]:size-4",
          isActive ? "text-ui-accent" : "text-ui-text-subtle",
        )}
        aria-hidden="true"
      >
        <AdminIcon icon={section.icon} />
      </span>
      <span className="min-w-0 flex-1 truncate">
        {section.label}
        <span className="sr-only">
          {": "}
          {section.description}
        </span>
      </span>
    </Link>
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
