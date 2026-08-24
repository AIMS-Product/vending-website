"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveChatbotConfigAction,
  type ChatbotActionState,
} from "@/app/admin/chatbot/actions";
import {
  adminInputClass,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSectionTitleClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import {
  MessageInput,
  PanelHeader,
  QuickActionsBar,
  StarterQuestionChips,
  TeaserBubble,
} from "@/components/chatbot/ChatLauncher";
import {
  ChatTranscript,
  type ChatDisplayMessage,
} from "@/components/chatbot/ChatTranscript";
import type { ChatbotConfig, ChatbotQuickAction } from "@/lib/chatbot/config";
import { isSafeChatLinkUrl } from "@/lib/chatbot/parse-chat-links";

const initialState: ChatbotActionState = { status: "idle" };

const KB_MAX_CHARS = 20_000;
const MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];
const MAX_LIST_ITEMS = 5;
// Mirrors ChatWidget.tsx's own local constants — that file can't import them
// from lib/chatbot/config.ts (server-only), and neither can this one.
const PREVIEW_DEFAULT_BRAND_COLOR = "#2a8fcc";
const PREVIEW_DEFAULT_AVATAR_URL = "/chatbot/mia.jpg";

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
  captureAggressiveness: ChatbotConfig["captureAggressiveness"];
  exitIntentCapture: boolean;
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
    captureAggressiveness: config.captureAggressiveness,
    exitIntentCapture: config.exitIntentCapture,
    knowledgeBase: config.knowledgeBase ?? "",
    model: config.model,
  };
}

export function ChatbotConfigForm({ config }: { config: ChatbotConfig }) {
  const [values, setValues] = useState(() => initialValues(config));
  const [starterQuestions, setStarterQuestions] = useState<string[]>(
    () => config.starterQuestions,
  );
  const [quickActions, setQuickActions] = useState<ChatbotQuickAction[]>(
    () => config.quickActions,
  );
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

  const setChecked =
    <Key extends keyof Values>(key: Key) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((prev) => ({ ...prev, [key]: event.target.checked }));

  const accent = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
    values.brandColor.trim(),
  )
    ? values.brandColor.trim()
    : PREVIEW_DEFAULT_BRAND_COLOR;
  const previewAvatarUrl =
    values.avatarUrl.trim() || PREVIEW_DEFAULT_AVATAR_URL;
  const previewPersonaName = values.personaName.trim() || "Assistant";
  const previewMessages: ChatDisplayMessage[] = (
    [
      values.greeting.trim()
        ? { role: "assistant", content: values.greeting.trim() }
        : null,
      values.followUpMessage.trim()
        ? { role: "assistant", content: values.followUpMessage.trim() }
        : null,
    ] as (ChatDisplayMessage | null)[]
  ).filter((message): message is ChatDisplayMessage => message !== null);
  if (previewMessages.length === 0) {
    previewMessages.push({
      role: "assistant",
      content: "Set a greeting to preview it here.",
    });
  }

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
          <input
            type="hidden"
            name="starterQuestions"
            value={JSON.stringify(starterQuestions)}
          />
          <input
            type="hidden"
            name="quickActions"
            value={JSON.stringify(quickActions)}
          />
          <div className="border-ui-line flex flex-wrap items-center justify-between gap-3 border-b p-3.5">
            <div>
              <h2 className={adminSectionTitleClass}>Chatbot</h2>
              <p className="text-ui-text-subtle mt-1 text-xs">
                Master switch for the on-site widget. Changes take up to ~2
                minutes to reach visitors.
              </p>
            </div>
            <label className="text-ui-text flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="enabled"
                checked={values.enabled}
                onChange={setChecked("enabled")}
                className="size-4"
              />
              {values.enabled ? "On — live for visitors" : "Off"}
            </label>
          </div>

          <div className="grid gap-3 p-3.5">
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

            <div className="grid gap-3 sm:grid-cols-2">
              <label className={adminLabelClass}>
                Greeting <span className="text-ui-text-subtle">(first)</span>
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
                Follow-up{" "}
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
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className={adminLabelClass}>
                Teaser text{" "}
                <span className="text-ui-text-subtle">
                  (fallback only — the bubble shows the greeting)
                </span>
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
                  placeholder="#2a8fcc"
                  className={adminInputClass}
                />
              </label>
              <label className={adminLabelClass}>
                Teaser delay{" "}
                <span className="text-ui-text-subtle">(sec, 0 = off)</span>
                <input
                  name="idleTriggerSeconds"
                  inputMode="numeric"
                  value={values.idleTriggerSeconds}
                  onChange={set("idleTriggerSeconds")}
                  className={adminInputClass}
                />
              </label>
            </div>

            <div className="border-ui-line grid gap-3 border-t pt-3 sm:grid-cols-2">
              <h2 className={`${adminSectionTitleClass} sm:col-span-2`}>
                Behaviour
              </h2>
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
              <label className={adminLabelClass}>
                Capture aggressiveness
                <select
                  name="captureAggressiveness"
                  value={values.captureAggressiveness}
                  onChange={set("captureAggressiveness")}
                  className={adminInputClass}
                >
                  <option value="eager">Eager — offer after 1st reply</option>
                  <option value="balanced">
                    Balanced — offer after 2nd reply
                  </option>
                  <option value="relaxed">
                    Relaxed — offer after 3rd reply
                  </option>
                </select>
                <span className="text-ui-text-subtle mt-1 block text-xs font-normal">
                  Which reply triggers the on-intent capture card above.
                </span>
              </label>
              <label className="text-ui-text flex items-start gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="exitIntentCapture"
                  checked={values.exitIntentCapture}
                  onChange={setChecked("exitIntentCapture")}
                  className="mt-0.5 size-4"
                />
                <span>
                  Exit-intent capture
                  <span className="text-ui-text-subtle mt-1 block text-xs font-normal">
                    Nudge once when a desktop visitor with an active, uncaptured
                    chat moves toward closing the tab.
                  </span>
                </span>
              </label>
            </div>

            <label
              className={`${adminLabelClass} border-ui-line border-t pt-3`}
            >
              Knowledge base{" "}
              <span className="text-ui-text-subtle">
                (facts injected into the system prompt —{" "}
                {values.knowledgeBase.length.toLocaleString()}/
                {KB_MAX_CHARS.toLocaleString()})
              </span>
              <textarea
                name="knowledgeBase"
                rows={5}
                maxLength={KB_MAX_CHARS}
                value={values.knowledgeBase}
                onChange={set("knowledgeBase")}
                placeholder="Anything the team wants the bot to know — pricing nuance, current promotions, FAQ answers."
                className={adminTextareaClass}
              />
            </label>

            <div className="border-ui-line grid gap-4 border-t pt-3 lg:grid-cols-2">
              <div className="grid gap-2">
                <h2 className={adminSectionTitleClass}>
                  Starter questions{" "}
                  <span className="text-ui-text-subtle font-normal">
                    (chips before the first message, max {MAX_LIST_ITEMS})
                  </span>
                </h2>
                <StarterQuestionsEditor
                  value={starterQuestions}
                  onChange={setStarterQuestions}
                />
              </div>
              <div className="grid gap-2">
                <h2 className={adminSectionTitleClass}>
                  Quick actions{" "}
                  <span className="text-ui-text-subtle font-normal">
                    (button row under the header, max {MAX_LIST_ITEMS})
                  </span>
                </h2>
                <QuickActionsEditor
                  value={quickActions}
                  onChange={setQuickActions}
                />
              </div>
            </div>
          </div>

          <div className="border-ui-line flex flex-wrap items-center justify-end gap-3 border-t p-3.5">
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
        <div className="border-ui-line border-b p-3.5">
          <h2 className={adminSectionTitleClass}>Live preview</h2>
          <p className="text-ui-text-subtle mt-1 text-xs">
            The real widget components, scaled down — exactly what visitors see.
          </p>
        </div>
        <div
          className="flex justify-center overflow-hidden bg-[#f3f4f6] py-4"
          style={{ height: 540 }}
          // Preview only: the panel renders real Link/button elements (quick
          // actions, close) — swallow their default action so clicking never
          // navigates away from the admin page, same guard PopupEditor uses.
          onClickCapture={(event) => event.preventDefault()}
        >
          <div
            className="flex flex-col items-center gap-2"
            style={{ transform: "scale(0.9)", transformOrigin: "top center" }}
          >
            {(values.greeting || values.teaserText).trim() ? (
              <TeaserBubble
                text={values.greeting || values.teaserText}
                avatarUrl={previewAvatarUrl}
                onOpen={() => {}}
                onDismiss={() => {}}
              />
            ) : null}
            <div className="flex h-[520px] w-[360px] flex-col overflow-hidden rounded-[8px] border-2 border-[#111111] bg-white shadow-[6px_6px_0_#111111]">
              <PanelHeader
                personaName={previewPersonaName}
                avatarUrl={previewAvatarUrl}
                brandColor={accent}
                onClose={() => {}}
              />
              <QuickActionsBar actions={quickActions} />
              <ChatTranscript
                personaName={previewPersonaName}
                avatarUrl={previewAvatarUrl}
                brandColor={accent}
                messages={previewMessages}
                streamingText={null}
                isWaiting={false}
                toolStatus={null}
              />
              <StarterQuestionChips
                questions={starterQuestions}
                onSelect={() => {}}
              />
              <MessageInput
                brandColor={accent}
                value=""
                onChange={() => {}}
                onSend={() => {}}
                disabled
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StarterQuestionsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid gap-2">
      {value.map((question, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={question}
            onChange={(event) =>
              onChange(
                value.map((v, i) => (i === index ? event.target.value : v)),
              )
            }
            placeholder="How much does it cost to start?"
            className={`${adminInputClass} flex-1`}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            className="text-ui-text-subtle text-xs font-medium hover:text-red-600"
          >
            Remove
          </button>
        </div>
      ))}
      {value.length < MAX_LIST_ITEMS ? (
        <button
          type="button"
          onClick={() => onChange([...value, ""])}
          className="text-ui-text-subtle hover:text-ui-text w-fit text-xs font-medium underline underline-offset-2"
        >
          + Add question
        </button>
      ) : null}
    </div>
  );
}

function QuickActionsEditor({
  value,
  onChange,
}: {
  value: ChatbotQuickAction[];
  onChange: (next: ChatbotQuickAction[]) => void;
}) {
  const update = (index: number, patch: Partial<ChatbotQuickAction>) =>
    onChange(
      value.map((action, i) =>
        i === index ? { ...action, ...patch } : action,
      ),
    );

  return (
    <div className="grid gap-2">
      {value.map((action, index) => {
        const urlIsValid =
          !action.url.trim() || isSafeChatLinkUrl(action.url.trim());
        return (
          <div key={index} className="grid gap-1">
            <div className="flex items-center gap-2">
              <input
                value={action.label}
                onChange={(event) =>
                  update(index, { label: event.target.value })
                }
                placeholder="Book a call"
                className={`${adminInputClass} flex-1`}
              />
              <input
                value={action.url}
                onChange={(event) => update(index, { url: event.target.value })}
                placeholder="/book-now"
                className={`${adminInputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="text-ui-text-subtle shrink-0 text-xs font-medium hover:text-red-600"
              >
                Remove
              </button>
            </div>
            {!urlIsValid ? (
              <p className="text-xs text-red-600">
                Must be a relative path or link to vendingpreneurs.com.
              </p>
            ) : null}
          </div>
        );
      })}
      {value.length < MAX_LIST_ITEMS ? (
        <button
          type="button"
          onClick={() => onChange([...value, { label: "", url: "" }])}
          className="text-ui-text-subtle hover:text-ui-text w-fit text-xs font-medium underline underline-offset-2"
        >
          + Add action
        </button>
      ) : null}
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
