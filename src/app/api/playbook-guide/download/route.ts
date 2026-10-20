import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { GUIDE } from "@/lib/content/playbook-guide";
import { LTF_PATHS } from "@/lib/ltf/assignment";
import { countDownload, findDownloadableOrder } from "@/lib/ltf/orders";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "ltf-playbook";
const SIGNED_URL_SECONDS = 300;

/**
 * The buyer's download link (thank-you page and email). Serves the private
 * PDF through a 5-minute signed URL, only for a paid, unrefunded order. Works
 * whether or not the test is switched on, so buyers keep access.
 */
export async function GET(request: NextRequest) {
  const recover = () =>
    NextResponse.redirect(
      new URL(`${LTF_PATHS.access}?expired=1`, request.url),
      303,
    );
  const db = createAdminClient();
  try {
    const order = await findDownloadableOrder(
      db,
      request.nextUrl.searchParams.get("token"),
    );
    if (!order) return recover();
    if (!config.PLAYBOOK_PDF_OBJECT)
      throw new Error("PLAYBOOK_PDF_OBJECT is not set");

    const signed = await db.storage
      .from(BUCKET)
      .createSignedUrl(config.PLAYBOOK_PDF_OBJECT, SIGNED_URL_SECONDS, {
        download: GUIDE.fileName,
      });
    if (signed.error) throw new Error(signed.error.message);

    await countDownload(db, order);
    const response = NextResponse.redirect(signed.data.signedUrl, 302);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error("ltf download failed", error);
    return NextResponse.redirect(
      new URL(`${LTF_PATHS.access}?error=1`, request.url),
      303,
    );
  }
}
