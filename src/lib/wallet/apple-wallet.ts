import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PKPass } from "passkit-generator";

import { masterclassLiveEnd } from "@/lib/content/masterclass";
import { signCalendarToken } from "@/lib/masterclass-session";

/**
 * Apple Wallet event ticket (.pkpass) for one masterclass room. Same privacy
 * rules as the Google pass: no name, email or phone; the Join link is our signed
 * token route. A saved pass registers with our web service
 * (/api/wallet/apple/v1/...); at each reminder time the cron pushes, the phone
 * refetches, and the changed status line shows as a notification.
 */

export type AppleWalletConfig = {
  passTypeId: string;
  teamId: string;
  signerCert: string;
  signerKey: string;
  wwdr: string;
};

/** Accepts a PEM as-is or base64-encoded (Vercel env vars are single-line). */
function pem(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.includes("-----BEGIN")
    ? value
    : Buffer.from(value, "base64").toString("utf8");
  return text.includes("-----BEGIN") ? text : null;
}

/** null unless every Apple signing value is present and well-formed. */
export function appleWalletConfig(env: {
  APPLE_WALLET_PASS_TYPE_ID?: string;
  APPLE_WALLET_TEAM_ID?: string;
  APPLE_WALLET_SIGNER_CERT?: string;
  APPLE_WALLET_SIGNER_KEY?: string;
  APPLE_WALLET_WWDR?: string;
}): AppleWalletConfig | null {
  const passTypeId = env.APPLE_WALLET_PASS_TYPE_ID;
  const teamId = env.APPLE_WALLET_TEAM_ID;
  const signerCert = pem(env.APPLE_WALLET_SIGNER_CERT);
  const signerKey = pem(env.APPLE_WALLET_SIGNER_KEY);
  const wwdr = pem(env.APPLE_WALLET_WWDR);
  if (
    !passTypeId?.startsWith("pass.") ||
    !teamId ||
    !/^[A-Z0-9]{10}$/.test(teamId) ||
    !signerCert ||
    !signerKey ||
    !wwdr
  ) {
    return null;
  }
  return { passTypeId, teamId, signerCert, signerKey, wwdr };
}

const MODEL_DIR = path.join(process.cwd(), "src/lib/wallet/apple-model");
const IMAGES = [
  "icon.png",
  "icon@2x.png",
  "icon@3x.png",
  "logo.png",
  "logo@2x.png",
];

const MIN = 60_000;

/** Status line by time to start. A change to it is what notifies the phone. */
const STAGES = [
  { from: -Infinity, id: "saved", text: "Your seat is saved" },
  { from: -24 * 60 * MIN, id: "reminder_24h", text: "Tomorrow: see you there" },
  { from: -60 * MIN, id: "reminder_1h", text: "Starts in 1 hour" },
  { from: 0, id: "reminder_live", text: "We're live: tap Join" },
] as const;

export type AppleStage = (typeof STAGES)[number];

/** The stage in force at `now`, and when it began (ms; 0 for "saved"). */
export function appleStage(startMs: number, now: number) {
  const offset = now - startMs;
  const stage = [...STAGES].reverse().find((s) => offset >= s.from)!;
  return {
    stage,
    since: Number.isFinite(stage.from) ? startMs + stage.from : 0,
  };
}

const SERIAL = /^vp_(\d{13})_([A-Za-z0-9]{1,64})$/;

export const appleSerial = (startMs: number, contactId: string) =>
  `vp_${startMs}_${contactId}`;

/** { startMs, contactId } for one of our serials, else null. */
export function parseAppleSerial(serial: string) {
  const m = SERIAL.exec(serial);
  return m ? { startMs: Number(m[1]), contactId: m[2] } : null;
}

/** The per-pass web-service token: HMAC of the serial, so nothing is stored. */
export function appleAuthToken(serial: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`apple-pass.${serial}`)
    .digest("base64url");
}

/** True when an `Authorization: ApplePass <token>` header matches the serial. */
export function appleAuthOk(
  header: string | null,
  serial: string,
  secret: string | undefined,
): boolean {
  if (!header?.startsWith("ApplePass ") || !secret || secret.length < 32) {
    return false;
  }
  const got = Buffer.from(header.slice("ApplePass ".length));
  const want = Buffer.from(appleAuthToken(serial, secret));
  return got.length === want.length && timingSafeEqual(got, want);
}

export type ApplePassInput = {
  startsAt: string;
  contactId: string;
  siteUrl: string;
  /** MASTERCLASS_CAL_SECRET: signs the join token and the web-service token. */
  secret: string;
  now?: Date;
};

/** Signed .pkpass bytes for this contact and room. */
export async function applePassBuffer(
  cfg: AppleWalletConfig,
  input: ApplePassInput,
): Promise<Buffer> {
  const start = new Date(input.startsAt);
  const end = new Date(masterclassLiveEnd(input.startsAt) ?? input.startsAt);
  const serial = appleSerial(start.getTime(), input.contactId);
  const joinToken = signCalendarToken(input.contactId, start, input.secret);
  if (!joinToken) throw new Error("apple pass: cannot sign the join token");
  const joinUrl = `${input.siteUrl}/masterclass/join/${joinToken}`;
  const { stage } = appleStage(
    start.getTime(),
    (input.now ?? new Date()).getTime(),
  );
  const files = Object.fromEntries(
    IMAGES.map((f) => [f, readFileSync(path.join(MODEL_DIR, f))]),
  );
  const pass = new PKPass(
    files,
    {
      wwdr: cfg.wwdr,
      signerCert: cfg.signerCert,
      signerKey: cfg.signerKey,
    },
    {
      formatVersion: 1,
      passTypeIdentifier: cfg.passTypeId,
      teamIdentifier: cfg.teamId,
      serialNumber: serial,
      webServiceURL: `${input.siteUrl}/api/wallet/apple`,
      authenticationToken: appleAuthToken(serial, input.secret),
      organizationName: "Vendingpreneurs",
      description: "Vending Masterclass: Live",
      backgroundColor: "rgb(31,114,165)",
      foregroundColor: "rgb(255,255,255)",
      labelColor: "rgb(214,239,255)",
      sharingProhibited: true,
    },
  );
  pass.type = "eventTicket";
  const iso = start.toISOString();
  pass.primaryFields.push({
    key: "event",
    label: "LIVE ON ZOOM",
    value: "Vending Masterclass",
  });
  pass.secondaryFields.push(
    {
      key: "date",
      label: "DATE",
      value: iso,
      dateStyle: "PKDateStyleMedium",
      timeStyle: "PKDateStyleNone",
    },
    {
      key: "time",
      label: "TIME",
      value: iso,
      dateStyle: "PKDateStyleNone",
      timeStyle: "PKDateStyleShort",
    },
  );
  pass.auxiliaryFields.push(
    {
      key: "status",
      label: "STATUS",
      value: stage.text,
      changeMessage: "%@",
    },
    { key: "hosts", label: "HOSTS", value: "Mike & Anthony" },
  );
  pass.backFields.push({
    key: "join",
    label: "Join the webinar",
    value: joinUrl,
    attributedValue: `<a href="${joinUrl}">Tap to join</a>`,
  });
  pass.setRelevantDate(new Date(start.getTime() - 15 * 60_000));
  // Shown as expired a day after the room; the join token ends then too.
  pass.setExpirationDate(new Date(end.getTime() + 86_400_000));
  return pass.getAsBuffer();
}
