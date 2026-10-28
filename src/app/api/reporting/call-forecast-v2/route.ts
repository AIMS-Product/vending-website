import { NextResponse } from "next/server";
import { hasValidBearer } from "@/lib/bearer-auth";
import { config } from "@/lib/config";
import { getProductionV2 } from "@/lib/services/booking-production-v2";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
export async function GET(request: Request) {
  if (!config.REPORTING_API_KEY)
    return NextResponse.json(
      { ok: false, message: "Reporting API is not configured." },
      { status: 503, headers },
    );
  if (
    !hasValidBearer(
      request.headers.get("authorization"),
      config.REPORTING_API_KEY,
    )
  )
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401, headers },
    );
  try {
    return NextResponse.json(
      await getProductionV2(
        new URL(request.url).searchParams.get("details") === "1",
      ),
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "The complete V2 source could not be verified. Retrying automatically.",
      },
      { status: 503, headers },
    );
  }
}
