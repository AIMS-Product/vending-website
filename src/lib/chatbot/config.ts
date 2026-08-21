import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config as envConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ChatbotConfigClient = Pick<SupabaseClient<Database>, "from">;
type ServiceDeps = { client?: ChatbotConfigClient };

export class ChatbotConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatbotConfigError";
  }
}

export type ChatbotCaptureMode = "pre_chat" | "on_intent" | "off";

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
  knowledgeBase: string | null;
  model: string;
  leadRoutingEmails: string | null;
  notifyEnabled: boolean;
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
  knowledgeBase: null,
  model: "gpt-4o-mini",
  leadRoutingEmails: null,
  notifyEnabled: true,
  updatedAt: new Date(0).toISOString(),
};

export const CHATBOT_CONFIG_CACHE_TAG = "chatbot-config";

const CONFIG_FIELDS =
  "enabled, persona_name, avatar_url, greeting, follow_up_message, teaser_text, brand_color, idle_trigger_seconds, capture_mode, knowledge_base, model, lead_routing_emails, notify_enabled, updated_at" as const;

// Matches CONFIG_FIELDS exactly (omits `id`, the only column not selected).
type ChatbotConfigRow = Omit<
  Database["public"]["Tables"]["chatbot_config"]["Row"],
  "id"
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
    if (error) throw new Error(error.message);
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
    avatarUrl: config.avatarUrl,
    greeting: config.greeting,
    followUpMessage: config.followUpMessage,
    teaserText: config.teaserText,
    brandColor: config.brandColor,
    idleTriggerSeconds: config.idleTriggerSeconds,
    captureMode: config.captureMode,
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
      message: "Brand colour must be a hex value like #f47b3b.",
    })
    .nullable(),
  idleTriggerSeconds: z.number().int().min(0).max(600),
  captureMode: z.enum(["pre_chat", "on_intent", "off"]),
  knowledgeBase: z.string().trim().max(20_000).nullable(),
  model: z.string().trim().min(1).max(80),
  leadRoutingEmails: z.string().trim().max(500).nullable(),
  notifyEnabled: z.boolean(),
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
    captureMode: isCaptureMode(row.capture_mode) ? row.capture_mode : "on_intent",
    knowledgeBase: row.knowledge_base,
    model: row.model,
    leadRoutingEmails: row.lead_routing_emails,
    notifyEnabled: row.notify_enabled,
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
    knowledge_base: input.knowledgeBase,
    model: input.model,
    lead_routing_emails: input.leadRoutingEmails,
    notify_enabled: input.notifyEnabled,
    updated_at: new Date().toISOString(),
  };
}

function isCaptureMode(value: string): value is ChatbotCaptureMode {
  return value === "pre_chat" || value === "on_intent" || value === "off";
}
