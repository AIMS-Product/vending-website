import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "@/lib/config";
import {
  recordSyncRun,
  upsertChannelDaily,
} from "@/lib/services/channel-daily";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type IngestClient = Pick<SupabaseClient<Database>, "from">;

export const MANYCHAT_INGEST_CONNECTOR = "manychat-ingest";

/**
 * The DM setter's stages, in funnel order. Each is a tag the flows already
 * apply; the flow's External Request names the stage it just reached.
 */
export const MANYCHAT_EVENTS = [
  "new_lead",
  "booking_link_sent",
  "call_booked",
  "call_pitched",
  "closed",
] as const;

export type ManychatEvent = (typeof MANYCHAT_EVENTS)[number];

/**
 * What a flow sends. Only the contact id and the stage are required; the
 * receiver fills the rest from the ManyChat API so the flow edit is one line.
 * The optional fields are the fallback when the API key is absent.
 */
export const ingestPayloadSchema = z.object({
  subscriber_id: z.coerce
    .string()
    .regex(/^\d{1,24}$/, "Expected a numeric id."),
  event: z.enum(MANYCHAT_EVENTS),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  ig_username: z.string().max(120).optional().nullable(),
  email: z.string().max(320).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;

/** The slice of a ManyChat subscriber this receiver keeps. */
export type ManychatSubscriber = {
  ig_username: string | null;
  email: string | null;
  phone: string | null;
  subscribed: string | null;
  tags: string[];
};

export class ManychatIngestError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ManychatIngestError";
    this.status = status;
  }
}

export type ManychatIngestResult = {
  day: string;
  event: ManychatEvent;
  enriched: boolean;
};

/**
 * Receives one stage event from a ManyChat flow, enriches it from the
 * ManyChat API when a key is configured, stores it, and rewrites that day's
 * Instagram DM row on the spine from the stored events. Idempotent: the same
 * contact reaching the same stage twice in a day is one row and one count.
 * The run is recorded either way so a rejected payload shows red on the
 * Channels tab instead of vanishing.
 */
export async function ingestManychatEvent(
  body: unknown,
  deps: {
    client?: IngestClient;
    now?: Date;
    fetchSubscriber?: (id: string) => Promise<ManychatSubscriber | null>;
  } = {},
): Promise<ManychatIngestResult> {
  const client = deps.client ?? createAdminClient();
  const now = deps.now ?? new Date();
  const fetchSubscriber = deps.fetchSubscriber ?? fetchSubscriberFromApi;

  const parsed = ingestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue
      ? `Invalid payload at ${issue.path.join(".") || "root"}: ${issue.message}`
      : "Invalid payload.";
    await recordSyncRun(client, MANYCHAT_INGEST_CONNECTOR, async () => {
      throw new ManychatIngestError(message);
    });
    throw new ManychatIngestError(message);
  }
  const payload = parsed.data;

  let result: ManychatIngestResult | null = null;
  const outcome = await recordSyncRun(
    client,
    MANYCHAT_INGEST_CONNECTOR,
    async () => {
      result = await write(client, payload, now, fetchSubscriber);
      return { rowsWritten: 2 };
    },
    { now: () => now },
  );
  if (outcome.error || !result) {
    throw new ManychatIngestError(outcome.error ?? "Ingest failed.", 500);
  }
  return result;
}

async function write(
  client: IngestClient,
  payload: IngestPayload,
  now: Date,
  fetchSubscriber: (id: string) => Promise<ManychatSubscriber | null>,
): Promise<ManychatIngestResult> {
  const occurredAt = payload.occurred_at ? new Date(payload.occurred_at) : now;
  const day = occurredAt.toISOString().slice(0, 10);

  let subscriber: ManychatSubscriber | null = null;
  try {
    subscriber = await fetchSubscriber(payload.subscriber_id);
  } catch (error) {
    // The event still counts; the row just carries what the flow sent.
    console.warn("manychat ingest: enrichment failed", {
      message: error instanceof Error ? error.message : undefined,
    });
  }

  const { error } = await client.from("manychat_events").upsert(
    {
      subscriber_id: payload.subscriber_id,
      event: payload.event,
      day,
      occurred_at: occurredAt.toISOString(),
      ig_username: subscriber?.ig_username ?? payload.ig_username ?? null,
      email: subscriber?.email ?? payload.email ?? null,
      phone: subscriber?.phone ?? payload.phone ?? null,
      subscribed_at: subscriber?.subscribed ?? null,
      tags: subscriber?.tags ?? [],
      enriched: subscriber !== null,
      received_at: now.toISOString(),
    },
    { onConflict: "subscriber_id,event,day" },
  );
  if (error) throw new Error(`manychat_events upsert failed: ${error.message}`);

  await rollupDay(client, day, now);
  return { day, event: payload.event, enriched: subscriber !== null };
}

/** Distinct contacts per stage for one day, written as one spine row. */
async function rollupDay(client: IngestClient, day: string, now: Date) {
  const { data, error } = await client
    .from("manychat_events")
    .select("event,subscriber_id")
    .eq("day", day);
  if (error) throw new Error(`manychat_events read failed: ${error.message}`);

  const contacts = new Map<ManychatEvent, Set<string>>();
  for (const row of data ?? []) {
    const set = contacts.get(row.event as ManychatEvent) ?? new Set<string>();
    set.add(row.subscriber_id);
    contacts.set(row.event as ManychatEvent, set);
  }
  const count = (event: ManychatEvent) => contacts.get(event)?.size ?? 0;

  const spine = await upsertChannelDaily(
    client,
    [
      {
        // No channel override: `manychat` resolves to Instagram DM by rule,
        // and the key normaliser title-cases overrides ("Instagram Dm").
        day,
        source: "manychat",
        medium: "chat",
        campaign: "pearl",
        content: null,
        term: "book-call",
        leads: count("new_lead"),
        clicks: count("booking_link_sent"),
        booked: count("call_booked"),
        won: count("closed"),
      },
    ],
    { now },
  );
  if (spine.failed > 0) throw new Error("channel_daily row failed to write.");
}

type ManychatInfoResponse = {
  status: string;
  data?: {
    ig_username?: string | null;
    email?: string | null;
    phone?: string | null;
    subscribed?: string | null;
    tags?: Array<{ name?: string }>;
  };
};

/** GET /fb/subscriber/getInfo; null when no key is configured. 10 qps limit. */
async function fetchSubscriberFromApi(
  id: string,
): Promise<ManychatSubscriber | null> {
  const key = config.MANYCHAT_API_KEY;
  if (!key) return null;
  const response = await fetch(
    `https://api.manychat.com/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(id)}`,
    { headers: { authorization: `Bearer ${key}` } },
  );
  if (!response.ok) {
    throw new Error(`ManyChat getInfo answered ${response.status}.`);
  }
  const json = (await response.json()) as ManychatInfoResponse;
  if (json.status !== "success" || !json.data) {
    throw new Error("ManyChat getInfo returned no subscriber.");
  }
  return {
    ig_username: json.data.ig_username ?? null,
    email: json.data.email ?? null,
    phone: json.data.phone ?? null,
    subscribed: json.data.subscribed ?? null,
    tags: (json.data.tags ?? [])
      .map((tag) => tag.name)
      .filter((name): name is string => typeof name === "string"),
  };
}
