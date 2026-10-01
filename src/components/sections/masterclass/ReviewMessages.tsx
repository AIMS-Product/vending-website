import {
  COMMS_COPY,
  COMMS_MESSAGES,
  COMMS_PHASES,
} from "@/lib/content/masterclass-review-comms";
import type {
  CommsChannel,
  CommsMessage,
} from "@/lib/content/masterclass-review-comms-types";
import { cn } from "@/lib/utils";
import {
  CARD,
  CHANNEL_CHIP,
  CHANNEL_LABEL,
  CHIP,
  H2,
  WithPlaceholders,
} from "./ReviewCommsShared";

function firstLine(message: CommsMessage) {
  if (message.subject) return message.subject;
  const line = message.body.split("\n").find((l) => l.trim()) ?? "";
  return line.length > 90 ? `${line.slice(0, 87)}…` : line;
}

function FlagBox({ flag }: { flag: NonNullable<CommsMessage["flag"]> }) {
  return (
    <div className="mt-3 rounded-md border-l-4 border-red-600 bg-red-50 p-3 text-sm">
      <p className="text-ink font-black">Needs fixing</p>
      <p className="mt-1 text-slate-700">{flag.issue}</p>
      <p className="mt-1 text-slate-700">
        <span className="font-bold">Should be: </span>
        {flag.fix}
      </p>
      <p className="mt-1 font-bold text-slate-700">
        {flag.owner} · by {flag.due}
      </p>
    </div>
  );
}

function MessageBody({ message }: { message: CommsMessage }) {
  if (message.channel === "sms") {
    return (
      <div className="max-w-[46ch] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-slate-800">
        <WithPlaceholders text={message.body} />
      </div>
    );
  }
  return (
    <div className="rounded-control border border-slate-300">
      <div className="border-b border-slate-200 px-4 py-2 text-sm text-slate-600">
        <p>
          <span className="font-bold">From:</span> {message.from}
        </p>
        {message.subject ? (
          <p>
            <span className="font-bold">Subject:</span> {message.subject}
          </p>
        ) : null}
      </div>
      <div className="px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-slate-800">
        <WithPlaceholders text={message.body} />
      </div>
    </div>
  );
}

function MessageCard({ message }: { message: CommsMessage }) {
  return (
    <li id={`msg-${message.id}`} className="scroll-mt-6">
      <details
        // Problems are open from the start, so nothing that needs fixing
        // hides behind a click.
        open={Boolean(message.flag)}
        className={cn(CARD, "group", message.flag && "border-red-600")}
      >
        <summary className="hover:bg-tint flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className={cn(CHIP, CHANNEL_CHIP[message.channel])}>
                {CHANNEL_LABEL[message.channel]}
              </span>
              <span className="text-sm font-bold text-slate-600">
                {message.when}
              </span>
              {message.flag ? (
                <span className={cn(CHIP, "bg-red-600 text-white")}>
                  Fix: {message.flag.owner}
                </span>
              ) : null}
              {!message.verbatim ? (
                <span className={cn(CHIP, "bg-slate-100 text-slate-600")}>
                  Summary
                </span>
              ) : null}
            </span>
            <span className="text-ink mt-1 block font-black text-pretty">
              <WithPlaceholders text={firstLine(message)} />
            </span>
          </span>
          <span
            aria-hidden
            className="text-ink mt-1 shrink-0 text-lg leading-none font-black transition-transform group-open:rotate-45"
          >
            +
          </span>
        </summary>
        <div className="px-4 pb-4">
          <MessageBody message={message} />
          {message.links?.length ? (
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-bold">Links go to:</span>{" "}
              {message.links.join(" · ")}
            </p>
          ) : null}
          {message.flag ? <FlagBox flag={message.flag} /> : null}
        </div>
      </details>
    </li>
  );
}

/** Every text, email and voicemail a registrant gets, in order, by branch. */
export function ReviewMessages() {
  const count = (channel: CommsChannel) =>
    COMMS_MESSAGES.filter((m) => m.channel === channel).length;
  const flagged = COMMS_MESSAGES.filter((m) => m.flag);
  const stats = [
    { figure: count("sms"), label: "Texts" },
    { figure: count("email"), label: "Emails" },
    { figure: count("voice") + count("zoom"), label: "Voicemail + Zoom" },
    { figure: flagged.length, label: "Need fixing" },
  ];
  return (
    <section aria-labelledby="messages-heading">
      <h2 id="messages-heading" className={H2}>
        {COMMS_COPY.messagesHeading}
      </h2>
      <p className="mt-3 max-w-[64ch] text-[15px] text-slate-600">
        {COMMS_COPY.messagesIntro}
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className={cn(CARD, "p-3 text-center")}>
            <p
              className={cn(
                "v2-display text-3xl leading-none",
                s.label === "Need fixing" && s.figure > 0
                  ? "text-red-600"
                  : "text-brand-700",
              )}
            >
              {s.figure}
            </p>
            <p className="text-ink mt-1 text-xs font-black uppercase">
              {s.label}
            </p>
          </li>
        ))}
      </ul>

      {flagged.length ? (
        <div className="mt-5 rounded-md border-l-4 border-red-600 bg-red-50 p-4">
          <p className="text-ink font-black uppercase">
            {COMMS_COPY.fixListHeading}
          </p>
          <ul className="mt-2 grid gap-1 text-sm">
            {flagged.map((m) => (
              <li key={m.id}>
                <a
                  href={`#msg-${m.id}`}
                  className="text-ink font-bold underline underline-offset-2"
                >
                  <WithPlaceholders text={firstLine(m)} />
                </a>{" "}
                <span className="text-slate-600">
                  · {m.flag?.owner} · by {m.flag?.due}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <nav aria-label="Message branches" className="mt-5 flex flex-wrap gap-2">
        {COMMS_PHASES.map((phase) => (
          <a
            key={phase.id}
            href={`#phase-${phase.id}`}
            className="border-ink rounded-control text-ink hover:bg-tint border-2 bg-white px-3 py-1.5 text-sm font-black"
          >
            {phase.title}
          </a>
        ))}
      </nav>

      {COMMS_PHASES.map((phase) => {
        const messages = COMMS_MESSAGES.filter((m) => m.phase === phase.id);
        if (!messages.length) return null;
        return (
          <div key={phase.id} id={`phase-${phase.id}`} className="scroll-mt-6">
            <h3 className="text-ink mt-10 text-xl font-black uppercase">
              {phase.title}
            </h3>
            <p className="text-sm text-slate-600">
              {phase.who} · {messages.length}{" "}
              {messages.length === 1 ? "message" : "messages"}
            </p>
            <ol className="mt-4 grid gap-3">
              {messages.map((m) => (
                <MessageCard key={m.id} message={m} />
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
