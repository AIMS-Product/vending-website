import "server-only";

import { createHash, createSign } from "node:crypto";
import { z } from "zod";

import { masterclassLiveEnd } from "@/lib/content/masterclass";

/**
 * Google Wallet event ticket for one masterclass room. One pass class per room
 * (its date lives on the class), one object per contact. The pass carries no
 * PII: no name, email or phone, and the Join link is our signed token route,
 * which reads the personal Zoom link at tap time. The reminder cron finds every
 * saved pass by listing the room's class, so no table of pass holders exists.
 * Spec: .claude/specs/2026-10-23-google-wallet-pass.md.
 */

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

export type WalletConfig = {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
};

const serviceAccount = z.object({
  client_email: z.string().email(),
  private_key: z.string().includes("PRIVATE KEY"),
});

/** null when the issuer id or a well-formed service-account key is missing. */
export function walletConfig(env: {
  GOOGLE_WALLET_ISSUER_ID?: string;
  GOOGLE_WALLET_SA_KEY?: string;
}): WalletConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuerId || !/^\d{1,30}$/.test(issuerId) || !env.GOOGLE_WALLET_SA_KEY) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(env.GOOGLE_WALLET_SA_KEY);
  } catch {
    console.error("[wallet] GOOGLE_WALLET_SA_KEY is not JSON");
    return null;
  }
  const sa = serviceAccount.safeParse(raw);
  if (!sa.success) {
    console.error(
      "[wallet] GOOGLE_WALLET_SA_KEY lacks client_email/private_key",
    );
    return null;
  }
  return {
    issuerId,
    clientEmail: sa.data.client_email,
    privateKey: sa.data.private_key,
  };
}

/** Deterministic bucket: the same contact always lands in or out. */
export function inWalletRollout(
  contactId: string,
  percent: string | undefined,
): boolean {
  const pct = Math.min(100, Math.max(0, Number(percent ?? 0) || 0));
  const bucket =
    createHash("sha256").update(contactId).digest().readUInt16BE(0) % 100;
  return bucket < pct;
}

/** `202610280030`: the room's UTC start, safe in a Wallet id. */
const roomKey = (startsAt: string) =>
  new Date(startsAt).toISOString().slice(0, 16).replace(/\D/g, "");

export const roomClassId = (issuerId: string, startsAt: string) =>
  `${issuerId}.vp_masterclass_${roomKey(startsAt)}`;

export const ticketObjectId = (
  issuerId: string,
  startsAt: string,
  contactId: string,
) => `${issuerId}.vp_${roomKey(startsAt)}_${contactId}`;

/** ISO with the Chicago offset, so Wallet shows the local time, not UTC. */
export function chicagoIso(date: Date): string {
  const offset =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+00:00";
  const sign = offset.startsWith("-") ? -1 : 1;
  const minutes = Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6));
  const local = new Date(date.getTime() + sign * minutes * 60_000);
  return `${local.toISOString().slice(0, 19)}${offset}`;
}

const text = (value: string) => ({
  defaultValue: { language: "en-US", value },
});

export type TicketInput = {
  startsAt: string;
  contactId: string;
  /** Our signed /masterclass/join/<token> URL. */
  joinUrl: string;
  siteUrl: string;
};

/** The class + object a save link inserts. Google keeps an existing class as is. */
export function ticketPayload(cfg: WalletConfig, input: TicketInput) {
  const start = new Date(input.startsAt);
  const end = new Date(masterclassLiveEnd(input.startsAt) ?? input.startsAt);
  const classId = roomClassId(cfg.issuerId, input.startsAt);
  const image = (file: string, alt: string) => ({
    sourceUri: { uri: `${input.siteUrl}/images/wallet/${file}` },
    contentDescription: text(alt),
  });
  return {
    eventTicketClasses: [
      {
        id: classId,
        issuerName: "Vendingpreneurs",
        eventName: text("Vending Masterclass: Live"),
        reviewStatus: "UNDER_REVIEW",
        hexBackgroundColor: "#1f72a5",
        logo: image("google-logo.png", "Vendingpreneurs"),
        heroImage: image("google-hero.png", "Mike and Anthony"),
        dateTime: { start: chicagoIso(start), end: chicagoIso(end) },
        venue: { name: text("Live on Zoom"), address: text("Tap Join below") },
        homepageUri: { uri: input.siteUrl, description: "Vendingpreneurs" },
      },
    ],
    eventTicketObjects: [
      {
        id: ticketObjectId(cfg.issuerId, input.startsAt, input.contactId),
        classId,
        state: "ACTIVE",
        linksModuleData: {
          uris: [
            { id: "join", uri: input.joinUrl, description: "Join the webinar" },
          ],
        },
        textModulesData: [
          {
            id: "hosts",
            header: "Hosts",
            body: "Mike Hoffmann & Anthony Kolodziej",
          },
        ],
        // Shown as expired a day after the room; the join token ends then too.
        validTimeInterval: {
          end: { date: new Date(start.getTime() + 86_400_000).toISOString() },
        },
      },
    ],
  };
}

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

function signJwt(cfg: WalletConfig, claims: Record<string, unknown>): string {
  const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url(claims)}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(cfg.privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

/** The pay.google.com link that saves this room's ticket. */
export function saveUrl(
  cfg: WalletConfig,
  input: TicketInput,
  now: Date = new Date(),
): string {
  const jwt = signJwt(cfg, {
    iss: cfg.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(now.getTime() / 1000),
    origins: [input.siteUrl],
    payload: ticketPayload(cfg, input),
  });
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

// ---------- reminders ----------

export type Reminder = { id: string; header: string; body: string };

const MIN = 60_000;
/** [opens, closes) relative to the start. Each is sent once per pass (by id). */
const REMINDERS: { from: number; to: number; reminder: Reminder }[] = [
  {
    from: -24 * 60 * MIN,
    to: -23 * 60 * MIN,
    reminder: {
      id: "reminder_24h",
      header: "Tomorrow: Vending Masterclass",
      body: "Mike and Anthony go live tomorrow. Your seat is saved here; tap Join when it starts.",
    },
  },
  {
    from: -60 * MIN,
    to: -40 * MIN,
    reminder: {
      id: "reminder_1h",
      header: "Starting in 1 hour",
      body: "The masterclass starts in an hour. Tap Join on this ticket to get in.",
    },
  },
  {
    from: 0,
    to: 20 * MIN,
    reminder: {
      id: "reminder_live",
      header: "We're live",
      body: "Mike and Anthony are live now. Tap Join to watch.",
    },
  },
];

/** The reminder whose window holds `now`, or null. */
export function dueReminder(startsAt: string, now: Date): Reminder | null {
  const offset = now.getTime() - Date.parse(startsAt);
  return (
    REMINDERS.find((r) => offset >= r.from && offset < r.to)?.reminder ?? null
  );
}

type Fetch = typeof fetch;

async function accessToken(cfg: WalletConfig, fetchImpl: Fetch) {
  // Always the real clock: Google rejects an assertion issued in the future.
  const iat = Math.floor(Date.now() / 1000);
  const assertion = signJwt(cfg, {
    iss: cfg.clientEmail,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  });
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = z
    .object({ access_token: z.string() })
    .safeParse(await response.json().catch(() => null));
  if (!response.ok || !body.success) {
    throw new Error(`Google token request failed: ${response.status}`);
  }
  return body.data.access_token;
}

const walletPass = z.object({
  id: z.string(),
  state: z.string().optional(),
  messages: z.array(z.object({ id: z.string().optional() })).optional(),
});

const objectList = z.object({
  resources: z.array(walletPass).optional(),
  pagination: z.object({ nextPageToken: z.string().optional() }).optional(),
});

export type ReminderRun = {
  reminder: string | null;
  passes: number;
  sent: number;
  alreadySent: number;
  failed: number;
};

type Pass = z.infer<typeof walletPass>;
type Authed = { fetchImpl: Fetch; headers: Record<string, string> };

/** Every pass Google holds for the room's class, page by page; [] when the class does not exist yet. */
async function listRoomPasses(
  { fetchImpl, headers }: Authed,
  classId: string,
): Promise<Pass[]> {
  const passes: Pass[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${API}/eventTicketObject`);
    url.searchParams.set("classId", classId);
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("token", pageToken);
    const response = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    // No pass was ever saved for this room: Google has no class yet.
    if (response.status === 404) return passes;
    const page = objectList.safeParse(await response.json().catch(() => null));
    if (!response.ok || !page.success) {
      throw new Error(`Wallet object list failed: ${response.status}`);
    }
    passes.push(...(page.data.resources ?? []));
    pageToken = page.data.pagination?.nextPageToken;
  } while (pageToken);
  return passes;
}

/** null when Google took the message, else the HTTP status or error name. Never throws. */
function addReminder(
  { fetchImpl, headers }: Authed,
  passId: string,
  reminder: Reminder,
): Promise<string | null> {
  return fetchImpl(
    `${API}/eventTicketObject/${encodeURIComponent(passId)}/addMessage`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: { ...reminder, messageType: "TEXT_AND_NOTIFY" },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  ).then(
    (sent) => (sent.ok ? null : String(sent.status)),
    (error: unknown) => (error instanceof Error ? error.name : "UnknownError"),
  );
}

/**
 * Sends the due reminder to every active saved pass for the room, once each:
 * a pass that already carries the reminder's message id is skipped, so a
 * re-run never notifies twice. Google does not dedupe message ids itself, so
 * the caller must also hold the run claim (see the cron route) so two runs
 * never overlap. One failed pass (HTTP or network) is counted and logged, the
 * rest still get theirs; a failed list throws.
 */
export async function sendDueReminders(
  cfg: WalletConfig,
  startsAt: string,
  {
    fetchImpl = fetch,
    now = new Date(),
  }: { fetchImpl?: Fetch; now?: Date } = {},
): Promise<ReminderRun> {
  const reminder = dueReminder(startsAt, now);
  const run: ReminderRun = {
    reminder: reminder?.id ?? null,
    passes: 0,
    sent: 0,
    alreadySent: 0,
    failed: 0,
  };
  if (!reminder) return run;

  const authed: Authed = {
    fetchImpl,
    headers: {
      Authorization: `Bearer ${await accessToken(cfg, fetchImpl)}`,
      "Content-Type": "application/json",
    },
  };
  const passes = await listRoomPasses(
    authed,
    roomClassId(cfg.issuerId, startsAt),
  );
  // Google answers the state in lowercase ("active") though it takes "ACTIVE".
  for (const pass of passes.filter(
    (p) => (p.state ?? "ACTIVE").toUpperCase() === "ACTIVE",
  )) {
    run.passes += 1;
    if (pass.messages?.some((m) => m.id === reminder.id)) {
      run.alreadySent += 1;
      continue;
    }
    const status = await addReminder(authed, pass.id, reminder);
    if (status === null) {
      run.sent += 1;
    } else {
      run.failed += 1;
      console.error("[wallet] reminder not sent", {
        reminder: reminder.id,
        status,
      });
    }
  }
  return run;
}
