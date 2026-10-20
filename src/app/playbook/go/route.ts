import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  LTF_COOKIE,
  LTF_COOKIE_MAX_AGE,
  LTF_PATHS,
  assignLtfVisitor,
  getLtfVisitor,
} from "@/lib/ltf/assignment";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one shared webinar offer link. Assigns the visitor a sticky version
 * (cookie + `ltf_visitors` row) and sends them to the offer page with the
 * link's query intact.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.toString();
  const to = (path: string) =>
    new URL(`${path}${query ? `?${query}` : ""}`, request.url);

  const db = createAdminClient();
  const jar = await cookies();
  try {
    const existing = await getLtfVisitor(db, jar.get(LTF_COOKIE)?.value);
    const visitor =
      existing ??
      (await assignLtfVisitor(db, {
        source: {
          utm_source: searchParams.get("utm_source"),
          utm_medium: searchParams.get("utm_medium"),
          utm_campaign: searchParams.get("utm_campaign"),
          utm_content: searchParams.get("utm_content"),
        },
        userAgent: request.headers.get("user-agent"),
      }));
    const response = NextResponse.redirect(to(LTF_PATHS.offer));
    response.cookies.set(LTF_COOKIE, visitor.visitorId, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: LTF_COOKIE_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (error) {
    // Tracking failed: still show the offer, untracked (ltf_fallback stops
    // the offer page sending the visitor back here).
    console.error("ltf assignment failed", error);
    const fallback = to(LTF_PATHS.offer);
    fallback.searchParams.set("ltf_fallback", "1");
    return NextResponse.redirect(fallback);
  }
}
