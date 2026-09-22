"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveLeadForwarding,
  sendLeadForwardTest,
  type LeadForwardActionState,
} from "@/app/admin/settings/lead-forwarding/actions";
import {
  adminInputClass,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { cn } from "@/lib/utils";
import type {
  LeadForwardCaptureCounts,
  LeadForwardSettings,
} from "@/lib/services/lead-forward-settings";
import type { LeadCaptureType } from "@/lib/ghl/forward";
import type { AdminRole } from "@/lib/supabase/auth";

const initialState: LeadForwardActionState = { status: "idle" };

/** Marketer-facing names for the capture vocabulary. */
const CAPTURE_LABELS: Record<
  LeadCaptureType,
  { title: string; detail: string }
> = {
  booking: {
    title: "Booking forms",
    detail: "Name, email and phone, then straight to the calendar.",
  },
  application: {
    title: "Application form",
    detail: "Adds state, business stage, budget and timeline.",
  },
  chat: {
    title: "Website chat",
    detail: "Left an email in the chat widget rather than a form.",
  },
  lead_magnet: {
    title: "Guide downloads",
    detail: "Asked for the roadmap PDF, not for a call.",
  },
  newsletter: {
    title: "Newsletter signups",
    detail: "Subscribed to email. Rarely appropriate to hand on.",
  },
};

/**
 * The payload keys a partner can only receive through a custom field of
 * theirs. Name, email, phone, city and state are standard CRM fields and need
 * no mapping, so they are not listed.
 */
const MAPPABLE_KEYS = [
  "submitted_at",
  "form_type",
  "source_page",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "business_stage",
  "budget",
  "timeline",
  "message",
] as const;

export function AdminLeadForwardingManager({
  settings,
  counts,
  currentUserRole,
  hasApiCredentials,
}: {
  settings: LeadForwardSettings;
  counts: LeadForwardCaptureCounts;
  currentUserRole: AdminRole;
  hasApiCredentials: boolean;
}) {
  const canManage = currentUserRole === "super_admin";
  const [state, action] = useActionState(saveLeadForwarding, initialState);
  const [testState, testAction] = useActionState(
    sendLeadForwardTest,
    initialState,
  );
  const [captureTypes, setCaptureTypes] = useState<LeadCaptureType[]>(
    settings.captureTypes,
  );
  const [mode, setMode] = useState(settings.trafficSourceMode);
  const [sources, setSources] = useState<string[]>(settings.trafficSources);
  const [showFieldIds, setShowFieldIds] = useState(
    Object.keys(settings.fieldIds).length > 0,
  );

  const selectedCount = counts.captureTypes
    .filter((row) => captureTypes.includes(row.type))
    .reduce((total, row) => total + row.count, 0);

  return (
    <div className="grid gap-5">
      {!canManage ? (
        <Banner tone="warn">
          Lead forwarding is read-only for your account. Super admins can change
          where captures go.
        </Banner>
      ) : null}
      {state.status !== "idle" ? (
        <Banner tone={state.status === "saved" ? "good" : "bad"}>
          {state.message}
        </Banner>
      ) : null}
      {testState.status !== "idle" ? (
        <Banner tone={testState.status === "saved" ? "good" : "bad"}>
          {testState.message}
        </Banner>
      ) : null}

      <form action={action} className="grid gap-5">
        <section className={adminPanelClass}>
          <div className="border-ui-line border-b p-4">
            <h2 className="text-ui-text text-base font-semibold">
              WeScale (GoHighLevel)
            </h2>
            <p className="text-ui-text-muted mt-1 text-sm">
              Forwards each capture the moment it arrives. Nothing is sent for
              captures made before you turn this on.
            </p>
          </div>

          <div className="grid gap-4 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={settings.enabled}
                disabled={!canManage}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className={adminLabelClass}>Forwarding is on</span>
                <span className="text-ui-text-muted block text-sm">
                  {settings.updatedAt
                    ? `Last changed ${new Date(settings.updatedAt).toLocaleString()}${
                        settings.updatedBy ? ` by ${settings.updatedBy}` : ""
                      }.`
                    : "Not configured yet."}
                </span>
              </span>
            </label>

            <div className="grid gap-1.5">
              <label className={adminLabelClass} htmlFor="webhookUrl">
                Webhook URL
              </label>
              <input
                id="webhookUrl"
                name="webhookUrl"
                type="url"
                inputMode="url"
                placeholder="https://services.leadconnectorhq.com/hooks/..."
                defaultValue={settings.webhookUrl ?? ""}
                disabled={!canManage}
                className={cn(adminInputClass, "mt-0")}
              />
              <p className="text-ui-text-subtle text-xs">
                From their workflow&apos;s Inbound Webhook trigger. Leave empty
                to use the API instead
                {hasApiCredentials
                  ? " — their token and location are already set."
                  : ", which needs their token and location id set in the environment first."}
              </p>
            </div>
          </div>
        </section>

        <section className={adminPanelClass}>
          <div className="border-ui-line border-b p-4">
            <h2 className="text-ui-text text-base font-semibold">
              What gets sent
            </h2>
            <p className="text-ui-text-muted mt-1 text-sm">
              Counts are the last {counts.days} days. Your selection covers{" "}
              <strong className="text-ui-text">{selectedCount}</strong> of{" "}
              {counts.total} captures.
            </p>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <fieldset className="grid content-start gap-2">
              <legend className={cn(adminLabelClass, "mb-1")}>
                Capture type
              </legend>
              {counts.captureTypes.map((row) => (
                <label
                  key={row.type}
                  className="border-ui-line rounded-ui flex items-start gap-3 border p-3"
                >
                  <input
                    type="checkbox"
                    name="captureTypes"
                    value={row.type}
                    checked={captureTypes.includes(row.type)}
                    disabled={!canManage}
                    onChange={(event) =>
                      setCaptureTypes((current) =>
                        event.target.checked
                          ? [...current, row.type]
                          : current.filter((type) => type !== row.type),
                      )
                    }
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-ui-text text-sm font-medium">
                        {CAPTURE_LABELS[row.type].title}
                      </span>
                      <span className="text-ui-text-subtle text-xs tabular-nums">
                        {row.count}
                      </span>
                    </span>
                    <span className="text-ui-text-muted block text-xs">
                      {CAPTURE_LABELS[row.type].detail}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="grid content-start gap-2">
              <legend className={cn(adminLabelClass, "mb-1")}>
                Traffic source
              </legend>
              <label className="border-ui-line rounded-ui flex items-start gap-3 border p-3">
                <input
                  type="radio"
                  name="trafficSourceMode"
                  value="all"
                  checked={mode === "all"}
                  disabled={!canManage}
                  onChange={() => setMode("all")}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  <span className="text-ui-text text-sm font-medium">
                    Every traffic source
                  </span>
                  <span className="text-ui-text-muted block text-xs">
                    Includes sources that do not exist yet, so a new campaign is
                    never silently dropped.
                  </span>
                </span>
              </label>
              <label className="border-ui-line rounded-ui flex items-start gap-3 border p-3">
                <input
                  type="radio"
                  name="trafficSourceMode"
                  value="allowlist"
                  checked={mode === "allowlist"}
                  disabled={!canManage}
                  onChange={() => setMode("allowlist")}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  <span className="text-ui-text text-sm font-medium">
                    Only the sources I pick
                  </span>
                  <span className="text-ui-text-muted block text-xs">
                    A new source has to be ticked here before it forwards.
                  </span>
                </span>
              </label>

              {mode === "allowlist" ? (
                <div className="border-ui-line rounded-ui max-h-72 overflow-y-auto border p-3">
                  <ul className="grid gap-1.5">
                    {counts.trafficSources.map((row) => (
                      <li key={row.source}>
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            name="trafficSources"
                            value={row.source}
                            checked={sources.includes(row.source)}
                            disabled={!canManage}
                            onChange={(event) =>
                              setSources((current) =>
                                event.target.checked
                                  ? [...current, row.source]
                                  : current.filter(
                                      (source) => source !== row.source,
                                    ),
                              )
                            }
                            className="size-4 shrink-0"
                          />
                          <span className="text-ui-text min-w-0 flex-1 truncate text-sm">
                            {row.source === "(none)"
                              ? "No source tag"
                              : row.source}
                          </span>
                          <span className="text-ui-text-subtle text-xs tabular-nums">
                            {row.count}
                          </span>
                        </label>
                      </li>
                    ))}
                    {/* A source saved earlier that has had no traffic in the
                        window would otherwise vanish from the form and be
                        dropped on the next save. */}
                    {sources
                      .filter(
                        (source) =>
                          !counts.trafficSources.some(
                            (row) => row.source === source,
                          ),
                      )
                      .map((source) => (
                        <li key={source}>
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              name="trafficSources"
                              value={source}
                              checked
                              disabled={!canManage}
                              onChange={() =>
                                setSources((current) =>
                                  current.filter((item) => item !== source),
                                )
                              }
                              className="size-4 shrink-0"
                            />
                            <span className="text-ui-text min-w-0 flex-1 truncate text-sm">
                              {source}
                            </span>
                            <span className="text-ui-text-subtle text-xs">
                              no recent traffic
                            </span>
                          </label>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </fieldset>
          </div>
        </section>

        <section className={adminPanelClass}>
          <div className="border-ui-line flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h2 className="text-ui-text text-base font-semibold">
                Their custom field ids
              </h2>
              <p className="text-ui-text-muted mt-1 text-sm">
                Only needed when sending through the API. A webhook destination
                maps these on their own side.
              </p>
            </div>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() => setShowFieldIds((open) => !open)}
            >
              {showFieldIds ? "Hide" : "Show"}
            </button>
          </div>

          {showFieldIds ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {MAPPABLE_KEYS.map((key) => (
                <div key={key} className="grid gap-1.5">
                  <label className={adminLabelClass} htmlFor={`fieldId:${key}`}>
                    {key}
                  </label>
                  <input
                    id={`fieldId:${key}`}
                    name={`fieldId:${key}`}
                    defaultValue={settings.fieldIds[key] ?? ""}
                    placeholder="Leave empty to skip"
                    disabled={!canManage}
                    className={cn(adminInputClass, "mt-0")}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <SaveButton disabled={!canManage} />
          <p className="text-ui-text-subtle text-xs">
            Turning this on starts the feed from the next capture. It never
            back-fills.
          </p>
        </div>
      </form>

      <section className={adminPanelClass}>
        <div className="border-ui-line border-b p-4">
          <h2 className="text-ui-text text-base font-semibold">
            Send a test lead
          </h2>
          <p className="text-ui-text-muted mt-1 text-sm">
            Sends one clearly-marked sample to the destination above. Their team
            needs a received request before they can map our fields, so press
            this while they are watching.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          <form action={testAction}>
            <input type="hidden" name="captureType" value="booking" />
            <TestButton label="Send booking sample" disabled={!canManage} />
          </form>
          <form action={testAction}>
            <input type="hidden" name="captureType" value="application" />
            <TestButton label="Send application sample" disabled={!canManage} />
          </form>
        </div>
      </section>
    </div>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={adminPrimaryButtonClass}
      disabled={disabled || pending}
    >
      {pending ? "Saving..." : "Save forwarding"}
    </button>
  );
}

function TestButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={adminSecondaryButtonClass}
      disabled={disabled || pending}
    >
      {pending ? "Sending..." : label}
    </button>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "good" | "bad" | "warn";
  children: React.ReactNode;
}) {
  const tones = {
    good: "border-ui-good/25 bg-ui-good-fill text-ui-good-ink",
    bad: "border-ui-bad/25 bg-ui-bad-fill text-ui-bad-ink",
    warn: "border-ui-warn/25 bg-ui-warn-fill text-ui-warn-ink",
  } as const;
  return (
    <section
      className={cn("rounded-ui-lg border px-4 py-3 text-sm", tones[tone])}
    >
      {children}
    </section>
  );
}
