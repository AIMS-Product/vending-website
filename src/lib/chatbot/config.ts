import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config as envConfig } from "@/lib/config";
import { isSafeChatLinkUrl } from "@/lib/chatbot/parse-chat-links";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

type ChatbotConfigClient = Pick<SupabaseClient<Database>, "from">;
type ServiceDeps = { client?: ChatbotConfigClient };

export class ChatbotConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatbotConfigError";
  }
}

export type ChatbotCaptureMode = "pre_chat" | "on_intent" | "off";

/** Which assistant reply triggers the on-intent inline capture card: eager=1st, balanced=2nd (default), relaxed=3rd. See captureAggressivenessThreshold in capture-thresholds.ts. */
export type ChatbotCaptureAggressiveness = "relaxed" | "balanced" | "eager";

export type ChatbotQuickAction = { label: string; url: string };

/** Cap applied both on save (chatbotConfigInputSchema) and on read (parseQuickActions/parseStarterQuestions) — a hand-edited row can never exceed it either. */
const MAX_QUICK_ACTIONS = 5;
const MAX_STARTER_QUESTIONS = 5;

export type ChatbotConfig = {
  enabled: boolean;
  personaName: string;
  avatarUrl: string | null;
  greeting: string | null;
  followUpMessage: string | null;
  teaserText: string | null;
  brandColor: string | null;
  idleTriggerSeconds: number;
  captureMode: ChatbotCaptureMode;
  captureAggressiveness: ChatbotCaptureAggressiveness;
  exitIntentCapture: boolean;
  knowledgeBase: string | null;
  model: string;
  leadRoutingEmails: string | null;
  notifyEnabled: boolean;
  starterQuestions: string[];
  quickActions: ChatbotQuickAction[];
  updatedAt: string;
};

/**
 * Public-safe projection served to the widget. Deliberately excludes the
 * knowledge base, lead routing emails, notify flag, and model — none of that
 * belongs in a browser response.
 */
export type PublicChatbotConfig = Pick<
  ChatbotConfig,
  | "enabled"
  | "personaName"
  | "avatarUrl"
  | "greeting"
  | "followUpMessage"
  | "teaserText"
  | "brandColor"
  | "idleTriggerSeconds"
  | "captureMode"
  | "captureAggressiveness"
  | "exitIntentCapture"
  | "starterQuestions"
  | "quickActions"
>;

/**
 * Used whenever the config row cannot be read — table not yet applied (this
 * migration ships ahead of being run), or a transient DB error. `enabled:
 * false` means the widget fails closed rather than rendering with
 * placeholder copy.
 */
export const DEFAULT_CHATBOT_CONFIG: ChatbotConfig = {
  enabled: false,
  personaName: "Mia",
  avatarUrl: null,
  greeting: null,
  followUpMessage: null,
  teaserText: null,
  brandColor: null,
  idleTriggerSeconds: 5,
  captureMode: "on_intent",
  captureAggressiveness: "balanced",
  exitIntentCapture: true,
  knowledgeBase: null,
  model: "gpt-4o-mini",
  leadRoutingEmails: null,
  notifyEnabled: true,
  starterQuestions: [],
  quickActions: [],
  updatedAt: new Date(0).toISOString(),
};

export const CHATBOT_CONFIG_CACHE_TAG = "chatbot-config";

/** Real-photo default so the widget never falls back to a plain letter circle. */
export const DEFAULT_CHATBOT_AVATAR_URL = "/chatbot/mia.jpg";

const CONFIG_FIELDS =
  "enabled, persona_name, avatar_url, greeting, follow_up_message, teaser_text, brand_color, idle_trigger_seconds, capture_mode, capture_aggressiveness, exit_intent_capture, knowledge_base, model, lead_routing_emails, notify_enabled, starter_questions, quick_actions, updated_at" as const;

// Pre-migration column list — used as a fallback until both the
// 20260821120000_chatbot_quick_actions and 20260821130000_chatbot_capture_levers
// migrations have been applied. A missing column on either one falls back to
// this single tier (all four later-added columns served from in-code
// defaults) rather than a per-migration tier — same coarse-but-safe pattern
// the quick-actions column pair already used.
const LEGACY_CONFIG_FIELDS =
  "enabled, persona_name, avatar_url, greeting, follow_up_message, teaser_text, brand_color, idle_trigger_seconds, capture_mode, knowledge_base, model, lead_routing_emails, notify_enabled, updated_at" as const;

/** In-code defaults mirroring the migration's seed — served until the
 * starter_questions/quick_actions columns exist in the database. */
/**
 * No cost question here on purpose. "How much does it cost to start?" was the
 * most-clicked chip on the site and the worst-converting path in the product:
 * nine of twenty conversations in the fortnight to 2026-08-25 opened with it
 * and one booked. The bot is under an absolute rule never to state a price, so
 * the chip promised an answer the assistant cannot give and spent the
 * visitor's one question on a redirect. Visitors who want the number still ask
 * it in their own words, and that path is handled; this just stops the site
 * suggesting it.
 */
export const DEFAULT_STARTER_QUESTIONS: readonly string[] = [
  "Do I need experience?",
  "How does the program work?",
];
export const DEFAULT_QUICK_ACTIONS: readonly ChatbotQuickAction[] = [
  { label: "Book a call", url: "/book-now" },
  { label: "Free 90-day roadmap", url: "/resources/roadmap" },
  { label: "Success stories", url: "/case-studies" },
];

function isMissingColumnError(message: string): boolean {
  return (
    message.includes("starter_questions") ||
    message.includes("quick_actions") ||
    message.includes("capture_aggressiveness") ||
    message.includes("exit_intent_capture") ||
    message.includes("42703")
  );
}

// Matches CONFIG_FIELDS exactly (omits `id`, the only column not selected).
type ChatbotConfigRow = Omit<
  Database["public"]["Tables"]["chatbot_config"]["Row"],
  "id"
>;

type LegacyChatbotConfigRow = Omit<
  ChatbotConfigRow,
  | "starter_questions"
  | "quick_actions"
  | "capture_aggressiveness"
  | "exit_intent_capture"
>;

/** Uncached read. Never throws — fails soft to the defaults. */
export async function fetchChatbotConfig(
  deps: ServiceDeps = {},
): Promise<ChatbotConfig> {
  try {
    const client = deps.client ?? createAdminClient();
    const { data, error } = await client
      .from("chatbot_config")
      .select(CONFIG_FIELDS)
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      if (!isMissingColumnError(error.message)) throw new Error(error.message);
      // Columns not migrated yet — read the legacy shape and default the rest.
      const legacy = await client
        .from("chatbot_config")
        .select(LEGACY_CONFIG_FIELDS)
        .eq("id", 1)
        .maybeSingle();
      if (legacy.error) throw new Error(legacy.error.message);
      if (!legacy.data) return DEFAULT_CHATBOT_CONFIG;
      return rowToConfig({
        ...(legacy.data as LegacyChatbotConfigRow),
        starter_questions: [...DEFAULT_STARTER_QUESTIONS] as unknown as Json,
        quick_actions: DEFAULT_QUICK_ACTIONS.map((a) => ({
          ...a,
        })) as unknown as Json,
        capture_aggressiveness: "balanced",
        exit_intent_capture: true,
      });
    }
    if (!data) return DEFAULT_CHATBOT_CONFIG;
    return rowToConfig(data);
  } catch (error) {
    console.warn("chatbot config load failed, using defaults", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return DEFAULT_CHATBOT_CONFIG;
  }
}

const cachedChatbotConfig = unstable_cache(
  () => fetchChatbotConfig(),
  ["chatbot-config"],
  { revalidate: 60, tags: [CHATBOT_CONFIG_CACHE_TAG] },
);

/** Cached loader for the public surfaces (config route, chat route). */
export async function loadChatbotConfig(): Promise<ChatbotConfig> {
  return cachedChatbotConfig();
}

/** Uncached loader for /admin, where a stale row right after a save would be confusing. */
export async function loadChatbotConfigFresh(
  deps: ServiceDeps = {},
): Promise<ChatbotConfig> {
  return fetchChatbotConfig(deps);
}

export function toPublicChatbotConfig(
  config: ChatbotConfig,
): PublicChatbotConfig {
  return {
    enabled: config.enabled,
    personaName: config.personaName,
    // Admin-set avatar_url wins when present; otherwise the widget gets the
    // real-photo default rather than falling back to a letter circle. Kept
    // here (the public projection), not in rowToConfig, so the admin edit
    // form still shows an empty field when nothing is set.
    avatarUrl: config.avatarUrl ?? DEFAULT_CHATBOT_AVATAR_URL,
    greeting: config.greeting,
    followUpMessage: config.followUpMessage,
    teaserText: config.teaserText,
    brandColor: config.brandColor,
    idleTriggerSeconds: config.idleTriggerSeconds,
    captureMode: config.captureMode,
    captureAggressiveness: config.captureAggressiveness,
    exitIntentCapture: config.exitIntentCapture,
    starterQuestions: config.starterQuestions,
    quickActions: config.quickActions,
  };
}

const chatbotConfigInputSchema = z.object({
  enabled: z.boolean(),
  personaName: z.string().trim().min(1).max(60),
  avatarUrl: z.string().trim().min(1).max(500).nullable(),
  greeting: z.string().trim().max(2000).nullable(),
  followUpMessage: z.string().trim().max(2000).nullable(),
  teaserText: z.string().trim().max(200).nullable(),
  brandColor: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
      message: "Brand colour must be a hex value like #2a8fcc.",
    })
    .nullable(),
  idleTriggerSeconds: z.number().int().min(0).max(600),
  captureMode: z.enum(["pre_chat", "on_intent", "off"]),
  captureAggressiveness: z.enum(["relaxed", "balanced", "eager"]),
  exitIntentCapture: z.boolean(),
  knowledgeBase: z.string().trim().max(20_000).nullable(),
  model: z.string().trim().min(1).max(80),
  leadRoutingEmails: z.string().trim().max(500).nullable(),
  notifyEnabled: z.boolean(),
  starterQuestions: z
    .array(z.string().trim().min(1).max(200))
    .max(MAX_STARTER_QUESTIONS),
  quickActions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        url: z.string().trim().min(1).max(500).refine(isSafeChatLinkUrl, {
          message:
            "Quick action URL must be a relative path or link to vendingpreneurs.com.",
        }),
      }),
    )
    .max(MAX_QUICK_ACTIONS),
});

export type ChatbotConfigInput = z.infer<typeof chatbotConfigInputSchema>;

export async function saveChatbotConfig(
  input: ChatbotConfigInput,
  deps: ServiceDeps = {},
): Promise<ChatbotConfig> {
  const parsed = chatbotConfigInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ChatbotConfigError(
      parsed.error.issues[0]?.message ?? "Invalid chatbot configuration.",
    );
  }

  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("chatbot_config")
    .update(configToRow(parsed.data))
    .eq("id", 1)
    .select(CONFIG_FIELDS)
    .single();

  if (error && isMissingColumnError(error.message)) {
    // Columns not migrated yet — save everything else so the rest of the form
    // still works; chips/actions/capture levers serve from in-code defaults
    // until then (the admin's choices for those fields are silently dropped,
    // same tradeoff the quick-actions fallback already made).
    const {
      starter_questions: _sq,
      quick_actions: _qa,
      capture_aggressiveness: _ca,
      exit_intent_capture: _eic,
      ...legacyUpdate
    } = configToRow(parsed.data);
    const legacy = await client
      .from("chatbot_config")
      .update(legacyUpdate)
      .eq("id", 1)
      .select(LEGACY_CONFIG_FIELDS)
      .single();
    if (legacy.error || !legacy.data) {
      throw new ChatbotConfigError("Could not save chatbot configuration.");
    }
    revalidateTag(CHATBOT_CONFIG_CACHE_TAG, "max");
    return rowToConfig({
      ...(legacy.data as LegacyChatbotConfigRow),
      starter_questions: [...DEFAULT_STARTER_QUESTIONS] as unknown as Json,
      quick_actions: DEFAULT_QUICK_ACTIONS.map((a) => ({
        ...a,
      })) as unknown as Json,
      capture_aggressiveness: "balanced",
      exit_intent_capture: true,
    });
  }

  if (error || !data) {
    throw new ChatbotConfigError("Could not save chatbot configuration.");
  }

  revalidateTag(CHATBOT_CONFIG_CACHE_TAG, "max");
  return rowToConfig(data);
}

/**
 * Routing recipients for the profile/digest emails: the admin-set list, or
 * LEAD_NOTIFICATION_TO when blank.
 */
export function chatbotLeadRoutingEmails(config: ChatbotConfig): string[] {
  const raw =
    config.leadRoutingEmails?.trim() || envConfig.LEAD_NOTIFICATION_TO?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function rowToConfig(row: ChatbotConfigRow): ChatbotConfig {
  return {
    enabled: row.enabled,
    personaName: row.persona_name,
    avatarUrl: row.avatar_url,
    greeting: row.greeting,
    followUpMessage: row.follow_up_message,
    teaserText: row.teaser_text,
    brandColor: row.brand_color,
    idleTriggerSeconds: row.idle_trigger_seconds,
    captureMode: isCaptureMode(row.capture_mode)
      ? row.capture_mode
      : "on_intent",
    captureAggressiveness: isCaptureAggressiveness(row.capture_aggressiveness)
      ? row.capture_aggressiveness
      : "balanced",
    exitIntentCapture: row.exit_intent_capture,
    knowledgeBase: row.knowledge_base,
    model: row.model,
    leadRoutingEmails: row.lead_routing_emails,
    notifyEnabled: row.notify_enabled,
    starterQuestions: parseStarterQuestions(row.starter_questions),
    quickActions: parseQuickActions(row.quick_actions),
    updatedAt: row.updated_at,
  };
}

function configToRow(
  input: ChatbotConfigInput,
): Database["public"]["Tables"]["chatbot_config"]["Update"] {
  return {
    enabled: input.enabled,
    persona_name: input.personaName,
    avatar_url: input.avatarUrl,
    greeting: input.greeting,
    follow_up_message: input.followUpMessage,
    teaser_text: input.teaserText,
    brand_color: input.brandColor,
    idle_trigger_seconds: input.idleTriggerSeconds,
    capture_mode: input.captureMode,
    capture_aggressiveness: input.captureAggressiveness,
    exit_intent_capture: input.exitIntentCapture,
    knowledge_base: input.knowledgeBase,
    model: input.model,
    lead_routing_emails: input.leadRoutingEmails,
    notify_enabled: input.notifyEnabled,
    starter_questions: input.starterQuestions as unknown as Json,
    quick_actions: input.quickActions as unknown as Json,
    updated_at: new Date().toISOString(),
  };
}

function isCaptureMode(value: string): value is ChatbotCaptureMode {
  return value === "pre_chat" || value === "on_intent" || value === "off";
}

function isCaptureAggressiveness(
  value: string,
): value is ChatbotCaptureAggressiveness {
  return value === "relaxed" || value === "balanced" || value === "eager";
}

/** Defensive read of the stored `starter_questions` jsonb — never throws on a shape surprise (bad hand-edited data must not crash the widget). */
function parseStarterQuestions(value: Json | null): string[] {
  if (!Array.isArray(value)) return [];
  const questions = value.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.trim().length > 0,
  );
  return questions.slice(0, MAX_STARTER_QUESTIONS);
}

/** Defensive read of the stored `quick_actions` jsonb — drops any entry with a missing/malformed field or an unsafe URL rather than throwing. */
function parseQuickActions(value: Json | null): ChatbotQuickAction[] {
  if (!Array.isArray(value)) return [];
  const actions: ChatbotQuickAction[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const label = (entry as Record<string, unknown>).label;
    const url = (entry as Record<string, unknown>).url;
    if (
      typeof label === "string" &&
      label.trim() &&
      typeof url === "string" &&
      url.trim() &&
      isSafeChatLinkUrl(url.trim())
    ) {
      actions.push({ label: label.trim(), url: url.trim() });
    }
  }
  return actions.slice(0, MAX_QUICK_ACTIONS);
}
