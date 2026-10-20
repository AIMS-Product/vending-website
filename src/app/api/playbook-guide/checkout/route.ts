import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import {
  LTF_COOKIE,
  LTF_PATHS,
  getLtfVisitor,
  isLtfTestOpen,
  recordLtfEvent,
} from "@/lib/ltf/assignment";
import { getLtfStripe, originOf } from "@/lib/ltf/deps";
import { createStripeCheckout } from "@/lib/ltf/orders";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The buy button (a plain form POST, so it works before hydration). The
 * price comes from STRIPE_PLAYBOOK_PRICE_ID only; nothing in the request sets
 * an amount.
 */
export async function POST(request: NextRequest) {
  const back = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), 303);
  if (!isLtfTestOpen()) return back("/playbook");

  const db = createAdminClient();
  try {
    const visitor = await getLtfVisitor(
      db,
      (await cookies()).get(LTF_COOKIE)?.value,
    );
    if (!visitor) return back(LTF_PATHS.go);
    if (!config.STRIPE_PLAYBOOK_PRICE_ID) {
      throw new Error("STRIPE_PLAYBOOK_PRICE_ID is not set");
    }

    const source = await db
      .from("ltf_visitors")
      .select("utm_source, utm_campaign")
      .eq("visitor_id", visitor.visitorId)
      .single();
    if (source.error) throw new Error(source.error.message);

    const url = await createStripeCheckout(
      { db, stripe: getLtfStripe() },
      {
        visitorId: visitor.visitorId,
        priceId: config.STRIPE_PLAYBOOK_PRICE_ID,
        siteOrigin: originOf(request),
        utmSource: source.data.utm_source,
        utmCampaign: source.data.utm_campaign,
      },
    );
    await recordLtfEvent(db, visitor.visitorId, "checkout_start");
    return NextResponse.redirect(url, 303);
  } catch (error) {
    console.error("ltf stripe checkout failed", error);
    return back(`${LTF_PATHS.offer}?error=checkout`);
  }
}
