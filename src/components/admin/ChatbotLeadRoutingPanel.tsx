"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  getChatbotCatchUpEligibleCountAction,
  saveChatbotConfigAction,
  sendChatbotCatchUpDigestAction,
  sendChatbotTestEmailAction,
  type ChatbotActionState,
} from "@/app/admin/chatbot/actions";
import {
  adminInputClass,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import type { ChatbotConfig } from "@/lib/chatbot/config";

const initialState: ChatbotActionState = { status: "idle" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATCH_UP_WINDOWS = [7, 30, 90] as const;

/**
 * `chatbot_config` is a single row, so saving routing settings resubmits the
 * whole config — the non-routing fields are carried through as hidden inputs
 * sourced from the last-saved `config` prop (not the other form's unsaved
 * draft), so this never clobbers an in-progress edit above it.
 */
export function ChatbotLeadRoutingPanel({ config }: { config: ChatbotConfig }) {
  const [recipients, setRecipients] = useState(config.leadRoutingEmails ?? "");
  const [notifyEnabled, setNotifyEnabled] = useState(config.notifyEnabled);
  const [saveState, saveAction] = useActionState(
    saveChatbotConfigAction,
    initialState,
  );
  const [testState, testAction] = useActionState(
    sendChatbotTestEmailAction,
    initialState,
  );

  const invalidEntries = recipients
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !EMAIL_RE.test(entry));

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className={adminPanelClass}>
        <div className="border-ui-line border-b p-4">
          <h2 className={adminSectionTitleClass}>Lead routing</h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            Where captured-lead profile emails go. Falls back to the site&apos;s
            default lead notification address when blank.
          </p>
        </div>
        <form action={saveAction} className="grid gap-3 p-4">
          <HiddenConfigFields config={config} />
          <label className={adminLabelClass}>
            Recipients{" "}
            <span className="text-ui-text-subtle">(comma-separated)</span>
            <input
              name="leadRoutingEmails"
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
              placeholder="team@vendingpreneurs.com, sales@vendingpreneurs.com"
              className={adminInputClass}
            />
            {invalidEntries.length ? (
              <span className="mt-1 block text-xs text-red-600">
                Doesn&apos;t look like an email: {invalidEntries.join(", ")}
              </span>
            ) : null}
          </label>
          <label className="text-ui-text flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="notifyEnabled"
              checked={notifyEnabled}
              onChange={(event) => setNotifyEnabled(event.target.checked)}
              className="size-4"
            />
            Email the team when a lead is captured
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <SaveRoutingButton />
            {saveState.status !== "idle" ? (
              <p
                className={`text-xs font-medium ${saveState.status === "error" ? "text-red-600" : "text-emerald-700"}`}
                role={saveState.status === "error" ? "alert" : "status"}
              >
                {saveState.message}
              </p>
            ) : null}
          </div>
        </form>
        <div className="border-ui-line flex flex-wrap items-center gap-3 border-t p-4">
          <form action={testAction}>
            <TestEmailButton />
          </form>
          {testState.status !== "idle" ? (
            <p
              className={`text-xs font-medium ${testState.status === "error" ? "text-red-600" : "text-emerald-700"}`}
              role={testState.status === "error" ? "alert" : "status"}
            >
              {testState.message}
            </p>
          ) : null}
        </div>
      </section>

      <CatchUpPanel />
    </div>
  );
}

function HiddenConfigFields({ config }: { config: ChatbotConfig }) {
  return (
    <>
      {/* The save action reads a checkbox as `formData.get(name) !== null`,
          so an unchecked box must be an ABSENT field, not an empty one — the
          hidden mirror has to omit the input entirely to match. */}
      {config.enabled ? (
        <input type="hidden" name="enabled" value="on" />
      ) : null}
      <input type="hidden" name="personaName" value={config.personaName} />
      <input type="hidden" name="avatarUrl" value={config.avatarUrl ?? ""} />
      <input type="hidden" name="greeting" value={config.greeting ?? ""} />
      <input
        type="hidden"
        name="followUpMessage"
        value={config.followUpMessage ?? ""}
      />
      <input type="hidden" name="teaserText" value={config.teaserText ?? ""} />
      <input type="hidden" name="brandColor" value={config.brandColor ?? ""} />
      <input
        type="hidden"
        name="idleTriggerSeconds"
        value={String(config.idleTriggerSeconds)}
      />
      <input type="hidden" name="captureMode" value={config.captureMode} />
      <input
        type="hidden"
        name="captureAggressiveness"
        value={config.captureAggressiveness}
      />
      {config.exitIntentCapture ? (
        <input type="hidden" name="exitIntentCapture" value="on" />
      ) : null}
      <input
        type="hidden"
        name="knowledgeBase"
        value={config.knowledgeBase ?? ""}
      />
      <input type="hidden" name="model" value={config.model} />
    </>
  );
}

function CatchUpPanel() {
  const [windowDays, setWindowDays] =
    useState<(typeof CATCH_UP_WINDOWS)[number]>(30);
  const [count, setCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [digestState, digestAction] = useActionState(
    sendChatbotCatchUpDigestAction,
    initialState,
  );

  useEffect(() => {
    startTransition(async () => {
      const result = await getChatbotCatchUpEligibleCountAction(windowDays);
      setCount(result);
    });
  }, [windowDays]);

  return (
    <section className={adminPanelClass}>
      <div className="border-ui-line border-b p-4">
        <h2 className={adminSectionTitleClass}>Missed-leads catch-up</h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          Ships with the learning loop — this previews eligible conversations
          today.
        </p>
      </div>
      <div className="grid gap-3 p-4">
        <div
          className="rounded-ui border-ui-line-strong inline-flex w-fit overflow-hidden border"
          role="group"
          aria-label="Catch-up window"
        >
          {CATCH_UP_WINDOWS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setWindowDays(days)}
              aria-pressed={windowDays === days}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                windowDays === days
                  ? "bg-ui-accent text-white"
                  : "text-ui-text-muted hover:bg-ui-canvas bg-white"
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
        <p className="text-ui-text-muted text-sm">
          {pending
            ? "Counting…"
            : `${count ?? 0} conversation${count === 1 ? "" : "s"} eligible`}
        </p>
        <form action={digestAction}>
          <input type="hidden" name="windowDays" value={windowDays} />
          <CatchUpButton count={count ?? 0} />
        </form>
        {digestState.status !== "idle" ? (
          <p
            className={`text-xs font-medium ${digestState.status === "error" ? "text-red-600" : "text-ui-text-muted"}`}
            role={digestState.status === "error" ? "alert" : "status"}
          >
            {digestState.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SaveRoutingButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={adminPrimaryButtonClass}
    >
      {pending ? "Saving..." : "Save routing"}
    </button>
  );
}

function TestEmailButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={adminSecondaryButtonClass}
    >
      {pending ? "Sending..." : "Send test email"}
    </button>
  );
}

function CatchUpButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={adminSecondaryButtonClass}
    >
      {pending ? "Working..." : `Send catch-up digest (${count})`}
    </button>
  );
}
