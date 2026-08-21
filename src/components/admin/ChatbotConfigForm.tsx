"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveChatbotConfigAction,
  type ChatbotActionState,
} from "@/app/admin/chatbot/actions";
import {
  adminCardClass,
  adminInputClass,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSectionTitleClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import type { ChatbotConfig } from "@/lib/chatbot/config";

const initialState: ChatbotActionState = { status: "idle" };

const KB_MAX_CHARS = 20_000;
const MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

type Values = {
  enabled: boolean;
  personaName: string;
  avatarUrl: string;
  greeting: string;
  followUpMessage: string;
  teaserText: string;
  brandColor: string;
  idleTriggerSeconds: string;
  captureMode: ChatbotConfig["captureMode"];
  knowledgeBase: string;
  model: string;
};

function initialValues(config: ChatbotConfig): Values {
  return {
    enabled: config.enabled,
    personaName: config.personaName,
    avatarUrl: config.avatarUrl ?? "",
    greeting: config.greeting ?? "",
    followUpMessage: config.followUpMessage ?? "",
    teaserText: config.teaserText ?? "",
    brandColor: config.brandColor ?? "",
    idleTriggerSeconds: String(config.idleTriggerSeconds),
    captureMode: config.captureMode,
    knowledgeBase: config.knowledgeBase ?? "",
    model: config.model,
  };
}

export function ChatbotConfigForm({ config }: { config: ChatbotConfig }) {
  const [values, setValues] = useState(() => initialValues(config));
  const [state, formAction] = useActionState(
    saveChatbotConfigAction,
    initialState,
  );

  const set =
    <Key extends keyof Values>(key: Key) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setValues((prev) => ({ ...prev, [key]: event.target.value }) as Values);

  const accent = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
    values.brandColor.trim(),
  )
    ? values.brandColor.trim()
    : "#111827";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)]">
      <div className={`${adminPanelClass} min-w-0`}>
        <form action={formAction}>
          {/* chatbot_config is one row — saving this form resubmits the
              whole thing, so the lead-routing panel's fields (owned by a
              separate <form> below) have to ride along as hidden inputs
              sourced from the last-saved config, or saving here would wipe
              them back to blank/off. */}
          <input
            type="hidden"
            name="leadRoutingEmails"
            value={config.leadRoutingEmails ?? ""}
          />
          {config.notifyEnabled ? (
            <input type="hidden" name="notifyEnabled" value="on" />
          ) : null}
          <div className="border-ui-line flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h2 className={adminSectionTitleClass}>Chatbot</h2>
              <p className="text-ui-text-subtle mt-1 text-xs">
                Master switch for the on-site widget.
              </p>
            </div>
            <label className="text-ui-text flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="enabled"
                checked={values.enabled}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    enabled: event.target.checked,
                  }))
                }
                className="size-4"
              />
              {values.enabled ? "On — live for visitors" : "Off"}
            </label>
          </div>

          <div className="grid gap-4 p-4">
            <h2 className={adminSectionTitleClass}>Persona</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={adminLabelClass}>
                Name
                <input
                  name="personaName"
                  required
                  value={values.personaName}
                  onChange={set("personaName")}
                  className={adminInputClass}
                />
              </label>
              <label className={adminLabelClass}>
                Avatar URL{" "}
                <span className="text-ui-text-subtle">(optional)</span>
                <input
                  name="avatarUrl"
                  value={values.avatarUrl}
                  onChange={set("avatarUrl")}
                  placeholder="/images/mia.png"
                  className={adminInputClass}
                />
              </label>
            </div>

            <label className={adminLabelClass}>
              Greeting{" "}
              <span className="text-ui-text-subtle">(first message)</span>
              <textarea
                name="greeting"
                rows={2}
                value={values.greeting}
                onChange={set("greeting")}
                placeholder="Hey! Thanks for stopping by — what brings you here today?"
                className={adminTextareaClass}
              />
            </label>
            <label className={adminLabelClass}>
              Follow-up message{" "}
              <span className="text-ui-text-subtle">
                (optional second message)
              </span>
              <textarea
                name="followUpMessage"
                rows={2}
                value={values.followUpMessage}
                onChange={set("followUpMessage")}
                className={adminTextareaClass}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={adminLabelClass}>
                Teaser text{" "}
                <span className="text-ui-text-subtle">(optional)</span>
                <input
                  name="teaserText"
                  value={values.teaserText}
                  onChange={set("teaserText")}
                  placeholder="Questions about vending?"
                  className={adminInputClass}
                />
              </label>
              <label className={adminLabelClass}>
                Brand colour <span className="text-ui-text-subtle">(hex)</span>
                <input
                  name="brandColor"
                  value={values.brandColor}
                  onChange={set("brandColor")}
                  placeholder="#111827"
                  className={adminInputClass}
                />
              </label>
              <label className={adminLabelClass}>
                Teaser delay{" "}
                <span className="text-ui-text-subtle">(seconds, 0 = off)</span>
                <input
                  name="idleTriggerSeconds"
                  inputMode="numeric"
                  value={values.idleTriggerSeconds}
                  onChange={set("idleTriggerSeconds")}
                  className={adminInputClass}
                />
              </label>
            </div>

            <h2 className={`${adminSectionTitleClass} mt-2`}>Behaviour</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={adminLabelClass}>
                Capture mode
                <select
                  name="captureMode"
                  value={values.captureMode}
                  onChange={set("captureMode")}
                  className={adminInputClass}
                >
                  <option value="pre_chat">
                    Pre-chat form (gates the chat)
                  </option>
                  <option value="on_intent">On intent (inline card)</option>
                  <option value="off">Off (regex only)</option>
                </select>
              </label>
              <label className={adminLabelClass}>
                Model
                <select
                  name="model"
                  value={values.model}
                  onChange={set("model")}
                  className={adminInputClass}
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className={adminLabelClass}>
              Knowledge base{" "}
              <span className="text-ui-text-subtle">
                (facts injected into the system prompt —{" "}
                {values.knowledgeBase.length.toLocaleString()}/
                {KB_MAX_CHARS.toLocaleString()})
              </span>
              <textarea
                name="knowledgeBase"
                rows={8}
                maxLength={KB_MAX_CHARS}
                value={values.knowledgeBase}
                onChange={set("knowledgeBase")}
                placeholder="Anything the team wants the bot to know — pricing nuance, current promotions, FAQ answers."
                className={adminTextareaClass}
              />
            </label>
          </div>

          <div className="border-ui-line flex flex-wrap items-center justify-end gap-3 border-t p-4">
            {state.status !== "idle" ? (
              <p
                className={`text-xs font-medium ${state.status === "error" ? "text-red-600" : "text-emerald-700"}`}
                role={state.status === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                {state.message}
              </p>
            ) : null}
            <SaveButton />
          </div>
        </form>
      </div>

      <aside
        className={`${adminPanelClass} lg:sticky lg:top-4`}
        aria-label="Live preview"
      >
        <div className="border-ui-line border-b p-4">
          <h2 className={adminSectionTitleClass}>Live preview</h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            Greeting and teaser as visitors will see them.
          </p>
        </div>
        <div className="grid gap-3 bg-[#f3f4f6] p-4">
          {values.teaserText.trim() ? (
            <div
              className="max-w-[220px] rounded-full px-3 py-2 text-sm font-medium text-white shadow-md"
              style={{ backgroundColor: accent }}
            >
              {values.teaserText}
            </div>
          ) : null}
          <div className={`${adminCardClass} max-w-[280px]`}>
            <div className="mb-2 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: accent }}
              >
                {values.personaName.trim().slice(0, 1).toUpperCase() || "?"}
              </span>
              <span className="text-ui-text text-sm font-semibold">
                {values.personaName.trim() || "Assistant"}
              </span>
            </div>
            <p className="text-ui-text text-sm">
              {values.greeting.trim() || "Set a greeting to preview it here."}
            </p>
            {values.followUpMessage.trim() ? (
              <p className="text-ui-text mt-2 text-sm">
                {values.followUpMessage}
              </p>
            ) : null}
          </div>
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
      {pending ? "Saving..." : "Save settings"}
    </button>
  );
}
