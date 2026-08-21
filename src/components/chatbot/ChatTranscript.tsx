import { cn } from "@/lib/utils";
import { parseChatLinks } from "@/lib/chatbot/parse-chat-links";

export interface ChatDisplayMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatTranscriptProps {
  personaName: string;
  avatarUrl: string | null;
  brandColor: string;
  messages: ChatDisplayMessage[];
  /** The in-flight assistant reply, appended chunk by chunk while streaming. */
  streamingText: string | null;
  isWaiting: boolean;
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
      {isWaiting && streamingText === null ? (
        <TypingIndicator
          personaName={personaName}
          avatarUrl={avatarUrl}
          brandColor={brandColor}
        />
      ) : null}
    </div>
  );
}

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
  // Links are only parsed into real anchors once the message is done
  // streaming, so it's fine for `[text](url)` to show briefly mid-stream.
  const content =
    !isUser && !isStreaming ? parseChatLinks(message.content) : message.content;
  return (
    <div className={cn("flex items-end gap-2", isUser && "flex-row-reverse")}>
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
          isUser ? "text-white" : "bg-white text-[#111111]",
        )}
        style={isUser ? { backgroundColor: brandColor } : undefined}
      >
        {content}
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
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#111111] text-xs font-black text-white"
      style={{ backgroundColor: brandColor }}
    >
      {personaName.slice(0, 1).toUpperCase()}
    </div>
  );
}
