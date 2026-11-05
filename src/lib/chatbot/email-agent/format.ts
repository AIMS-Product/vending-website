/**
 * Agent emails as a person would write them: short paragraphs, the date in
 * bold, times as tap-to-book links. Every email gets a plain-text twin.
 */

export type EmailBlock =
  | { kind: "p"; text: string }
  | { kind: "slots"; slots: Array<{ label: string; url: string | null }> }
  | { kind: "link"; text: string; url: string };

const DATE_PATTERN =
  /\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day(?:,? (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2})?(?: at \d{1,2}(?::\d{2})? ?(?:AM|PM|am|pm)(?: [A-Z]{2,4})?)?/g;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bold every day / date / time phrase ("Thursday, Nov 5 at 9:00 AM PT"). */
export function boldDates(text: string): string {
  return escapeHtml(text).replace(DATE_PATTERN, (m) => `<b>${m}</b>`);
}

export function renderEmail(input: {
  greetingName: string;
  blocks: EmailBlock[];
  persona: string;
}): { text: string; html: string } {
  const greeting = `Hi${input.greetingName ? ` ${input.greetingName}` : ""},`;
  const footer = 'Not interested? Just reply "stop" and I won\'t email again.';

  const textParts = [greeting];
  const htmlParts = [`<p>${escapeHtml(greeting)}</p>`];
  for (const block of input.blocks) {
    if (block.kind === "p") {
      textParts.push(block.text);
      htmlParts.push(`<p>${boldDates(block.text).replace(/\n/g, "<br>")}</p>`);
    } else if (block.kind === "slots") {
      textParts.push(
        block.slots
          .map((s) => `- ${s.label}${s.url ? `: ${s.url}` : ""}`)
          .join("\n"),
      );
      htmlParts.push(
        `<ul style="padding-left:18px;margin:0 0 14px">${block.slots
          .map((s) =>
            s.url
              ? `<li style="margin:6px 0"><a href="${escapeHtml(s.url)}" style="color:#1d4ed8;font-weight:600">${escapeHtml(s.label)}</a></li>`
              : `<li style="margin:6px 0"><b>${escapeHtml(s.label)}</b></li>`,
          )
          .join("")}</ul>`,
      );
    } else {
      textParts.push(`${block.text}: ${block.url}`);
      htmlParts.push(
        `<p><a href="${escapeHtml(block.url)}" style="color:#1d4ed8">${escapeHtml(block.text)}</a></p>`,
      );
    }
  }
  textParts.push(input.persona, footer);
  htmlParts.push(
    `<p>${escapeHtml(input.persona)}</p>`,
    `<p style="color:#9ca3af;font-size:12px">${escapeHtml(footer)}</p>`,
  );
  return {
    text: textParts.join("\n\n"),
    html: `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${htmlParts.join("")}</div>`,
  };
}

/** "Thursday, Nov 5 at 9:00 AM" in the zone. */
export function slotLabel(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const zone =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortGeneric" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${day} at ${time}${zone ? ` ${zone}` : ""}`;
}

/**
 * Calendly opens straight on the details form for one slot when the start
 * time (with the zone's offset) is the last path segment; name, email and
 * the phone question (a1) prefill, so the lead only presses Schedule Event.
 */
export function slotBookingUrl(input: {
  baseUrl: string;
  slotIso: string;
  timeZone: string;
  name: string | null;
  email: string;
  phone: string | null;
  conversationId: string;
}): string | null {
  let url: URL;
  try {
    url = new URL(input.baseUrl);
  } catch {
    return null;
  }
  const date = new Date(input.slotIso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: input.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const offset = get("timeZoneName").replace("GMT", "") || "+00:00";
  const local = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${offset}`;

  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${local}`;
  url.search = "";
  url.searchParams.set("month", `${get("year")}-${get("month")}`);
  url.searchParams.set("date", `${get("year")}-${get("month")}-${get("day")}`);
  if (input.name) url.searchParams.set("name", input.name);
  url.searchParams.set("email", input.email);
  if (input.phone) url.searchParams.set("a1", input.phone);
  url.searchParams.set("utm_source", "chatbot");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_content", input.conversationId);
  return url.toString();
}
