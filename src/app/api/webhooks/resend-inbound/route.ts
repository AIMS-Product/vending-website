import { after } from "next/server";
import { z } from "zod";
import {
  emailAgentEnabled,
  handleInboundEmail,
} from "@/lib/chatbot/email-agent/agent";
import { verifySvixSignature } from "@/lib/chatbot/email-agent/svix";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Reading the email, two model calls, Close, Calendly and the send. */
export const maxDuration = 90;

const eventSchema = z.object({
  type: z.string(),
  data: z.object({ email_id: z.string().min(1).max(100) }).passthrough(),
});

/**
 * Resend `email.received` for reply.vendingpreneurs.com. Verified (Svix),
 * acknowledged at once, handled in after(): Resend retries a slow or failed
 * delivery, and a retry of a handled email is a no-op (email_id dedupe).
 */
export async function POST(request: Request) {
  const secret = config.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret || !emailAgentEnabled()) {
    return Response.json(
      { ok: false, message: "Not configured." },
      { status: 503 },
    );
  }
  const body = await request.text();
  const valid = verifySvixSignature({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) {
    return Response.json(
      { ok: false, message: "Invalid signature." },
      { status: 401 },
    );
  }

  let event: z.infer<typeof eventSchema>;
  try {
    event = eventSchema.parse(JSON.parse(body));
  } catch {
    return Response.json(
      { ok: false, message: "Invalid event." },
      { status: 400 },
    );
  }
  if (event.type !== "email.received")
    return Response.json({ ok: true, ignored: true });

  const emailId = event.data.email_id;
  after(async () => {
    try {
      const result = await handleInboundEmail(emailId);
      console.info("chatbot email agent: inbound", { emailId, ...result });
    } catch (error) {
      console.error("chatbot email agent: inbound failed", {
        emailId,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  });
  return Response.json({ ok: true });
}
