import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { PKPass } from "passkit-generator";

import { masterclassLiveEnd } from "@/lib/content/masterclass";

/**
 * Apple Wallet event ticket (.pkpass) for one masterclass room. Same privacy
 * rules as the Google pass: no name, email or phone; the Join link is our signed
 * token route. No pass web service yet, so a saved pass never updates (no
 * reminders); iOS still surfaces it on the lock screen near its relevant date.
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
  "strip.png",
  "strip@2x.png",
];

export type ApplePassInput = {
  startsAt: string;
  contactId: string;
  /** Our signed /masterclass/join/<token> URL. */
  joinUrl: string;
};

/** Signed .pkpass bytes for this contact and room. */
export async function applePassBuffer(
  cfg: AppleWalletConfig,
  input: ApplePassInput,
): Promise<Buffer> {
  const start = new Date(input.startsAt);
  const end = new Date(masterclassLiveEnd(input.startsAt) ?? input.startsAt);
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
      serialNumber: `vp_${start.getTime()}_${input.contactId}`,
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
  pass.auxiliaryFields.push({
    key: "hosts",
    label: "HOSTS",
    value: "Mike & Anthony",
  });
  pass.backFields.push({
    key: "join",
    label: "Join the webinar",
    value: input.joinUrl,
    attributedValue: `<a href="${input.joinUrl}">Tap to join</a>`,
  });
  pass.setRelevantDate(new Date(start.getTime() - 15 * 60_000));
  // Shown as expired a day after the room; the join token ends then too.
  pass.setExpirationDate(new Date(end.getTime() + 86_400_000));
  return pass.getAsBuffer();
}
