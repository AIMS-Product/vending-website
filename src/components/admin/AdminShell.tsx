"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import Link from "next/link";
import { clsx } from "clsx";
import { signOut } from "@/app/admin/actions";

type AdminSection = "pages" | "posts" | "media" | "libraries" | "settings";
type AdminIcon =
  | "archive"
  | "book"
  | "file"
  | "image"
  | "layers"
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
  {
    id: "media",
    label: "Media library",
    href: "/admin/media",
    description: "Images and source assets",
    icon: "image",
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
];

const sections = [...contentSections, ...accountSections];

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
  eyebrow?: string;
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
    (activeSection === blogSection.id
      ? blogSection.label
      : sections.find((section) => section.id === activeSection)?.label) ??
    "Studio";
  const roleLabel = userRole ? formatAdminRole(userRole) : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f8fb] text-[#0f172a]">
      {!immersive && (
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
              <nav aria-label="Admin sections" className="grid gap-1.5">
                {contentSections.map((section) => (
                  <MobileNavLink
                    key={section.id}
                    section={section}
                    isActive={activeSection === section.id}
                  />
                ))}
              </nav>
              <nav
                aria-label="Account sections"
                className="grid gap-1.5 border-t border-slate-200 pt-4"
              >
                {accountSections.map((section) => (
                  <MobileNavLink
                    key={section.id}
                    section={section}
                    isActive={activeSection === section.id}
                  />
                ))}
              </nav>
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
          <aside className="relative hidden border-b border-slate-200 bg-white/95 backdrop-blur xl:sticky xl:top-0 xl:block xl:h-screen xl:border-r xl:border-b-0">
            <button
              type="button"
              aria-label={
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="absolute top-5 right-0 z-10 inline-flex size-8 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
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
            <div
              className={clsx(
                "flex h-full flex-col overflow-y-auto pt-5 pb-4 transition-[padding] duration-200",
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
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#0b63f6] text-base font-semibold text-white shadow-sm">
                    S
                  </div>
                  <div
                    className={clsx("min-w-0", sidebarCollapsed && "hidden")}
                  >
                    <h2 className="text-sm font-semibold text-slate-950">
                      Studio
                    </h2>
                    <p className="text-xs text-slate-500">Admin CMS</p>
                  </div>
                </div>
              </div>

              <div
                className={clsx(
                  "border-t border-slate-200 pt-4",
                  sidebarCollapsed ? "mt-4" : "mt-5",
                )}
              >
                <p
                  className={clsx(
                    "mb-2 px-2 text-xs font-semibold text-slate-500 uppercase",
                    sidebarCollapsed && "sr-only",
                  )}
                >
                  Content
                </p>
                <nav aria-label="Admin sections" className="grid gap-1">
                  {contentSections.map((section) => (
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
                        title={
                          sidebarCollapsed
                            ? section.label
                            : `${section.label}: ${section.description}`
                        }
                        className={clsx(
                          "flex min-w-0 flex-1 items-center rounded-md py-2 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none",
                          sidebarCollapsed
                            ? "justify-center px-2"
                            : "gap-2 px-3",
                        )}
                        aria-current={
                          activeSection === section.id ? "page" : undefined
                        }
                      >
                        <span
                          className={clsx(
                            "flex size-6 shrink-0 items-center justify-center rounded-md",
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
                          <span className="sr-only">
                            {": "}
                            {section.description}
                          </span>
                        </span>
                      </Link>
                    </div>
                  ))}
                </nav>
              </div>

              <div className="mt-auto border-t border-slate-200 pt-4">
                <nav
                  aria-label="Account settings"
                  className={clsx(
                    "mb-3 grid gap-1",
                    sidebarCollapsed && "mb-4",
                  )}
                >
                  {accountSections.map((section) => (
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
                        title={
                          sidebarCollapsed
                            ? section.label
                            : `${section.label}: ${section.description}`
                        }
                        className={clsx(
                          "flex min-w-0 flex-1 items-center rounded-md py-2 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none",
                          sidebarCollapsed
                            ? "justify-center px-2"
                            : "gap-2 px-3",
                        )}
                        aria-current={
                          activeSection === section.id ? "page" : undefined
                        }
                      >
                        <span
                          className={clsx(
                            "flex size-6 shrink-0 items-center justify-center rounded-md",
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
                          <span className="sr-only">
                            {": "}
                            {section.description}
                          </span>
                        </span>
                      </Link>
                    </div>
                  ))}
                </nav>
                {userEmail ? (
                  <div
                    className={clsx(
                      "mb-3 flex items-center gap-2 px-2",
                      sidebarCollapsed && "justify-center",
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-800">
                      {adminInitials(userEmail)}
                    </div>
                    <p
                      className={clsx(
                        "min-w-0 text-xs leading-4 text-slate-500",
                        sidebarCollapsed && "hidden",
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
                <form action={signOut}>
                  <button
                    type="submit"
                    title={sidebarCollapsed ? "Sign out" : undefined}
                    className={clsx(
                      "flex w-full items-center rounded-md border border-slate-200 bg-white py-2.5 text-left text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none",
                      sidebarCollapsed ? "justify-center px-2" : "gap-2 px-3",
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
        )}

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
              <div
                className={clsx(
                  "mb-4 flex items-center gap-4",
                  eyebrow ? "justify-between" : "justify-end",
                )}
              >
                {eyebrow ? (
                  <div className="flex items-center gap-3 text-sm font-semibold text-[#0b63f6]">
                    <span>{eyebrow}</span>
                    <span className="text-slate-400" aria-hidden="true">
                      <AdminChevron />
                    </span>
                  </div>
                ) : null}
                <div className="flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm">
                  <span className="text-slate-700" aria-hidden="true">
                    <AdminIconGlyph icon="shield" />
                  </span>
                  {roleLabel ? `${roleLabel} access` : "Admin access"}
                </div>
              </div>
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

export function AdminPageActionButton({
  label,
  tone = "default",
  confirmMessage,
}: {
  label: string;
  tone?: "default" | "danger";
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  const confirmTitleId = useId();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsConfirmOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusableElements = getDialogFocusableElements(dialog);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    dialog?.addEventListener("keydown", handleKeyDown);
    cancelButtonRef.current?.focus();

    return () => {
      dialog?.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isConfirmOpen]);

  function closeConfirmDialog() {
    setIsConfirmOpen(false);
  }

  function submitConfirmedAction() {
    confirmedSubmitRef.current = true;
    buttonRef.current?.click();
    confirmedSubmitRef.current = false;
    setIsConfirmOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        disabled={pending}
        onClick={(event) => {
          if (confirmMessage && !confirmedSubmitRef.current) {
            event.preventDefault();
            setIsConfirmOpen(true);
          }
        }}
        className={clsx(
          "block w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
          tone === "danger"
            ? "text-red-700 hover:bg-red-50"
            : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
        )}
      >
        {pending ? "Working..." : label}
      </button>
      {isConfirmOpen &&
        createPortal(
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 py-6"
          >
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
                  className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none"
                  onClick={closeConfirmDialog}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={clsx(
                    "inline-flex min-h-10 items-center rounded-md px-4 text-sm font-semibold text-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none",
                    tone === "danger"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-[#0b63f6] hover:bg-[#0756d6]",
                  )}
                  onClick={submitConfirmedAction}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function getDialogFocusableElements(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
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
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.8,
    className: "size-5",
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
    case "settings":
      return (
        <svg {...common}>
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
