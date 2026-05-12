import type { ReactNode } from "react";

export type AdminIconName =
  | "archive"
  | "check"
  | "file"
  | "filter"
  | "image"
  | "layers"
  | "list"
  | "more"
  | "newspaper"
  | "pencil"
  | "plus"
  | "search"
  | "upload";

export const adminPanelClass =
  "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm";

export const adminCardClass =
  "rounded-lg border border-slate-200 bg-white p-5 shadow-sm";

export const adminInputClass =
  "mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-[#0b63f6] focus:ring-2 focus:ring-[#0b63f6]/15";

export const adminTextareaClass =
  "mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-[#0b63f6] focus:ring-2 focus:ring-[#0b63f6]/15";

export const adminLabelClass = "text-sm font-medium text-slate-700";

export const adminPrimaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#0b63f6] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0756d6] focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const adminSecondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const adminSmallButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const adminTinyButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const adminDangerButtonClass =
  "inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:outline-none";

export function AdminMetricStrip({ children }: { children: ReactNode }) {
  return (
    <section className={`${adminPanelClass} mb-7`} aria-label="Admin summary">
      <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
        {children}
      </div>
    </section>
  );
}

export function AdminMetricPanel({
  icon,
  tone,
  label,
  value,
  caption,
}: {
  icon: AdminIconName;
  tone: "amber" | "blue" | "green" | "purple" | "slate";
  label: string;
  value: number | string;
  caption: string;
}) {
  return (
    <div className="flex items-center gap-5 px-6 py-5">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${adminMetricToneClass(
          tone,
        )}`}
        aria-hidden="true"
      >
        <AdminIcon icon={icon} />
      </span>
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
          {value}
        </p>
        <p className="text-sm text-slate-500">{caption}</p>
      </div>
    </div>
  );
}

export function AdminStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${adminStatusClass(
        status,
      )}`}
    >
      {formatAdminStatus(status)}
    </span>
  );
}

export function AdminIcon({ icon }: { icon: AdminIconName }) {
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.9,
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
    case "check":
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
          <path d="m8.8 12.2 2 2 4.4-4.6" />
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
    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" />
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
    case "list":
      return (
        <svg {...common}>
          <path d="M8 6h12" />
          <path d="M8 12h12" />
          <path d="M8 18h12" />
          <path d="M4 6h.01" />
          <path d="M4 12h.01" />
          <path d="M4 18h.01" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <path d="M12 5h.01" />
          <path d="M12 12h.01" />
          <path d="M12 19h.01" />
        </svg>
      );
    case "newspaper":
      return (
        <svg {...common}>
          <path d="M5 5h12a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2V5Z" />
          <path d="M8 9h8" />
          <path d="M8 13h3" />
          <path d="M13 13h3" />
          <path d="M8 17h8" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
          <path d="m14 7 3 3" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <path d="m21 21-4.3-4.3" />
          <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
      );
  }
}

export function adminMetricToneClass(
  tone: "amber" | "blue" | "green" | "purple" | "slate",
) {
  if (tone === "amber") return "bg-amber-100 text-amber-600";
  if (tone === "green") return "bg-emerald-100 text-emerald-600";
  if (tone === "purple") return "bg-violet-100 text-violet-600";
  if (tone === "slate") return "bg-slate-100 text-slate-600";
  return "bg-[#e9f1ff] text-[#0b63f6]";
}

export function adminStatusClass(status: string) {
  if (status === "published" || status === "approved" || status === "stored") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "archived" || status === "external") {
    return "bg-slate-100 text-slate-600";
  }
  if (status === "high") return "bg-red-100 text-red-700";
  if (status === "medium") return "bg-amber-100 text-amber-700";
  return "bg-amber-100 text-amber-700";
}

function formatAdminStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}
