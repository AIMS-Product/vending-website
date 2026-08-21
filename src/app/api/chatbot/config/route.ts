import "server-only";

import { loadChatbotConfig, toPublicChatbotConfig } from "@/lib/chatbot/config";

/**
 * Public-safe chatbot config for the widget. `loadChatbotConfig` is already
 * server-cached for 60s (unstable_cache, tag "chatbot-config"); the
 * Cache-Control header below lets the browser skip the round trip entirely
 * for repeat mounts within the same window.
 */
export async function GET() {
  const config = await loadChatbotConfig();
  return Response.json(toPublicChatbotConfig(config), {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
