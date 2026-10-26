import "server-only";

import { connect } from "node:http2";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appleStage,
  parseAppleSerial,
  type AppleWalletConfig,
} from "@/lib/wallet/apple-wallet";

/**
 * Apple Wallet pass web service storage + APNs. A registration row says "this
 * phone holds this pass"; the reminder cron pushes every phone holding a pass
 * for the current room, and each phone refetches its pass. Pushes are safe to
 * repeat: a phone only notifies when the pass's status line actually changes.
 */

const TABLE = "apple_wallet_registrations";

export async function registerDevice(row: {
  deviceLibraryId: string;
  serial: string;
  pushToken: string;
}): Promise<"created" | "exists"> {
  const parsed = parseAppleSerial(row.serial);
  if (!parsed) throw new Error("apple wallet: bad serial");
  const db = createAdminClient();
  const { data: existing, error: readError } = await db
    .from(TABLE)
    .select("push_token")
    .eq("device_library_id", row.deviceLibraryId)
    .eq("serial_number", row.serial)
    .maybeSingle();
  if (readError) throw new Error(`apple wallet read: ${readError.message}`);
  const { error } = await db.from(TABLE).upsert({
    device_library_id: row.deviceLibraryId,
    serial_number: row.serial,
    push_token: row.pushToken,
    room_start: new Date(parsed.startMs).toISOString(),
  });
  if (error) throw new Error(`apple wallet register: ${error.message}`);
  return existing ? "exists" : "created";
}

export async function unregisterDevice(
  deviceLibraryId: string,
  serial: string,
): Promise<void> {
  const { error } = await createAdminClient()
    .from(TABLE)
    .delete()
    .eq("device_library_id", deviceLibraryId)
    .eq("serial_number", serial);
  if (error) throw new Error(`apple wallet unregister: ${error.message}`);
}

/** Serials this phone holds whose status changed after `since` (ms). */
export async function updatedSerials(
  deviceLibraryId: string,
  since: number,
  now: number,
): Promise<{ serials: string[]; lastUpdated: number }> {
  const { data, error } = await createAdminClient()
    .from(TABLE)
    .select("serial_number")
    .eq("device_library_id", deviceLibraryId);
  if (error) throw new Error(`apple wallet list: ${error.message}`);
  let lastUpdated = since;
  const serials: string[] = [];
  for (const { serial_number } of data ?? []) {
    const parsed = parseAppleSerial(serial_number);
    if (!parsed) continue;
    const changed = appleStage(parsed.startMs, now).since;
    if (changed > since) serials.push(serial_number);
    lastUpdated = Math.max(lastUpdated, changed);
  }
  return { serials, lastUpdated };
}

export type ApplePushRun = {
  devices: number;
  sent: number;
  failed: number;
  removed: number;
};

type PushOne = (pushToken: string) => Promise<number>;

/** One HTTP/2 session to APNs, authenticated by the pass certificate. */
function apnsSender(cfg: AppleWalletConfig): {
  push: PushOne;
  close: () => void;
} {
  const session = connect("https://api.push.apple.com", {
    cert: cfg.signerCert,
    key: cfg.signerKey,
  });
  session.on("error", (error) =>
    console.error("[wallet] apns session error", { name: error.name }),
  );
  const push: PushOne = (pushToken) =>
    new Promise((resolve) => {
      const req = session.request({
        ":method": "POST",
        ":path": `/3/device/${pushToken}`,
        "apns-topic": cfg.passTypeId,
        "content-type": "application/json",
      });
      req.setTimeout(10_000, () => {
        req.close();
        resolve(0);
      });
      req.on("response", (headers) => resolve(Number(headers[":status"])));
      req.on("error", () => resolve(0));
      req.resume();
      req.end("{}");
    });
  return { push, close: () => session.close() };
}

/**
 * Tells every phone holding a pass for this room to refetch it. 410 from APNs
 * means the phone dropped the pass: its row is deleted.
 */
export async function pushRoom(
  cfg: AppleWalletConfig,
  startsAt: string,
  sender: { push: PushOne; close: () => void } = apnsSender(cfg),
): Promise<ApplePushRun> {
  const db = createAdminClient();
  const run: ApplePushRun = { devices: 0, sent: 0, failed: 0, removed: 0 };
  try {
    const { data, error } = await db
      .from(TABLE)
      .select("device_library_id, serial_number, push_token")
      .eq("room_start", new Date(startsAt).toISOString());
    if (error) throw new Error(`apple wallet room: ${error.message}`);
    const tokens = new Set((data ?? []).map((r) => r.push_token));
    run.devices = tokens.size;
    for (const token of tokens) {
      const status = await sender.push(token);
      if (status === 200) {
        run.sent += 1;
      } else if (status === 410) {
        run.removed += 1;
        const { error: delError } = await db
          .from(TABLE)
          .delete()
          .eq("push_token", token);
        if (delError) {
          console.error("[wallet] apns stale token not removed", {
            message: delError.message,
          });
        }
      } else {
        run.failed += 1;
        console.error("[wallet] apns push failed", { status });
      }
    }
  } finally {
    sender.close();
  }
  return run;
}
