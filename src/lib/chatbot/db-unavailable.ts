export const CHATBOT_UNAVAILABLE_MESSAGE =
  "Chat is temporarily unavailable. Try again shortly.";

/**
 * The response for a chatbot route whose database read failed. A failed read
 * is an outage, not "no such conversation": answering 404 (or treating the
 * visitor as new) hides it and spends a new-conversation budget. Logs the
 * route and the database's code and message only, never a session id or any
 * visitor detail.
 */
export function chatbotUnavailableResponse(
  route: string,
  error: { code?: string; message: string },
): Response {
  console.error("chatbot: database read failed", {
    route,
    code: error.code,
    message: error.message,
  });
  return Response.json(
    { message: CHATBOT_UNAVAILABLE_MESSAGE },
    { status: 503 },
  );
}
