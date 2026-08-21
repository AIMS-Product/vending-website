// Deliberately NOT `server-only`: the widget (a client component) needs the
// cookie name too, to set `vp_chat_vid` itself (see spec architecture — the
// cookie is client-set). Keep this file to plain constants only so it stays
// safe to import from both sides of the request boundary.

/**
 * First-party cookie recalling a returning visitor's captured contact info
 * so the bot does not re-ask. 180 days, never an identity signal, never used
 * in greetings — see chatbot_conversations.visitor_hash.
 */
export const VP_CHAT_VISITOR_COOKIE_NAME = "vp_chat_vid";
export const VP_CHAT_VISITOR_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
