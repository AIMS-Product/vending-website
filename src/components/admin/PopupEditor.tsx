"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deletePopup,
  savePopup,
  type PopupActionState,
} from "@/app/admin/popups/actions";
import {
  adminDangerButtonClass,
  adminInputClass,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSectionTitleClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import { PopupCard } from "@/components/site/SitePopup";
import type { Popup } from "@/lib/content/popups";
import type { AdminPopup, PopupStatus } from "@/lib/services/popups";

const initialActionState: PopupActionState = { status: "idle" };

type EditorValues = {
  status: PopupStatus;
  trigger: Popup["trigger"];
  triggerThreshold: string;
  targetUrlPatterns: string;
  frequency: Popup["frequency"];
  eyebrow: string;
  headline: string;
  body: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  featuredValueLabel: string;
  featuredValueValue: string;
  featuredValueNote: string;
  offerCode: string;
  dismissText: string;
  accentColor: string;
};

function initialValues(entry: AdminPopup): EditorValues {
  const popup = entry.popup;
  return {
    status: entry.status,
    trigger: popup.trigger,
    triggerThreshold:
      popup.triggerThreshold == null ? "" : String(popup.triggerThreshold),
    targetUrlPatterns: popup.targetUrlPatterns.join("\n"),
    frequency: popup.frequency,
    eyebrow: popup.eyebrow ?? "",
    headline: popup.headline,
    body: popup.body,
    primaryCtaLabel: popup.primaryCta.label,
    primaryCtaHref: popup.primaryCta.href,
    secondaryCtaLabel: popup.secondaryCta?.label ?? "",
    secondaryCtaHref: popup.secondaryCta?.href ?? "",
    featuredValueLabel: popup.featuredValue?.label ?? "",
    featuredValueValue: popup.featuredValue?.value ?? "",
    featuredValueNote: popup.featuredValue?.note ?? "",
    offerCode: popup.offerCode ?? "",
    dismissText: popup.dismissText ?? "",
    accentColor: popup.accentColor ?? "",
  };
}

/** The preview is the exported `PopupCard` fed from the current form state —
 *  the same component visitors see, never a second rendering codepath. */
function previewPopup(id: string, values: EditorValues): Popup {
  return {
    id,
    active: true,
    trigger: values.trigger,
    triggerThreshold:
      values.triggerThreshold.trim() === ""
        ? null
        : Number(values.triggerThreshold),
    targetUrlPatterns: [],
    frequency: values.frequency,
    eyebrow: values.eyebrow.trim() || null,
    headline: values.headline.trim() || "Headline",
    body: values.body.trim() || "Body copy appears here.",
    primaryCta: {
      label: values.primaryCtaLabel.trim() || "Call to action",
      href: values.primaryCtaHref.trim() || "/contact",
    },
    secondaryCta:
      values.secondaryCtaLabel.trim() && values.secondaryCtaHref.trim()
        ? {
            label: values.secondaryCtaLabel.trim(),
            href: values.secondaryCtaHref.trim(),
          }
        : null,
    featuredValue:
      values.featuredValueLabel.trim() && values.featuredValueValue.trim()
        ? {
            label: values.featuredValueLabel.trim(),
            value: values.featuredValueValue.trim(),
            note: values.featuredValueNote.trim() || null,
          }
        : null,
    offerCode: values.offerCode.trim() || null,
    dismissText: values.dismissText.trim() || null,
    accentColor: /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
      values.accentColor.trim(),
    )
      ? values.accentColor.trim()
      : null,
  };
}

const STATUS_OPTIONS: { value: PopupStatus; label: string; hint: string }[] = [
  { value: "draft", label: "Draft", hint: "Never shown to visitors" },
  { value: "active", label: "Active", hint: "Live on the site" },
  { value: "paused", label: "Paused", hint: "Temporarily off" },
];

export function PopupEditor({ entry }: { entry: AdminPopup }) {
  const [values, setValues] = useState(() => initialValues(entry));
  const [saveState, saveAction] = useActionState(savePopup, initialActionState);

  const set =
    <Key extends keyof EditorValues>(key: Key) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setValues((prev) => ({ ...prev, [key]: event.target.value }));

  const thresholdHint =
    values.trigger === "SCROLL_DEPTH"
      ? "Percent of the page scrolled (e.g. 50)."
      : values.trigger === "TIME_ON_PAGE" || values.trigger === "IDLE_TIME"
        ? "Seconds before the popup shows."
        : "Not used by this trigger.";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,26rem)]">
      <form action={saveAction} className={`${adminPanelClass} min-w-0`}>
        <input type="hidden" name="id" value={entry.id} />
        <input type="hidden" name="status" value={values.status} />

        <div className="border-ui-line border-b p-4">
          <h2 className={adminSectionTitleClass}>Status</h2>
          <div
            className="border-ui-line-strong mt-2 inline-flex overflow-hidden rounded-md border"
            role="group"
            aria-label="Popup status"
          >
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setValues((prev) => ({ ...prev, status: option.value }))
                }
                aria-pressed={values.status === option.value}
                title={option.hint}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  values.status === option.value
                    ? "bg-ui-accent text-white"
                    : "text-ui-text-muted hover:bg-ui-canvas bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-ui-text-subtle mt-1.5 text-xs">
            {STATUS_OPTIONS.find((option) => option.value === values.status)
              ?.hint ?? ""}
            {values.status === "active"
              ? " Saving makes this popup visible to visitors within ~5 minutes."
              : ""}
          </p>
        </div>

        <div className="grid gap-4 p-4">
          <h2 className={adminSectionTitleClass}>Content</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={adminLabelClass}>
              Eyebrow <span className="text-ui-text-subtle">(optional)</span>
              <input
                name="eyebrow"
                value={values.eyebrow}
                onChange={set("eyebrow")}
                placeholder="Before you go"
                className={adminInputClass}
              />
            </label>
            <label className={adminLabelClass}>
              Accent colour{" "}
              <span className="text-ui-text-subtle">(optional hex)</span>
              <input
                name="accentColor"
                value={values.accentColor}
                onChange={set("accentColor")}
                placeholder="#f47b3b"
                className={adminInputClass}
              />
            </label>
          </div>
          <label className={adminLabelClass}>
            Headline
            <input
              name="headline"
              required
              value={values.headline}
              onChange={set("headline")}
              className={adminInputClass}
            />
          </label>
          <label className={adminLabelClass}>
            Body copy
            <textarea
              name="body"
              required
              rows={3}
              value={values.body}
              onChange={set("body")}
              className={adminTextareaClass}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={adminLabelClass}>
              Offer code <span className="text-ui-text-subtle">(optional)</span>
              <input
                name="offerCode"
                value={values.offerCode}
                onChange={set("offerCode")}
                placeholder="VENDING50"
                className={adminInputClass}
              />
            </label>
            <label className={adminLabelClass}>
              Dismiss link text{" "}
              <span className="text-ui-text-subtle">(optional)</span>
              <input
                name="dismissText"
                value={values.dismissText}
                onChange={set("dismissText")}
                placeholder="No thanks, I'm just browsing"
                className={adminInputClass}
              />
            </label>
          </div>

          <h2 className={`${adminSectionTitleClass} mt-2`}>Buttons</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={adminLabelClass}>
              Primary button label
              <input
                name="primaryCtaLabel"
                required
                value={values.primaryCtaLabel}
                onChange={set("primaryCtaLabel")}
                className={adminInputClass}
              />
            </label>
            <label className={adminLabelClass}>
              Primary button link
              <input
                name="primaryCtaHref"
                required
                value={values.primaryCtaHref}
                onChange={set("primaryCtaHref")}
                placeholder="/contact"
                className={adminInputClass}
              />
            </label>
            <label className={adminLabelClass}>
              Secondary label{" "}
              <span className="text-ui-text-subtle">(optional)</span>
              <input
                name="secondaryCtaLabel"
                value={values.secondaryCtaLabel}
                onChange={set("secondaryCtaLabel")}
                className={adminInputClass}
              />
            </label>
            <label className={adminLabelClass}>
              Secondary link{" "}
              <span className="text-ui-text-subtle">(optional)</span>
              <input
                name="secondaryCtaHref"
                value={values.secondaryCtaHref}
                onChange={set("secondaryCtaHref")}
                placeholder="/case-studies"
                className={adminInputClass}
              />
            </label>
          </div>

          <h2 className={`${adminSectionTitleClass} mt-2`}>
            Featured value card{" "}
            <span className="text-ui-text-subtle font-normal">(optional)</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={adminLabelClass}>
              Label
              <input
                name="featuredValueLabel"
                value={values.featuredValueLabel}
                onChange={set("featuredValueLabel")}
                placeholder="Member average"
                className={adminInputClass}
              />
            </label>
            <label className={adminLabelClass}>
              Value
              <input
                name="featuredValueValue"
                value={values.featuredValueValue}
                onChange={set("featuredValueValue")}
                placeholder="$1,200/mo"
                className={adminInputClass}
              />
            </label>
            <label className={adminLabelClass}>
              Note
              <input
                name="featuredValueNote"
                value={values.featuredValueNote}
                onChange={set("featuredValueNote")}
                placeholder="per machine"
                className={adminInputClass}
              />
            </label>
          </div>

          <h2 className={`${adminSectionTitleClass} mt-2`}>Delivery</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={adminLabelClass}>
              Shows when
              <select
                name="trigger"
                value={values.trigger}
                onChange={set("trigger")}
                className={adminInputClass}
              >
                <option value="IMMEDIATE">Immediately</option>
                <option value="TIME_ON_PAGE">After time on page</option>
                <option value="SCROLL_DEPTH">At scroll depth</option>
                <option value="IDLE_TIME">After idle time</option>
                <option value="EXIT_INTENT">On exit intent</option>
              </select>
            </label>
            <label className={adminLabelClass}>
              Threshold
              <input
                name="triggerThreshold"
                inputMode="numeric"
                value={values.triggerThreshold}
                onChange={set("triggerThreshold")}
                placeholder={values.trigger === "SCROLL_DEPTH" ? "50" : "10"}
                className={adminInputClass}
              />
              <span className="text-ui-text-subtle mt-1 block text-xs font-normal">
                {thresholdHint}
              </span>
            </label>
            <label className={adminLabelClass}>
              Frequency
              <select
                name="frequency"
                value={values.frequency}
                onChange={set("frequency")}
                className={adminInputClass}
              >
                <option value="session">Once per session</option>
                <option value="once_per_day">Once per day</option>
                <option value="always">Every visit</option>
              </select>
            </label>
          </div>
          <label className={adminLabelClass}>
            Show on pages containing{" "}
            <span className="text-ui-text-subtle">
              (one per line, empty = every page)
            </span>
            <textarea
              name="targetUrlPatterns"
              rows={2}
              value={values.targetUrlPatterns}
              onChange={set("targetUrlPatterns")}
              placeholder="/case-studies"
              className={adminTextareaClass}
            />
          </label>
        </div>

        <div className="border-ui-line flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <DeletePopupControl popupId={entry.id} />
          <div className="flex items-center gap-3">
            {saveState.status !== "idle" ? (
              <p
                className={`text-xs font-medium ${
                  saveState.status === "error"
                    ? "text-red-600"
                    : "text-emerald-700"
                }`}
                role={saveState.status === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                {saveState.message}
              </p>
            ) : null}
            <SaveButton />
          </div>
        </div>
      </form>

      <aside
        className={`${adminPanelClass} lg:sticky lg:top-4`}
        aria-label="Live preview"
      >
        <div className="border-ui-line border-b p-4">
          <h2 className={adminSectionTitleClass}>Live preview</h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            This is the exact card visitors see. Buttons are inert here.
          </p>
        </div>
        <div
          className="flex justify-center bg-[#f3f4f6] p-6"
          // Preview only: swallow CTA navigation so editing never leaves the
          // page. The rendered component stays the real PopupCard.
          onClickCapture={(event) => event.preventDefault()}
        >
          <PopupCard
            popup={previewPopup(entry.id, values)}
            onClose={() => {}}
          />
        </div>
      </aside>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={adminPrimaryButtonClass}
    >
      {pending ? "Saving..." : "Save popup"}
    </button>
  );
}

function DeletePopupControl({ popupId }: { popupId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(deletePopup, initialActionState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={popupId} />
      {confirming ? (
        <>
          <DeleteConfirmButton />
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-ui-text-muted hover:text-ui-text text-sm font-medium"
          >
            Keep it
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={adminDangerButtonClass}
        >
          Delete popup
        </button>
      )}
      {state.status === "error" ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function DeleteConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-ui bg-ui-bad inline-flex h-8 items-center justify-center px-2.5 text-[0.8125rem] font-medium text-white disabled:opacity-50"
    >
      {pending ? "Deleting..." : "Yes, delete permanently"}
    </button>
  );
}
