import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ChatDisplayMessage } from "@/components/chatbot/ChatTranscript";

/**
 * Renders the non-text message kinds (see conversation-store's
 * ChatbotMessageKind). Every card degrades to its plain `content` line when
 * its payload is missing or malformed — a hand-edited row, an older deploy,
 * or a kind this build doesn't know must never render an empty bubble.
 */
export function ChatRichMessage({
  message,
  brandColor,
}: {
  message: ChatDisplayMessage;
  brandColor: string;
}) {
  switch (message.kind) {
    case "calendar":
      return <CalendarCard message={message} brandColor={brandColor} />;
    case "resource_card":
      return <ResourceCard message={message} brandColor={brandColor} />;
    case "booking_confirmed":
      return <BookingConfirmedCard message={message} brandColor={brandColor} />;
    default:
      return <FallbackLine content={message.content} />;
  }
}

const cardClass =
  "w-full max-w-[92%] overflow-hidden rounded-[8px] border-2 border-[#111111] bg-white";

function CalendarCard({
  message,
  brandColor,
}: {
  message: ChatDisplayMessage;
  brandColor: string;
}) {
  const url = readString(message.data, "url");
  if (!url) return <FallbackLine content={message.content} />;

  return (
    <div className={cardClass}>
      <CardHeader
        brandColor={brandColor}
        icon={<CalendarIcon />}
        label="Pick a time"
      />
      {/*
        A plain iframe rather than react-calendly: the embed is one URL with
        query params (see lib/chatbot/booking.ts), and a dependency buys
        nothing here. The height is fixed because Calendly's postMessage
        resize events are the only way to size it dynamically and that is a
        lot of machinery for one panel.
      */}
      <iframe
        src={url}
        title="Book a free 15-minute call"
        className="h-[440px] w-full border-0 bg-white"
        loading="lazy"
      />
      <p className="border-t-2 border-[#111111] px-3 py-2 text-[13px] leading-snug text-[#4b5563]">
        Free, 15 minutes, no purchase required.
      </p>
    </div>
  );
}

type ResourceEntry = { title: string; blurb: string; url: string };

function ResourceCard({
  message,
  brandColor,
}: {
  message: ChatDisplayMessage;
  brandColor: string;
}) {
  const resources = readResources(message.data);
  const email = readString(message.data, "email");
  if (resources.length === 0) return <FallbackLine content={message.content} />;

  return (
    <div className={cardClass}>
      <CardHeader
        brandColor={brandColor}
        icon={<MailIcon />}
        label={email ? `Sent to ${email}` : "Sent to your inbox"}
      />
      <ul className="divide-y-2 divide-[#111111]">
        {resources.map((resource) => (
          <li key={resource.url} className="px-3 py-2.5">
            <a
              href={resource.url}
              className="text-[15px] font-black text-[#111111] underline"
            >
              {resource.title}
            </a>
            <p className="mt-0.5 text-[13px] leading-snug text-[#4b5563]">
              {resource.blurb}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BookingConfirmedCard({
  message,
  brandColor,
}: {
  message: ChatDisplayMessage;
  brandColor: string;
}) {
  const startsAt = readString(message.data, "starts_at");
  return (
    <div className={cardClass}>
      <CardHeader
        brandColor={brandColor}
        icon={<CheckIcon />}
        label="You're booked"
      />
      <p className="px-3 py-2.5 text-[15px] leading-snug text-[#111111]">
        {formatStartsAt(startsAt) ?? message.content}
      </p>
    </div>
  );
}

function CardHeader({
  brandColor,
  icon,
  label,
}: {
  brandColor: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-2 border-b-2 border-[#111111] px-3 py-2 text-[13px] font-black text-white"
      style={{ backgroundColor: brandColor }}
    >
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

function FallbackLine({ content }: { content: string }) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-[8px] border-2 border-[#111111] bg-white px-4 py-3",
        "text-[15px] leading-relaxed whitespace-pre-wrap text-[#111111]",
      )}
    >
      {content}
    </div>
  );
}

// Lucide paths inlined, matching ChatLauncher.tsx — the widget ships no icon
// dependency and these three are the whole need.
const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  className: "shrink-0",
} as const;

function CalendarIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function formatStartsAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `You're on the calendar for ${date.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}. Check your email for the invite.`;
}

function readString(
  data: ChatDisplayMessage["data"],
  key: string,
): string | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readResources(data: ChatDisplayMessage["data"]): ResourceEntry[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as Record<string, unknown>).resources;
  if (!Array.isArray(raw)) return [];

  const entries: ResourceEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = record.title;
    const url = record.url;
    if (typeof title !== "string" || typeof url !== "string") continue;
    // Relative paths only: the catalog is a closed list of site pages, so an
    // absolute URL here would mean something upstream went wrong.
    if (!url.startsWith("/")) continue;
    entries.push({
      title,
      blurb: typeof record.blurb === "string" ? record.blurb : "",
      url,
    });
  }
  return entries;
}
