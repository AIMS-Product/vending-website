"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
  TeaserBubble,
} from "@/components/chatbot/ChatLauncher";

const SESSION_STORAGE_KEY = "vp_chat_session_id";
const TEASER_DISMISSED_KEY = "vp_chat_teaser_dismissed";
const CAPTURED_KEY = "vp_chat_captured";
const DEFAULT_BRAND_COLOR = "#f47b3b";
const ON_INTENT_DELAY_MS = 800;
const LOOSE_EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

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
};

/**
 * Mounted once in the root layout, after <TrackingScripts/> (see spec). Fetches
 * its own config and renders nothing until it resolves `enabled: true` and the
 * route isn't an admin page — same exclusion the attribution tracker uses.
 */
export function ChatWidget() {
  const pathname = usePathname() ?? "/";
  const [config, setConfig] = useState<PublicChatbotConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const [messages, setMessages] = useState<ChatDisplayMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  // Lazy initializer, not an effect: reads sessionStorage exactly once,
  // before first paint. Safe under SSR too — readSessionFlag's try/catch
  // absorbs the ReferenceError from a missing `window`.
  const [captured, setCaptured] = useState(() => readSessionFlag(CAPTURED_KEY));
  const [showInlineCapture, setShowInlineCapture] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const assistantReplyCountRef = useRef(0);
  const hasOfferedCaptureRef = useRef(false);
  const hasGreetedRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

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

  useEffect(() => {
    if (isAdminRoute) return;
    sessionIdRef.current = readOrCreateSessionId();
    ensureVisitorCookie();
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
  }, [open]);

  const needsGate = config?.captureMode === "pre_chat" && !captured;

  // Greeting + optional follow-up, injected once the transcript is actually
  // reachable (immediately, or right after the pre_chat gate clears). Both
  // setState calls are deferred to timers rather than run synchronously in
  // the effect body (react-hooks/set-state-in-effect) — 0ms for the greeting
  // still reads as instant, 600ms for the follow-up is the deliberate beat
  // the spec calls for.
  useEffect(() => {
    if (!open || needsGate || hasGreetedRef.current || !config) return;
    hasGreetedRef.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const greeting = config.greeting;
    if (greeting) {
      timers.push(
        setTimeout(
          () => setMessages([{ role: "assistant", content: greeting }]),
          0,
        ),
      );
    }
    const followUpMessage = config.followUpMessage;
    if (followUpMessage) {
      timers.push(
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: followUpMessage },
          ]);
        }, 600),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [open, needsGate, config]);

  const maybeOfferInlineCapture = useCallback(() => {
    if (
      config?.captureMode !== "on_intent" ||
      captured ||
      hasOfferedCaptureRef.current ||
      assistantReplyCountRef.current < 2
    ) {
      return;
    }
    hasOfferedCaptureRef.current = true;
    setTimeout(() => setShowInlineCapture(true), ON_INTENT_DELAY_MS);
  }, [config?.captureMode, captured]);

  const sendMessage = useCallback(
    async (text: string) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || !text.trim() || isWaiting) return;

      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInputValue("");
      setIsWaiting(true);
      setStreamingText(null);

      if (LOOSE_EMAIL_PATTERN.test(text)) {
        setCaptured(true);
        writeSessionFlag(CAPTURED_KEY);
      }

      try {
        const response = await fetch("/api/chatbot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: text,
            pageUrl: window.location.pathname,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`chat request failed with ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        setStreamingText("");
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setStreamingText(full);
        }

        setMessages((prev) => [...prev, { role: "assistant", content: full }]);
        setStreamingText(null);
        assistantReplyCountRef.current += 1;
        maybeOfferInlineCapture();
      } catch {
        setError("Something went wrong. Try sending that again.");
        setStreamingText(null);
      } finally {
        setIsWaiting(false);
      }
    },
    [isWaiting, maybeOfferInlineCapture],
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

  return (
    <div className="fixed right-4 bottom-4 z-[90] flex flex-col items-end gap-2">
      {!open && showTeaser && config.teaserText ? (
        <TeaserBubble
          text={config.teaserText}
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
          className="flex h-[520px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[8px] border-2 border-[#111111] bg-white shadow-[6px_6px_0_#111111] outline-none"
        >
          <PanelHeader
            personaName={config.personaName}
            avatarUrl={config.avatarUrl}
            brandColor={brandColor}
            onClose={() => setOpen(false)}
          />

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
              />
              {showInlineCapture ? (
                <div className="px-4 pb-2">
                  <ChatCaptureForm
                    variant="inline"
                    brandColor={brandColor}
                    title="Want us to follow up?"
                    body="Leave your email and the team can send more details."
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

function generateId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `vp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
