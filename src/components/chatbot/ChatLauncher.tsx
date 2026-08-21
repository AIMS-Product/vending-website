/**
 * Presentational pieces split out of ChatWidget.tsx to keep that file under
 * the house ~400-line guideline: the panel header, message input bar,
 * closed-state launcher bubble, idle teaser bubble, quick-actions bar, and
 * their icons. No state of their own beyond the form input — ChatWidget owns
 * everything.
 */

import Link from "next/link";
import type { ChatbotQuickAction } from "@/lib/chatbot/config";

export function PanelHeader({
  personaName,
  avatarUrl,
  brandColor,
  onClose,
}: {
  personaName: string;
  avatarUrl: string | null;
  brandColor: string;
  onClose: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between border-b-2 border-[#111111] px-4 py-3"
      style={{ backgroundColor: brandColor }}
    >
      <div className="flex items-center gap-2">
        {avatarUrl ? (
          <span className="relative inline-flex h-7 w-7 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- small header avatar, no responsive sizing needed */}
            <img
              src={avatarUrl}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-full border-2 border-[#111111] object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute right-0 bottom-0 h-2 w-2 rounded-full bg-[#22c55e] ring-2 ring-white"
            />
          </span>
        ) : null}
        <div>
          <p className="text-sm font-black text-white">{personaName}</p>
          <p className="flex items-center gap-1 text-[11px] leading-none text-white/85">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[#22c55e]"
            />
            Online · Usually replies instantly
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close chat"
        className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-white hover:bg-black/10"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/** Config-driven button row under the header — see ChatbotConfig.quickActions. Renders nothing when unconfigured. */
export function QuickActionsBar({
  actions,
}: {
  actions: ChatbotQuickAction[];
}) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 border-b-2 border-[#111111] bg-[#f8fafc] px-3 py-2">
      {actions.map((action) => (
        <Link
          key={action.url + action.label}
          href={action.url}
          className="inline-flex items-center gap-1 rounded-[6px] border-2 border-[#111111] bg-white px-2 py-1 text-xs font-bold text-[#111111] hover:bg-[#f3f4f6]"
        >
          <ArrowRightIcon />
          {action.label}
        </Link>
      ))}
    </div>
  );
}

export function MessageInput({
  brandColor,
  value,
  onChange,
  onSend,
  disabled,
}: {
  brandColor: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
      className="flex items-center gap-2 border-t-2 border-[#111111] p-3"
    >
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type a message..."
        aria-label="Message"
        className="min-w-0 flex-1 rounded-[6px] border-2 border-[#111111] px-3 py-2 text-sm text-[#111111] outline-none focus-visible:ring-2 focus-visible:ring-[#066a99]"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border-2 border-[#111111] text-white disabled:opacity-50"
        style={{ backgroundColor: brandColor }}
      >
        <SendIcon />
      </button>
    </form>
  );
}

/** Tappable pill chips above the input — see ChatbotConfig.starterQuestions. ChatWidget only renders this before the visitor's first message. */
export function StarterQuestionChips({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (question: string) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-2">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onSelect(question)}
          className="rounded-full border-2 border-[#111111] bg-white px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#f3f4f6]"
        >
          {question}
        </button>
      ))}
    </div>
  );
}

export function LauncherButton({
  brandColor,
  personaName,
  avatarUrl,
  onClick,
}: {
  brandColor: string;
  personaName: string;
  avatarUrl: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open chat with ${personaName}`}
      className="relative inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#111111] text-white shadow-[4px_4px_0_#111111]"
      style={{ backgroundColor: brandColor }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- small launcher avatar, no responsive sizing needed
        <img
          src={avatarUrl}
          alt=""
          width={56}
          height={56}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <ChatBubbleIcon />
      )}
      <span
        aria-hidden="true"
        className="absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#22c55e]"
      />
    </button>
  );
}

export function TeaserBubble({
  text,
  avatarUrl,
  onOpen,
  onDismiss,
}: {
  text: string;
  avatarUrl: string | null;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex max-w-[240px] items-start gap-2 rounded-[8px] border-2 border-[#111111] bg-white px-3 py-2 shadow-[4px_4px_0_#111111]">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- small teaser avatar, no responsive sizing needed
        <img
          src={avatarUrl}
          alt=""
          width={24}
          height={24}
          className="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 border-[#111111] object-cover"
        />
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 text-left text-sm text-[#111111]"
      >
        {text}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-[#6b7280] hover:text-[#111111]"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
