"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { captureAggressivenessThreshold } from "@/lib/chatbot/capture-thresholds";
import {
  VP_CHAT_VISITOR_COOKIE_MAX_AGE_SECONDS,
  VP_CHAT_VISITOR_COOKIE_NAME,
} from "@/lib/chatbot/constants";
import {
  ChatCaptureForm,
  type ChatCaptureValues,
} from "@/components/chatbot/ChatCaptureForm";
import {
  ChatTranscript,
  type ChatDisplayMessage,
} from "@/components/chatbot/ChatTranscript";
import {
  LauncherButton,
  MessageInput,
  PanelHeader,
  QuickActionsBar,
  StarterQuestionChips,
  TeaserBubble,
} from "@/components/chatbot/ChatLauncher";
import type { ChatbotQuickAction } from "@/lib/chatbot/config";
import { playReceiveSound, playSendSound } from "@/lib/chatbot/sounds";

const SESSION_STORAGE_KEY = "vp_chat_session_id";
const TEASER_DISMISSED_KEY = "vp_chat_teaser_dismissed";
const CAPTURED_KEY = "vp_chat_captured";
// Persisted so a page navigation (which remounts this component and wipes
// React state) doesn't close an open panel or re-offer a capture card the
// visitor already saw — see spec item 1.
const OPEN_KEY = "vp_chat_open";
const CAPTURE_OFFERED_KEY = "vp_chat_capture_offered";
const EXIT_INTENT_OFFERED_KEY = "vp_chat_exit_intent_offered";
const DEFAULT_BRAND_COLOR = "#2a8fcc";
const ON_INTENT_DELAY_MS = 800;
/**
 * How long the in-chat calendar gets alone with the visitor before the capture
 * card appears underneath it. Long enough not to talk over someone who is
 * picking a time, short enough to still be there when they decide not to.
 */
const CALENDAR_CAPTURE_DELAY_MS = 45_000;

/**
 * Copy for the inline capture card, per trigger. The calendar variant asks for
 * a reason the visitor already has ("none of these times work") rather than
 * repeating an offer they just declined.
 */
/**
 * The origin of the Calendly embed currently in the transcript. Used to check
 * postMessage senders, so it must come from the URL we actually rendered.
 */
function calendarOrigin(messages: ChatDisplayMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.kind !== "calendar") continue;
    const url = message.data?.url;
    if (typeof url !== "string") continue;
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }
  return null;
}

const CAPTURE_CARD_COPY = {
  on_intent: {
    title: "Want us to follow up?",
    body: "Leave your email and the team can send more details.",
  },
  exit_intent: {
    title: "Before you go",
    body: "Before you go, want me to email you this conversation plus the free roadmap?",
  },
  calendar_shown: {
    // No promise of a price: the bot is under an absolute rule never to state
    // one, so "I will send the breakdown" would be a promise it cannot keep.
    // A rep following up from Close is what actually happens next.
    title: "None of those times work?",
    body: "Leave your email and the team will follow up with times that do.",
  },
} as const;
const LOOSE_EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// Human-feeling response timing (naturalness pass): a real reply never lands
// instantly, so the typing indicator holds for a bit before the stream is
// rendered, and the scripted greeting/follow-up get the same treatment.
const REPLY_TYPING_DELAY_MIN_MS = 2200;
const REPLY_TYPING_DELAY_MAX_MS = 4200;
const GREETING_TYPING_DELAY_MS = 800;
const FOLLOW_UP_TYPING_DELAY_MS = 1200;

type PublicChatbotConfig = {
  enabled: boolean;
  personaName: string;
  avatarUrl: string | null;
  greeting: string | null;
  followUpMessage: string | null;
  teaserText: string | null;
  brandColor: string | null;
  idleTriggerSeconds: number;
  captureMode: "pre_chat" | "on_intent" | "off";
  captureAggressiveness: "relaxed" | "balanced" | "eager";
  exitIntentCapture: boolean;
  starterQuestions: string[];
  quickActions: ChatbotQuickAction[];
};

type ChatHistoryResponse = {
  messages: ChatDisplayMessage[];
  status: string;
  captured: boolean;
  /** Conversation-tagged Calendly URL — null until a conversation row exists. */
  bookingUrl: string | null;
};

/**
 * Mounted once in the root layout, after <TrackingScripts/> (see spec). Fetches
 * its own config and renders nothing until it resolves `enabled: true` and the
 * route isn't an admin page — same exclusion the attribution tracker uses.
 */
export function ChatWidget() {
  const pathname = usePathname() ?? "/";
  const [config, setConfig] = useState<PublicChatbotConfig | null>(null);
  // Lazy initializers below read sessionStorage exactly once, before first
  // paint, so a page navigation (which fully remounts this component) does
  // not visibly close the panel, re-run the greeting, or forget what the
  // visitor already dismissed/completed. Safe under SSR too — readSessionFlag's
  // try/catch absorbs the ReferenceError from a missing `window`.
  const [open, setOpenState] = useState(() => readSessionFlag(OPEN_KEY));
  const [showTeaser, setShowTeaser] = useState(false);
  const [messages, setMessages] = useState<ChatDisplayMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [captured, setCaptured] = useState(() => readSessionFlag(CAPTURED_KEY));
  const [showInlineCapture, setShowInlineCapture] = useState(false);
  // Which trigger is showing the inline capture card — changes its copy.
  const [inlineCaptureContext, setInlineCaptureContext] = useState<
    "on_intent" | "exit_intent" | "calendar_shown"
  >("on_intent");
  const [error, setError] = useState<string | null>(null);
  // Transient "Mia is finding times…" line while a server-side tool runs.
  const [toolStatus, setToolStatus] = useState<"finding_times" | null>(null);
  // Gates the greeting effect until the history fetch below resolves (found
  // or not) — otherwise a returning visitor would see the greeting flash
  // before their real transcript replaces it.
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const assistantReplyCountRef = useRef(0);
  const hasOfferedCaptureRef = useRef(readSessionFlag(CAPTURE_OFFERED_KEY));
  const hasOfferedExitIntentRef = useRef(
    readSessionFlag(EXIT_INTENT_OFFERED_KEY),
  );
  const hasGreetedRef = useRef(false);
  // Mirrors of state the deferred calendar-capture timer has to read at fire
  // time, minutes after the closure that armed it was created.
  const capturedRef = useRef(captured);
  const messagesRef = useRef<ChatDisplayMessage[]>([]);
  const openRef = useRef(false);
  const showInlineCaptureRef = useRef(false);
  /** Set by the Calendly embed's own confirmation event. See the effect below. */
  const bookedRef = useRef(false);
  const calendarCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    if (value) writeSessionFlag(OPEN_KEY);
    else clearSessionFlag(OPEN_KEY);
  }, []);

  // Admin pages never render the widget (see `enabled` below) — skip the
  // fetch entirely there too, so admin page loads make zero chatbot
  // requests instead of fetching config just to throw it away.
  useEffect(() => {
    if (isAdminRoute) return;
    fetch("/api/chatbot/config")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PublicChatbotConfig | null) => setConfig(data))
      .catch(() => setConfig(null));
  }, [isAdminRoute]);

  // Session id + transcript rehydration. The conversation row is already
  // authoritative server-side (see conversation-store.ts) — this just reads
  // it back so a page navigation doesn't wipe what the visitor already said.
  // A brand-new session id 404s harmlessly (no row yet).
  useEffect(() => {
    if (isAdminRoute) return;
    const sessionId = readOrCreateSessionId();
    sessionIdRef.current = sessionId;
    ensureVisitorCookie();

    let cancelled = false;
    fetch(`/api/chatbot/history?sessionId=${encodeURIComponent(sessionId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ChatHistoryResponse | null) => {
        if (cancelled) return;
        if (data && data.messages.length > 0) {
          setMessages(data.messages);
          // The greeting/follow-up are never persisted server-side (see
          // build-system-prompt/conversation-store) — they're a client-only
          // prefix that only makes sense on a truly empty transcript, so a
          // returning visitor skips straight to their real history instead
          // of seeing the welcome message replay.
          hasGreetedRef.current = true;
        }
        if (data?.captured) {
          setCaptured(true);
          writeSessionFlag(CAPTURED_KEY);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdminRoute]);

  const enabled = Boolean(config?.enabled) && !isAdminRoute;

  // Teaser bubble after idleTriggerSeconds (0 disables it), unless already
  // dismissed this session or the panel is already open.
  useEffect(() => {
    if (!enabled || !config || open) return;
    if (config.idleTriggerSeconds <= 0) return;
    if (readSessionFlag(TEASER_DISMISSED_KEY)) return;

    const timer = setTimeout(
      () => setShowTeaser(true),
      config.idleTriggerSeconds * 1000,
    );
    return () => clearTimeout(timer);
  }, [enabled, config, open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  const needsGate = config?.captureMode === "pre_chat" && !captured;

  // Greeting + optional follow-up, injected once the transcript is actually
  // reachable (immediately, or right after the pre_chat gate clears). Both
  // setState calls are deferred to timers rather than run synchronously in
  // the effect body (react-hooks/set-state-in-effect) — 0ms for the greeting
  // still reads as instant, 600ms for the follow-up is the deliberate beat
  // the spec calls for.
  useEffect(() => {
    if (
      !open ||
      needsGate ||
      hasGreetedRef.current ||
      !config ||
      !historyLoaded
    )
      return;
    hasGreetedRef.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const followUpMessage = config.followUpMessage;

    // Deferred via setTimeout(fn, 0) rather than called directly in the
    // effect body — same react-hooks/set-state-in-effect reasoning as below.
    const showFollowUpTyping = () => {
      if (!followUpMessage) return;
      timers.push(setTimeout(() => setIsWaiting(true), 0));
      timers.push(
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: followUpMessage },
          ]);
          setIsWaiting(false);
        }, FOLLOW_UP_TYPING_DELAY_MS),
      );
    };

    const greeting = config.greeting;
    if (greeting) {
      timers.push(setTimeout(() => setIsWaiting(true), 0));
      timers.push(
        setTimeout(() => {
          setMessages([{ role: "assistant", content: greeting }]);
          setIsWaiting(false);
          showFollowUpTyping();
        }, GREETING_TYPING_DELAY_MS),
      );
    } else {
      showFollowUpTyping();
    }
    return () => timers.forEach(clearTimeout);
  }, [open, needsGate, config, historyLoaded]);

  useEffect(() => {
    capturedRef.current = captured;
  }, [captured]);

  /**
   * The only in-session proof that a booking happened. The confirmation
   * message the transcript eventually carries is written server-side by the
   * Calendly webhook or the reconciler cron, minutes later, so nothing on this
   * page can wait for it: without this listener the deferred capture card
   * below would ask a visitor for their email seconds after they finished
   * booking. Calendly posts `calendly.event_scheduled` from the embed as soon
   * as the invitee confirms.
   */
  useEffect(() => {
    const onCalendlyMessage = (event: MessageEvent) => {
      // Origin taken from the calendar URL actually rendered, not a hardcoded
      // host: NEXT_PUBLIC_CHATBOT_CALENDLY_URL can point at a Calendly custom
      // domain, and a hardcoded check would stop matching with no error
      // anywhere, silently restoring the bug this listener exists to prevent.
      if (event.origin !== calendarOrigin(messagesRef.current)) return;
      const data = event.data as {
        event?: unknown;
        payload?: { invitee?: { uri?: unknown } } | null;
      } | null;
      if (!data || typeof data !== "object") return;
      if (data.event !== "calendly.event_scheduled") return;
      const inviteeUri = data.payload?.invitee?.uri;
      void confirmBookingInChat(
        sessionIdRef.current,
        typeof inviteeUri === "string" ? inviteeUri : null,
        (message) => setMessages((prev) => [...prev, message]),
      );
      // They just gave Calendly their name and email. Asking again would be
      // both redundant and a bad look under a confirmed booking.
      bookedRef.current = true;
      if (calendarCaptureTimerRef.current) {
        clearTimeout(calendarCaptureTimerRef.current);
        calendarCaptureTimerRef.current = null;
      }
      setCaptured(true);
      writeSessionFlag(CAPTURED_KEY);
      setShowInlineCapture(false);
    };

    window.addEventListener("message", onCalendlyMessage);
    return () => window.removeEventListener("message", onCalendlyMessage);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    showInlineCaptureRef.current = showInlineCapture;
  }, [showInlineCapture]);

  useEffect(
    () => () => {
      if (calendarCaptureTimerRef.current) {
        clearTimeout(calendarCaptureTimerRef.current);
      }
    },
    [],
  );

  /**
   * The calendar used to end the conversation for us: showing it marked the
   * visitor "captured" so no card would ever interrupt the booking, and a
   * visitor who then did not book left us holding nothing at all. Most cost
   * questions ended exactly there.
   *
   * Now the calendar still goes first and uninterrupted, and the capture card
   * follows it only if the booking did not happen. Booking remains the win;
   * this just stops a no-book being a total loss.
   */
  const armCalendarCapture = useCallback(() => {
    // "off" is an admin decision that no capture card should ever appear.
    if (config?.captureMode === "off") return;
    if (calendarCaptureTimerRef.current) return;
    // Once offered and dismissed, that is an answer. Re-asking is nagging.
    if (hasOfferedCaptureRef.current) return;

    calendarCaptureTimerRef.current = setTimeout(() => {
      calendarCaptureTimerRef.current = null;
      if (capturedRef.current || bookedRef.current) return;
      // Booked in a previous session, or confirmed server-side since.
      if (
        messagesRef.current.some(
          (message) => message.kind === "booking_confirmed",
        )
      ) {
        return;
      }
      // Never swap the copy out from under an open card, and never queue one
      // up behind a closed panel for the visitor to meet on some later visit.
      if (showInlineCaptureRef.current || !openRef.current) return;
      // Re-read, not the arm-time value: the card is commonly offered and
      // dismissed inside this 45 second window, and a dismissal is an answer.
      if (hasOfferedCaptureRef.current) return;

      hasOfferedCaptureRef.current = true;
      writeSessionFlag(CAPTURE_OFFERED_KEY);
      setInlineCaptureContext("calendar_shown");
      setShowInlineCapture(true);
    }, CALENDAR_CAPTURE_DELAY_MS);
  }, [config?.captureMode]);

  const maybeOfferInlineCapture = useCallback(() => {
    if (
      config?.captureMode !== "on_intent" ||
      captured ||
      hasOfferedCaptureRef.current ||
      assistantReplyCountRef.current <
        captureAggressivenessThreshold(config?.captureAggressiveness)
    ) {
      return;
    }
    hasOfferedCaptureRef.current = true;
    writeSessionFlag(CAPTURE_OFFERED_KEY);
    // Read through the ref, not the closed-over `messages`: this runs at the
    // end of the same turn that appended the calendar, and the closure this
    // callback was created with predates it. A calendar restored by the
    // history fetch after a page navigation counts the same as one this
    // session opened.
    const context = messagesRef.current.some(
      (message) => message.kind === "calendar",
    )
      ? "calendar_shown"
      : "on_intent";
    setTimeout(() => {
      setInlineCaptureContext(context);
      setShowInlineCapture(true);
    }, ON_INTENT_DELAY_MS);
  }, [config?.captureMode, config?.captureAggressiveness, captured]);

  /**
   * Exit-intent offer, v2 order: the calendar first, the email card only as a
   * fallback. Someone leaving is far more likely to give you fifteen minutes
   * they can pick right now than an email address for a later follow-up.
   *
   * ponytail: the injected calendar message is client-side only, so it is not
   * in the stored transcript and vanishes on navigation. Attribution still
   * holds either way — the URL carries the conversation id. Persist it via a
   * dedicated endpoint if the funnel ever needs "calendar shown on exit".
   */
  const offerExitIntent = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    // Nothing is offered to someone who already booked, whether we learned it
    // from the embed this session or from a confirmation the server wrote.
    if (
      bookedRef.current ||
      messagesRef.current.some(
        (message) => message.kind === "booking_confirmed",
      )
    ) {
      return;
    }
    const showCaptureCard = () => {
      setInlineCaptureContext("exit_intent");
      setShowInlineCapture(true);
    };

    if (!sessionId || captured) {
      if (!captured) showCaptureCard();
      return;
    }

    // A calendar is already on screen. A second identical embed underneath it
    // is not a stronger offer, it just looks broken, so the card is the only
    // thing left to offer someone on their way out.
    if (messagesRef.current.some((message) => message.kind === "calendar")) {
      showCaptureCard();
      return;
    }

    try {
      const response = await fetch(
        `/api/chatbot/history?sessionId=${encodeURIComponent(sessionId)}`,
      );
      const data: ChatHistoryResponse | null = response.ok
        ? await response.json()
        : null;

      // Server-side truth beats the local flag: a booking or a capture made in
      // another tab since this session started shows up here first.
      if (data?.captured) {
        setCaptured(true);
        writeSessionFlag(CAPTURED_KEY);
        return;
      }

      if (!data?.bookingUrl) {
        showCaptureCard();
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Before you go, want to just grab a time? Free, 15 minutes, no pressure.",
        },
        {
          role: "assistant",
          content: "Opened the booking calendar in the chat.",
          kind: "calendar",
          data: { url: data.bookingUrl },
        },
      ]);
    } catch {
      showCaptureCard();
    }
  }, [captured]);

  // Exit-intent capture (spec item 3c): a desktop-only, once-per-session
  // nudge when the visitor moves the cursor off the top of the viewport with
  // an active, uncaptured conversation. Independent of captureMode/the
  // on-intent trigger above — it's a separate lever the admin can toggle.
  useEffect(() => {
    if (!enabled || !config?.exitIntentCapture) return;
    if (hasOfferedExitIntentRef.current) return;
    // ponytail: pointer-fine is a coarse desktop heuristic (a touch laptop
    // with a mouse also qualifies, which is fine) — upgrade to a real
    // hover-capability check if false positives show up on touch devices.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const onMouseOut = (event: MouseEvent) => {
      if (hasOfferedExitIntentRef.current) return;
      if (showInlineCapture) return;
      // A shown calendar no longer silences exit intent, because a visitor who
      // did not book is exactly who this is for. offerExitIntent offers the
      // capture card rather than a second calendar in that case.
      if (messages.some((message) => message.kind === "booking_confirmed")) {
        return;
      }
      if (!messages.some((message) => message.role === "user")) return;
      // Standard exit-intent heuristic: the cursor left toward the top edge
      // of the viewport with no related target, i.e. it actually left the
      // document rather than moving between two elements inside it.
      if (event.clientY > 0 || event.relatedTarget) return;

      hasOfferedExitIntentRef.current = true;
      writeSessionFlag(EXIT_INTENT_OFFERED_KEY);
      setOpen(true);
      void offerExitIntent();
    };

    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [
    enabled,
    config?.exitIntentCapture,
    showInlineCapture,
    messages,
    setOpen,
    offerExitIntent,
  ]);

  const sendMessage = useCallback(
    async (text: string) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || !text.trim() || isWaiting) return;

      setError(null);
      playSendSound();
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInputValue("");
      setIsWaiting(true);
      setStreamingText(null);
      setToolStatus(null);

      if (LOOSE_EMAIL_PATTERN.test(text)) {
        setCaptured(true);
        writeSessionFlag(CAPTURED_KEY);
      }

      // Human-feeling delay: the fetch below starts immediately, but nothing
      // is rendered from the stream until this many ms have passed — the
      // typing indicator (isWaiting && streamingText === null) covers the
      // gap the whole time.
      const revealAt =
        Date.now() +
        randomInt(REPLY_TYPING_DELAY_MIN_MS, REPLY_TYPING_DELAY_MAX_MS);

      try {
        const response = await fetch("/api/chatbot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: text,
            pageUrl: window.location.pathname,
            timeZone: browserTimeZone(),
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`chat request failed with ${response.status}`);
        }

        // The server speaks NDJSON frames (see /api/chatbot/chat) so one turn
        // can interleave prose with an inline calendar or a resource card.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = "";
        let pending = "";
        let revealed = false;
        let produced = false;

        const waitForReveal = async () => {
          if (revealed) return;
          const remaining = revealAt - Date.now();
          if (remaining > 0) await sleep(remaining);
          revealed = true;
        };

        // Commits the in-flight bubble. Called on an explicit `flush` frame,
        // before any rich card (so ordering matches the transcript the server
        // stored), and once more at stream end.
        const flush = (finalText?: string) => {
          // The server's flush carries the cleaned final text; what streamed
          // in was the raw model output.
          const committed = (finalText ?? pending).trim();
          pending = "";
          setStreamingText(null);
          if (!committed) return;
          produced = true;
          playReceiveSound();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: committed },
          ]);
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const frame = parseFrame(line);
            if (!frame) continue;

            if (frame.t === "text") {
              // Clears a "finding times…" line whose tool returned no card
              // (e.g. the calendar was already open) — otherwise it would sit
              // there through the rest of the turn, suppressing the typing
              // indicator behind it.
              setToolStatus(null);
              pending += frame.v;
              // A long reply can outlast the reveal delay — once it does,
              // every further chunk streams in live. A short reply (the
              // common case) sits buffered until the delay elapses.
              if (!revealed && Date.now() >= revealAt) revealed = true;
              if (revealed) setStreamingText(pending);
              continue;
            }

            if (frame.t === "status") {
              await waitForReveal();
              setToolStatus(frame.v);
              continue;
            }

            if (frame.t === "flush") {
              await waitForReveal();
              flush(frame.v);
              continue;
            }

            if (frame.t === "msg") {
              await waitForReveal();
              flush();
              setToolStatus(null);
              produced = true;
              playReceiveSound();
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: frame.content,
                  kind: frame.kind,
                  data: frame.data ?? null,
                },
              ]);
              if (frame.kind === "calendar") {
                // Not marked captured: see armCalendarCapture. The card is
                // deferred, not cancelled, so a visitor who looks at the
                // calendar and leaves is still reachable.
                armCalendarCapture();
              }
            }
          }
        }

        await waitForReveal();
        flush();
        setToolStatus(null);

        if (!produced) {
          throw new Error("chat stream produced no messages");
        }

        assistantReplyCountRef.current += 1;
        maybeOfferInlineCapture();
      } catch {
        setError("Something went wrong. Try sending that again.");
        setStreamingText(null);
        setToolStatus(null);
      } finally {
        setIsWaiting(false);
      }
    },
    [isWaiting, maybeOfferInlineCapture, armCalendarCapture],
  );

  const submitCapture = useCallback(async (values: ChatCaptureValues) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return false;

    try {
      const response = await fetch("/api/chatbot/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name: values.name || null,
          email: values.email,
          phone: values.phone || null,
          pageUrl: window.location.pathname,
        }),
      });
      if (!response.ok) return false;

      setCaptured(true);
      writeSessionFlag(CAPTURED_KEY);
      setShowInlineCapture(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  if (!enabled || !config) return null;

  const brandColor = config.brandColor || DEFAULT_BRAND_COLOR;

  // The teaser bubble says exactly what Mia says when you open the panel.
  // They were two separately-edited fields, so they drifted: the bubble
  // promised one thing and the first message in the chat said another. The
  // greeting is the real opening line, so it wins; teaserText only shows if
  // no greeting is set at all.
  const teaserMessage = config.greeting || config.teaserText;

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-[90] flex flex-col items-end gap-2",
        // Below 640px an open panel takes the whole screen: the 420x680 panel
        // leaves no room for a Calendly month view on a phone, which is
        // exactly where the booking has to work.
        open && "max-sm:inset-0 max-sm:items-stretch max-sm:gap-0",
      )}
    >
      {!open && showTeaser && teaserMessage ? (
        <TeaserBubble
          text={teaserMessage}
          avatarUrl={config.avatarUrl}
          onOpen={() => {
            setShowTeaser(false);
            setOpen(true);
          }}
          onDismiss={() => {
            setShowTeaser(false);
            writeSessionFlag(TEASER_DISMISSED_KEY);
          }}
        />
      ) : null}

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={`Chat with ${config.personaName}`}
          tabIndex={-1}
          className={cn(
            "flex h-[680px] max-h-[calc(100vh-7rem)] w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[8px] border-2 border-[#111111] bg-white shadow-[6px_6px_0_#111111] outline-none",
            "max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:shadow-none",
          )}
        >
          <PanelHeader
            personaName={config.personaName}
            avatarUrl={config.avatarUrl}
            brandColor={brandColor}
            onClose={() => setOpen(false)}
          />
          <QuickActionsBar actions={config.quickActions} />

          {needsGate ? (
            <ChatCaptureForm
              variant="gate"
              brandColor={brandColor}
              title={`Chat with ${config.personaName}`}
              body="Leave your info and we'll get you started."
              onSubmit={submitCapture}
            />
          ) : (
            <>
              <ChatTranscript
                personaName={config.personaName}
                avatarUrl={config.avatarUrl}
                brandColor={brandColor}
                messages={messages}
                streamingText={streamingText}
                isWaiting={isWaiting}
                toolStatus={toolStatus}
              />
              {showInlineCapture ? (
                <div className="px-4 pb-2">
                  <ChatCaptureForm
                    variant="inline"
                    brandColor={brandColor}
                    title={CAPTURE_CARD_COPY[inlineCaptureContext].title}
                    body={CAPTURE_CARD_COPY[inlineCaptureContext].body}
                    onSubmit={submitCapture}
                    onDismiss={() => setShowInlineCapture(false)}
                  />
                </div>
              ) : null}
              {error ? (
                <p className="px-4 pb-1 text-xs font-bold text-red-600">
                  {error}
                </p>
              ) : null}
              {!messages.some((message) => message.role === "user") ? (
                <StarterQuestionChips
                  questions={config.starterQuestions}
                  onSelect={sendMessage}
                />
              ) : null}
              <MessageInput
                brandColor={brandColor}
                value={inputValue}
                onChange={setInputValue}
                onSend={() => sendMessage(inputValue)}
                disabled={isWaiting}
              />
            </>
          )}
        </div>
      ) : (
        <LauncherButton
          brandColor={brandColor}
          personaName={config.personaName}
          avatarUrl={config.avatarUrl}
          onClick={() => {
            setShowTeaser(false);
            setOpen(true);
          }}
        />
      )}
    </div>
  );
}

function readOrCreateSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const created = generateId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return generateId();
  }
}

function ensureVisitorCookie(): void {
  try {
    if (
      document.cookie
        .split("; ")
        .some((entry) => entry.startsWith(`${VP_CHAT_VISITOR_COOKIE_NAME}=`))
    ) {
      return;
    }
    document.cookie = `${VP_CHAT_VISITOR_COOKIE_NAME}=${generateId()}; Path=/; Max-Age=${VP_CHAT_VISITOR_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch {
    // Storage unavailable (private mode) — the bot just re-asks next visit.
  }
}

function readSessionFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

function clearSessionFlag(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

type ChatStreamFrame =
  | { t: "text"; v: string }
  | { t: "flush"; v?: string }
  | { t: "status"; v: "finding_times" }
  | {
      t: "msg";
      content: string;
      kind: NonNullable<ChatDisplayMessage["kind"]>;
      data?: Record<string, unknown> | null;
    };

/** One NDJSON line to a frame. A malformed or unknown line is skipped, never thrown on. */
function parseFrame(line: string): ChatStreamFrame | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as ChatStreamFrame;
    if (parsed && typeof parsed === "object" && "t" in parsed) return parsed;
    return null;
  } catch {
    return null;
  }
}

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/**
 * Turns the embed's "event scheduled" signal into a confirmation the visitor
 * can see and the transcript keeps. The server verifies the booking with
 * Calendly (the invitee's utm_content must be this conversation) and returns
 * the same card the webhook would have written; on any failure the visitor
 * still gets a plain confirmation line so the chat never ends on silence.
 */
async function confirmBookingInChat(
  sessionId: string | null,
  inviteeUri: string | null,
  append: (message: ChatDisplayMessage) => void,
): Promise<void> {
  const fallback: ChatDisplayMessage = {
    role: "assistant",
    content: "Booked. Check your email for the calendar invite.",
    kind: "booking_confirmed",
    data: { event_uri: null, starts_at: null },
  };
  if (!sessionId || !inviteeUri) {
    append(fallback);
    return;
  }
  try {
    const response = await fetch("/api/chatbot/booked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, inviteeUri }),
    });
    if (!response.ok)
      throw new Error(`booked request failed ${response.status}`);
    const data = (await response.json()) as { message?: ChatDisplayMessage };
    append(data.message ?? fallback);
  } catch {
    append(fallback);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function generateId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `vp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
