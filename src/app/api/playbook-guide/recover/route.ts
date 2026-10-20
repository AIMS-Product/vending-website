import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { LTF_PATHS } from "@/lib/ltf/assignment";
import { resendDeliverySender } from "@/lib/ltf/delivery-email";
import { originOf } from "@/lib/ltf/deps";
import { resendAccess } from "@/lib/ltf/orders";
import { checkPublicRateLimit, requestIp } from "@/lib/public-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const emailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * "Send me my link again." Same answer whether or not the email bought, so
 * the form cannot be used to check who is a buyer. Rate limited per IP and
 * per email.
 */
export async function POST(request: NextRequest) {
  const done = (query: string) =>
    NextResponse.redirect(
      new URL(`${LTF_PATHS.access}?${query}`, request.url),
      303,
    );
  const form = await request.formData();
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return done("invalid=1");

  const allowed = await checkPublicRateLimit("ltf_recover", {
    ip: requestIp(request.headers),
    email: parsed.data,
  });
  if (!allowed) return done("limited=1");

  try {
    const origin = originOf(request);
    await resendAccess(
      {
        db: createAdminClient(),
        sendEmail: resendDeliverySender(origin),
        siteOrigin: origin,
      },
      parsed.data,
    );
  } catch (error) {
    console.error("ltf recovery failed", error);
    return done("error=1");
  }
  return done("sent=1");
}
