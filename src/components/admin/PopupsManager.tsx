"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createPopup, type PopupActionState } from "@/app/admin/popups/actions";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";
import { POPUP_TEMPLATES, type Popup } from "@/lib/content/popups";
import type { AdminPopup, PopupEventTotals } from "@/lib/services/popups";

const initialActionState: PopupActionState = { status: "idle" };

export function PopupsManager({
  popups,
  totalsByPopup,
  grandTotals,
  loadError,
}: {
  popups: AdminPopup[];
  totalsByPopup: Record<string, PopupEventTotals>;
  grandTotals: PopupEventTotals;
  loadError: boolean;
}) {
  return (
    <div className="grid gap-5">
      <AdminMetricStrip>
        <AdminMetricPanel
          label="Shown"
          value={grandTotals.shown}
          caption="popup impressions"
        />
        <AdminMetricPanel
          label="CTA clicks"
          value={grandTotals.ctaClicked}
          caption="primary + secondary"
        />
        <AdminMetricPanel
          label="Converted"
          value={grandTotals.converted}
          caption="completed the offer"
        />
        <AdminMetricPanel
          label="Dismissed"
          value={grandTotals.dismissed}
          caption="closed without clicking"
        />
      </AdminMetricStrip>

      <section className={adminPanelClass}>
        <div className="border-ui-line border-b p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="shrink-0 lg:max-w-sm">
              <h2 className="text-ui-text text-base font-semibold">
                Create popup
              </h2>
              <p className="text-ui-text-muted mt-1 text-sm">
                Start from a template, then edit it with a live preview.
              </p>
            </div>
            <CreatePopupForm />
          </div>
        </div>

        {loadError ? (
          <div className="px-5 py-10 text-center">
            <h2 className="text-ui-text text-lg font-semibold">
              Popup storage is not set up yet
            </h2>
            <p className="text-ui-text-muted mt-2 text-sm">
              The popups database table has not been provisioned. Apply the
              popups migration, then reload this page.
            </p>
          </div>
        ) : popups.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <h2 className="text-ui-text text-lg font-semibold">
              No popups yet
            </h2>
            <p className="text-ui-text-muted mt-2 text-sm">
              Create one from a template above. New popups start as drafts and
              never show to visitors until activated.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="divide-ui-line w-full min-w-[820px] divide-y text-left text-sm">
              <thead className="bg-ui-canvas text-ui-text-subtle text-xs font-semibold tracking-normal uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Popup
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Shows when
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Shown
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    CTA clicks
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-ui-line divide-y bg-white">
                {popups.map((entry) => (
                  <PopupRow
                    key={entry.id}
                    entry={entry}
                    totals={totalsByPopup[entry.id]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CreatePopupForm() {
  const [state, formAction] = useActionState(createPopup, initialActionState);
  return (
    <form action={formAction} className="w-full min-w-0 lg:max-w-2xl lg:flex-1">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="sr-only" htmlFor="popup-template">
          Template
        </label>
        <select
          id="popup-template"
          name="template"
          className="border-ui-line text-ui-text focus:border-ui-accent focus:ring-ui-accent/15 h-11 w-full min-w-0 rounded-md border bg-white px-3 text-sm shadow-sm transition outline-none focus:ring-2"
          defaultValue={POPUP_TEMPLATES[0]?.key}
        >
          {POPUP_TEMPLATES.map((template) => (
            <option key={template.key} value={template.key}>
              {template.name} — {template.description}
            </option>
          ))}
        </select>
        <CreateSubmitButton />
      </div>
      {state.status !== "idle" ? (
        <p
          className={`mt-2 text-xs font-medium ${
            state.status === "error" ? "text-red-600" : "text-emerald-700"
          }`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function CreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${adminPrimaryButtonClass} h-11 w-full whitespace-nowrap sm:w-auto`}
    >
      <span aria-hidden="true">
        <AdminIcon icon="plus" />
      </span>
      {pending ? "Creating..." : "Create popup"}
    </button>
  );
}

function PopupRow({
  entry,
  totals,
}: {
  entry: AdminPopup;
  totals: PopupEventTotals | undefined;
}) {
  return (
    <tr>
      <td className="px-5 py-4">
        <Link
          href={`/admin/popups/${entry.id}`}
          className="text-ui-text hover:text-ui-accent font-semibold"
        >
          {entry.popup.headline}
        </Link>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Updated {formatDate(entry.updatedAt)}
        </p>
      </td>
      <td className="px-4 py-4">
        <AdminStatusBadge status={entry.status} />
      </td>
      <td className="text-ui-text-muted px-4 py-4">
        {describeDelivery(entry.popup)}
      </td>
      <td className="text-ui-text-muted px-4 py-4 text-right tabular-nums">
        {totals?.shown ?? 0}
      </td>
      <td className="text-ui-text-muted px-4 py-4 text-right tabular-nums">
        {totals?.ctaClicked ?? 0}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-end">
          <Link
            href={`/admin/popups/${entry.id}`}
            className={adminSmallButtonClass}
          >
            Edit
          </Link>
        </div>
      </td>
    </tr>
  );
}

export function describeTrigger(popup: Popup): string {
  switch (popup.trigger) {
    case "IMMEDIATE":
      return "Immediately";
    case "TIME_ON_PAGE":
      return `After ${popup.triggerThreshold ?? 5}s on page`;
    case "IDLE_TIME":
      return `After ${popup.triggerThreshold ?? 30}s idle`;
    case "SCROLL_DEPTH":
      return `At ${popup.triggerThreshold ?? 50}% scroll`;
    case "EXIT_INTENT":
      return "On exit intent";
  }
}

function describeDelivery(popup: Popup): string {
  const where =
    popup.targetUrlPatterns.length === 0
      ? "every page"
      : popup.targetUrlPatterns.join(", ");
  return `${describeTrigger(popup)} · ${where}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
