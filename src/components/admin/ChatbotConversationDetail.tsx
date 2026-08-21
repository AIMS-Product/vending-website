"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  handOffConversationAction,
  saveConversationNoteAction,
  toggleConversationFlagAction,
  type ChatbotActionState,
} from "@/app/admin/chatbot/actions";
import {
  AdminStatusBadge,
  adminCardClass,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSectionTitleClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import { CHATBOT_FLAGS, type ChatbotFlag } from "@/lib/chatbot/flags";
import type { AdminChatbotConversationDetail } from "@/lib/services/chatbot-admin";

const initialState: ChatbotActionState = { status: "idle" };

const FLAG_LABELS: Record<ChatbotFlag, string> = {
  quality_good: "Good quality",
  quality_bad: "Bad quality",
  needs_prompt_tuning: "Needs prompt tuning",
  lead_high_intent: "High intent",
  lead_low_intent: "Low intent",
  followup_needed: "Follow-up needed",
  handoff_missed: "Missed handoff",
};

export function ChatbotConversationDetail({
  conversation,
}: {
  conversation: AdminChatbotConversationDetail;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-5">
        <MetaChips conversation={conversation} />
        <Transcript messages={conversation.messages} />
      </div>

      <div className="grid gap-5">
        <FlagsPanel
          conversationId={conversation.id}
          flags={conversation.flags}
        />
        <NotePanel
          conversationId={conversation.id}
          flags={conversation.flags}
        />
        <LinkedLeadPanel conversation={conversation} />
        <HandoffPanel conversation={conversation} />
      </div>
    </div>
  );
}

function MetaChips({
  conversation,
}: {
  conversation: AdminChatbotConversationDetail;
}) {
  return (
    <section className={adminCardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge status={conversation.status} />
        {conversation.handedOffAt ? (
          <span className="bg-ui-line text-ui-text-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
            Handed off {formatDateTime(conversation.handedOffAt)}
          </span>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetaItem
          label="First seen"
          value={formatDateTime(conversation.createdAt)}
        />
        <MetaItem
          label="Last message"
          value={formatDateTime(conversation.lastMessageAt)}
        />
        <MetaItem label="Messages" value={String(conversation.messageCount)} />
        <MetaItem label="Page" value={conversation.pageUrl ?? "—"} />
      </dl>
      {conversation.capturedEmail || conversation.capturedPhone ? (
        <p className="text-ui-text-muted mt-3 text-sm">
          Captured:{" "}
          {[
            conversation.capturedName,
            conversation.capturedEmail,
            conversation.capturedPhone,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No contact captured yet.
        </p>
      )}
      {conversation.prospectProfileSummary ? (
        <p className="text-ui-text-muted mt-2 text-sm">
          {conversation.prospectProfileSummary}
        </p>
      ) : null}
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ui-text-subtle text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
        {label}
      </dt>
      <dd className="text-ui-text mt-0.5 truncate text-sm" title={value}>
        {value}
      </dd>
    </div>
  );
}

function Transcript({
  messages,
}: {
  messages: AdminChatbotConversationDetail["messages"];
}) {
  return (
    <section className={adminCardClass} aria-label="Transcript">
      <h2 className={adminSectionTitleClass}>Transcript</h2>
      {messages.length ? (
        <div className="mt-4 grid gap-3">
          {messages.map((message, index) => (
            <MessageBubble
              key={`${message.ts ?? index}-${index}`}
              message={message}
            />
          ))}
        </div>
      ) : (
        <p className="text-ui-text-muted mt-3 text-sm">No messages recorded.</p>
      )}
    </section>
  );
}

function MessageBubble({
  message,
}: {
  message: AdminChatbotConversationDetail["messages"][number];
}) {
  const isVisitor = message.role === "user";
  return (
    <div className={`flex flex-col ${isVisitor ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isVisitor
            ? "bg-ui-accent-soft text-ui-text"
            : "bg-ui-canvas text-ui-text border-ui-line border"
        }`}
      >
        {message.content || (
          <span className="text-ui-text-subtle italic">(empty)</span>
        )}
      </div>
      <span className="text-ui-text-subtle mt-1 text-[10px] tabular-nums">
        {isVisitor ? "Visitor" : "Assistant"}
        {message.ts ? ` · ${formatDateTime(message.ts)}` : ""}
      </span>
    </div>
  );
}

function FlagsPanel({
  conversationId,
  flags,
}: {
  conversationId: string;
  flags: AdminChatbotConversationDetail["flags"];
}) {
  const activeFlags = new Set(flags.map((f) => f.flag));
  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Flags</h2>
      <div className="mt-3 grid gap-1.5">
        {CHATBOT_FLAGS.map((flag) => (
          <FlagToggle
            key={flag}
            conversationId={conversationId}
            flag={flag}
            active={activeFlags.has(flag)}
          />
        ))}
      </div>
    </section>
  );
}

function FlagToggle({
  conversationId,
  flag,
  active,
}: {
  conversationId: string;
  flag: ChatbotFlag;
  active: boolean;
}) {
  const [, formAction] = useActionState(
    toggleConversationFlagAction,
    initialState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="flag" value={flag} />
      <ToggleButton active={active} label={FLAG_LABELS[flag]} />
    </form>
  );
}

function ToggleButton({ active, label }: { active: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={active}
      className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm font-medium transition disabled:opacity-50 ${
        active
          ? "border-ui-accent bg-ui-accent-soft text-ui-text"
          : "border-ui-line text-ui-text-muted hover:bg-ui-canvas"
      }`}
    >
      {label}
      <span aria-hidden="true" className="text-xs">
        {active ? "On" : "Off"}
      </span>
    </button>
  );
}

function NotePanel({
  conversationId,
  flags,
}: {
  conversationId: string;
  flags: AdminChatbotConversationDetail["flags"];
}) {
  const mostRecentFlag = flags[0] ?? null;
  const [note, setNote] = useState(mostRecentFlag?.note ?? "");
  const [state, formAction] = useActionState(
    saveConversationNoteAction,
    initialState,
  );

  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Reviewer note</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        {mostRecentFlag
          ? `Attaches to the "${FLAG_LABELS[mostRecentFlag.flag]}" flag.`
          : "Set a flag above first — a note needs one to attach to."}
      </p>
      <form action={formAction} className="mt-2 grid gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea
          name="note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={!mostRecentFlag}
          className={adminTextareaClass}
        />
        <div className="flex items-center gap-3">
          <SaveNoteButton disabled={!mostRecentFlag} />
          {state.status !== "idle" ? (
            <p
              className={`text-xs font-medium ${state.status === "error" ? "text-red-600" : "text-emerald-700"}`}
              role={state.status === "error" ? "alert" : "status"}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function SaveNoteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={adminSecondaryButtonClass}
    >
      {pending ? "Saving..." : "Save note"}
    </button>
  );
}

function LinkedLeadPanel({
  conversation,
}: {
  conversation: AdminChatbotConversationDetail;
}) {
  const lead = conversation.linkedLead;
  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Linked lead</h2>
      {lead ? (
        <div className="mt-2 text-sm">
          <Link
            href={`/admin/leads/${lead.id}`}
            className="text-ui-accent font-medium hover:underline"
          >
            {lead.fullName}
          </Link>
          <p className="text-ui-text-muted mt-1">{lead.email}</p>
          {lead.phone ? (
            <p className="text-ui-text-muted">{lead.phone}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <AdminStatusBadge status={lead.status} />
            {lead.closeSyncStatus ? (
              <AdminStatusBadge status={lead.closeSyncStatus} />
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-ui-text-subtle mt-2 text-sm">
          No lead_submissions row linked yet.
        </p>
      )}
    </section>
  );
}

function HandoffPanel({
  conversation,
}: {
  conversation: AdminChatbotConversationDetail;
}) {
  const [reason, setReason] = useState(conversation.handoffReason ?? "");
  const [state, formAction] = useActionState(
    handOffConversationAction,
    initialState,
  );
  const alreadyHandedOff = conversation.status === "handed_off";

  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Hand off to team</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Marks this conversation as needing a human follow-up. The team
        notification email ships with Phase 4 — this records the handoff now.
      </p>
      <form action={formAction} className="mt-2 grid gap-2">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <input
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why does this need a human?"
          className={adminInputClass}
        />
        <div className="flex items-center gap-3">
          <HandoffButton alreadyHandedOff={alreadyHandedOff} />
          {state.status !== "idle" ? (
            <p
              className={`text-xs font-medium ${state.status === "error" ? "text-red-600" : "text-emerald-700"}`}
              role={state.status === "error" ? "alert" : "status"}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function HandoffButton({ alreadyHandedOff }: { alreadyHandedOff: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={adminPrimaryButtonClass}
    >
      {pending ? "Saving..." : alreadyHandedOff ? "Update handoff" : "Hand off"}
    </button>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
