import { cn } from "@/lib/utils";
import { ChatRichMessage } from "@/components/chatbot/ChatRichMessage";
import { parseChatLinks } from "@/lib/chatbot/parse-chat-links";

export interface ChatDisplayMessage {
  role: "user" | "assistant";
  content: string;
  /** Absent means a plain text bubble — see conversation-store's ChatbotMessageKind. */
  kind?: "text" | "calendar" | "resource_card" | "booking_confirmed";
  data?: Record<string, unknown> | null;
}

interface ChatTranscriptProps {
  personaName: string;
  avatarUrl: string | null;
  brandColor: string;
  messages: ChatDisplayMessage[];
  /** The in-flight assistant reply, appended chunk by chunk while streaming. */
  streamingText: string | null;
  isWaiting: boolean;
  /** Set while a tool runs, e.g. "finding_times" as the calendar is fetched. */
  toolStatus: "finding_times" | null;
}

/**
 * Message list only — capture cards are injected into this same flow by
 * ChatWidget (they need access to submit state ChatTranscript doesn't own).
 * `aria-live="polite"` announces new turns without interrupting the visitor
 * mid-typing.
 */
export function ChatTranscript({
  personaName,
  avatarUrl,
  brandColor,
  messages,
  streamingText,
  isWaiting,
  toolStatus,
}: ChatTranscriptProps) {
  return (
    <div
      aria-live="polite"
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
    >
      {messages.map((message, index) => (
        <MessageBubble
          key={index}
          message={message}
          personaName={personaName}
          avatarUrl={avatarUrl}
          brandColor={brandColor}
        />
      ))}
      {streamingText !== null ? (
        <MessageBubble
          message={{ role: "assistant", content: streamingText }}
          personaName={personaName}
          avatarUrl={avatarUrl}
          brandColor={brandColor}
          isStreaming
        />
      ) : null}
      {toolStatus === "finding_times" ? (
        <PendingLine
          personaName={personaName}
          avatarUrl={avatarUrl}
          brandColor={brandColor}
          label={`${personaName} is finding times…`}
        />
      ) : null}
      {isWaiting && streamingText === null && toolStatus === null ? (
        <TypingIndicator
          personaName={personaName}
          avatarUrl={avatarUrl}
          brandColor={brandColor}
        />
      ) : null}
    </div>
  );
}

/**
 * Entrance animation. Every bubble gets it, including rich cards — a card
 * that pops in without the same rise reads as a page element rather than
 * something the persona just sent. Same `motion-safe:animate-[...]` +
 * @keyframes convention SitePopup uses, so there is one animation approach in
 * the codebase rather than two.
 */
const ENTER_ANIMATION =
  "motion-safe:animate-[vp-chat-message-in_220ms_ease-out]";

function MessageBubble({
  message,
  personaName,
  avatarUrl,
  brandColor,
  isStreaming = false,
}: {
  message: ChatDisplayMessage;
  personaName: string;
  avatarUrl: string | null;
  brandColor: string;
  /** Still receiving chunks — render raw text; links resolve once the message completes. */
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  const isRich = Boolean(message.kind && message.kind !== "text");

  if (isRich) {
    return (
      <div className={cn("flex items-end gap-2", ENTER_ANIMATION)}>
        <PersonaAvatar
          personaName={personaName}
          avatarUrl={avatarUrl}
          brandColor={brandColor}
        />
        <ChatRichMessage message={message} brandColor={brandColor} />
      </div>
    );
  }

  // Links are only parsed into real anchors once the message is done
  // streaming, so it's fine for `[text](url)` to show briefly mid-stream.
  const content =
    !isUser && !isStreaming ? parseChatLinks(message.content) : message.content;
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isUser && "flex-row-reverse",
        // A streaming bubble re-renders on every chunk; re-running the
        // entrance animation each time would make it flicker.
        !isStreaming && ENTER_ANIMATION,
      )}
    >
      {isUser ? null : (
        <PersonaAvatar
          personaName={personaName}
          avatarUrl={avatarUrl}
          brandColor={brandColor}
        />
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-[8px] border-2 border-[#111111] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap",
          isUser ? "text-[#111111]" : "bg-white text-[#111111]",
        )}
        style={isUser ? { backgroundColor: brandColor } : undefined}
      >
        {content}
      </div>
    </div>
  );
}

function PendingLine({
  personaName,
  avatarUrl,
  brandColor,
  label,
}: {
  personaName: string;
  avatarUrl: string | null;
  brandColor: string;
  label: string;
}) {
  return (
    <div className={cn("flex items-end gap-2", ENTER_ANIMATION)}>
      <PersonaAvatar
        personaName={personaName}
        avatarUrl={avatarUrl}
        brandColor={brandColor}
      />
      <div className="rounded-[8px] border-2 border-dashed border-[#111111] bg-white px-3 py-2 text-[13px] font-bold text-[#4b5563]">
        {label}
      </div>
    </div>
  );
}

function TypingIndicator({
  personaName,
  avatarUrl,
  brandColor,
}: {
  personaName: string;
  avatarUrl: string | null;
  brandColor: string;
}) {
  return (
    <div
      className="flex items-end gap-2"
      aria-label={`${personaName} is typing`}
    >
      <PersonaAvatar
        personaName={personaName}
        avatarUrl={avatarUrl}
        brandColor={brandColor}
      />
      <div className="flex items-center gap-1 rounded-[8px] border-2 border-[#111111] bg-white px-3 py-2.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#6b7280] [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#6b7280] [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#6b7280]" />
      </div>
    </div>
  );
}

function PersonaAvatar({
  personaName,
  avatarUrl,
  brandColor,
}: {
  personaName: string;
  avatarUrl: string | null;
  brandColor: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small remote/admin-uploaded avatar, not worth next/image's fixed-size ceremony here.
      <img
        src={avatarUrl}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full border-2 border-[#111111] object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#111111] text-xs font-black text-[#111111]"
      style={{ backgroundColor: brandColor }}
    >
      {personaName.slice(0, 1).toUpperCase()}
    </div>
  );
}
