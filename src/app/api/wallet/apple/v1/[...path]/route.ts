import { z } from "zod";
import { config, publicConfig } from "@/lib/config";
import {
  appleAuthOk,
  appleStage,
  appleWalletConfig,
  applePassBuffer,
  parseAppleSerial,
} from "@/lib/wallet/apple-wallet";
import {
  registerDevice,
  unregisterDevice,
  updatedSerials,
} from "@/lib/wallet/apple-wallet-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Apple Wallet pass web service (Apple's fixed protocol, under the pass's
 * webServiceURL /api/wallet/apple):
 *   POST/DELETE v1/devices/<device>/registrations/<passType>/<serial>
 *   GET         v1/devices/<device>/registrations/<passType>?passesUpdatedSince=
 *   GET         v1/passes/<passType>/<serial>
 *   POST        v1/log
 * Every pass call carries `Authorization: ApplePass <HMAC of the serial>`.
 */

type Ctx = { params: Promise<{ path: string[] }> };
const status = (code: number) =>
  new Response(null, {
    status: code,
    headers: { "Cache-Control": "no-store" },
  });
const DEVICE = /^[A-Za-z0-9]{1,128}$/;
const registrationBody = z.object({
  pushToken: z.string().regex(/^[A-Fa-f0-9]{16,200}$/),
});

/** The serial-scoped routes' common checks: config, pass type, serial, auth. */
function authorize(request: Request, passType: string, serial: string) {
  const cfg = appleWalletConfig(config);
  if (!cfg || passType !== cfg.passTypeId || !parseAppleSerial(serial)) {
    return null;
  }
  return appleAuthOk(
    request.headers.get("authorization"),
    serial,
    config.MASTERCLASS_CAL_SECRET,
  )
    ? cfg
    : null;
}

export async function POST(request: Request, { params }: Ctx) {
  const path = (await params).path;
  if (path.length === 1 && path[0] === "log") {
    const body = await request.text();
    console.warn("[wallet] apple device log", body.slice(0, 2000));
    return status(200);
  }
  const [devices, device, registrations, passType, serial] = path;
  if (
    path.length !== 5 ||
    devices !== "devices" ||
    registrations !== "registrations" ||
    !DEVICE.test(device)
  ) {
    return status(404);
  }
  if (!authorize(request, passType, serial)) return status(401);
  const parsed = registrationBody.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return status(400);
  try {
    const result = await registerDevice({
      deviceLibraryId: device,
      serial,
      pushToken: parsed.data.pushToken,
    });
    return status(result === "created" ? 201 : 200);
  } catch (error) {
    console.error("[wallet] apple register failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return status(500);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const path = (await params).path;
  const [devices, device, registrations, passType, serial] = path;
  if (
    path.length !== 5 ||
    devices !== "devices" ||
    registrations !== "registrations" ||
    !DEVICE.test(device)
  ) {
    return status(404);
  }
  if (!authorize(request, passType, serial)) return status(401);
  try {
    await unregisterDevice(device, serial);
    return status(200);
  } catch (error) {
    console.error("[wallet] apple unregister failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return status(500);
  }
}

export async function GET(request: Request, { params }: Ctx) {
  const path = (await params).path;
  const now = Date.now();

  // v1/passes/<passType>/<serial>: the latest version of one pass.
  if (path.length === 3 && path[0] === "passes") {
    const [, passType, serial] = path;
    const cfg = authorize(request, passType, serial);
    const secret = config.MASTERCLASS_CAL_SECRET;
    if (!cfg || !secret) return status(401);
    const { startMs, contactId } = parseAppleSerial(serial)!;
    const modified = appleStage(startMs, now).since;
    const since = Date.parse(request.headers.get("if-modified-since") ?? "");
    if (!Number.isNaN(since) && Math.floor(modified / 1000) * 1000 <= since) {
      return status(304);
    }
    try {
      const body = await applePassBuffer(cfg, {
        startsAt: new Date(startMs).toISOString(),
        contactId,
        siteUrl: publicConfig.siteUrl,
        secret,
        now: new Date(now),
      });
      return new Response(new Uint8Array(body), {
        headers: {
          "content-type": "application/vnd.apple.pkpass",
          "last-modified": new Date(modified || startMs).toUTCString(),
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      console.error("[wallet] apple pass rebuild failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
      return status(500);
    }
  }

  // v1/devices/<device>/registrations/<passType>: which passes changed.
  const [devices, device, registrations, passType] = path;
  const cfg = appleWalletConfig(config);
  if (
    path.length !== 4 ||
    devices !== "devices" ||
    registrations !== "registrations" ||
    !DEVICE.test(device) ||
    !cfg ||
    passType !== cfg.passTypeId
  ) {
    return status(404);
  }
  const sinceParam = new URL(request.url).searchParams.get(
    "passesUpdatedSince",
  );
  const since =
    sinceParam && /^\d{1,15}$/.test(sinceParam) ? Number(sinceParam) : -1;
  try {
    const { serials, lastUpdated } = await updatedSerials(device, since, now);
    if (serials.length === 0) return status(204);
    return Response.json(
      { serialNumbers: serials, lastUpdated: String(lastUpdated) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[wallet] apple updated list failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return status(500);
  }
}
