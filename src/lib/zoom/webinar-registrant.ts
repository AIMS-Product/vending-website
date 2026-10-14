import "server-only";

import { z } from "zod";

/**
 * Registers a site sign-up in this week's Zoom webinar and returns their
 * personal join link, so the first GHL email can carry it instead of racing
 * the GHL > Zoom zap. Never throws: any failure returns null with a logged
 * reason (no PII), and the zap path fills `Zoom Url` as before.
 * Spec: .claude/specs/2026-10-13-personal-zoom-link.md.
 */

const API = "https://api.zoom.us/v2";
const TOKEN_URL = "https://zoom.us/oauth/token";
/** The webinars' host (same as vp-webinars automation/zoom/zoom_pull.py HOST). */
export const ZOOM_HOST = "anthony@vendingpreneurs.co";
/** Every Zoom call in one registration shares this budget; GHL waits on it before tagging. */
export const ZOOM_BUDGET_MS = 6000;
const WEBINAR_CACHE_MS = 5 * 60 * 1000;

export type ZoomCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

export type ZoomRegistrant = {
  startsAt: string;
  email: string;
  firstName: string;
  lastName: string;
};

type Deps = { fetchImpl?: typeof fetch; now?: () => number };

const tokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number(),
});
const webinarList = z.object({
  webinars: z.array(
    z.object({ id: z.number(), start_time: z.string().nullish() }),
  ),
});
const registrantResponse = z.object({ join_url: z.url() });

class ZoomSkip extends Error {}

// ponytail: per-instance caches; a cold serverless instance pays one token and one list read.
let token: { value: string; until: number } | null = null;
let webinars: {
  list: z.infer<typeof webinarList>["webinars"];
  until: number;
} | null = null;

/** Test hook: forget the cached token and webinar list. */
export function resetZoomCache() {
  token = null;
  webinars = null;
}

const chicagoDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

/**
 * The upcoming webinar on the room's Central Time date. Matched by date, not
 * instant: the Zoom start can differ from the advertised GHL time (Oct 20 is
 * scheduled 6:00 PM CT in Zoom). None or several -> no id, never a guess.
 */
export function pickWebinar(
  list: { id: number; start_time?: string | null }[],
  startsAt: string,
): number | null {
  const day = chicagoDay(startsAt);
  const matches = list.filter(
    (w) => w.start_time && chicagoDay(w.start_time) === day,
  );
  return matches.length === 1 ? matches[0].id : null;
}

/** A Zoom webinar join link: https, a zoom.us host, path /w/<id> (this webinar's id when given). */
export function isJoinLinkFor(url: string, id?: number | string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "zoom.us" || parsed.hostname.endsWith(".zoom.us")) &&
      (id === undefined
        ? /^\/w\/\d+$/.test(parsed.pathname)
        : parsed.pathname === `/w/${id}`)
    );
  } catch {
    return false;
  }
}

export async function registerZoomRegistrant(
  person: ZoomRegistrant,
  creds: ZoomCredentials,
  { fetchImpl = fetch, now = Date.now }: Deps = {},
): Promise<string | null> {
  const signal = AbortSignal.timeout(ZOOM_BUDGET_MS);
  const call = async (step: string, url: string, init: RequestInit = {}) => {
    const response = await fetchImpl(url, { ...init, signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ZoomSkip(`${step} ${response.status}`);
    }
    return response.json();
  };
  const authed = async (step: string, path: string, init: RequestInit = {}) => {
    if (!token || token.until <= now()) {
      const basic = Buffer.from(
        `${creds.clientId}:${creds.clientSecret}`,
      ).toString("base64");
      const parsed = tokenResponse.parse(
        await call(
          "token",
          `${TOKEN_URL}?${new URLSearchParams({ grant_type: "account_credentials", account_id: creds.accountId })}`,
          { method: "POST", headers: { Authorization: `Basic ${basic}` } },
        ),
      );
      token = {
        value: parsed.access_token,
        until: now() + (parsed.expires_in - 60) * 1000,
      };
    }
    return call(step, `${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token.value}`,
        "Content-Type": "application/json",
      },
    });
  };

  try {
    if (!webinars || webinars.until <= now()) {
      const parsed = webinarList.parse(
        await authed(
          "list",
          `/users/${encodeURIComponent(ZOOM_HOST)}/webinars?type=upcoming&page_size=100`,
        ),
      );
      webinars = { list: parsed.webinars, until: now() + WEBINAR_CACHE_MS };
    }
    const id = pickWebinar(webinars.list, person.startsAt);
    if (id === null) throw new ZoomSkip("no single webinar on the room date");
    // Re-registering an email returns the same registrant, so the zap doing it too is harmless.
    const { join_url } = registrantResponse.parse(
      await authed("register", `/webinars/${id}/registrants`, {
        method: "POST",
        body: JSON.stringify({
          email: person.email,
          first_name: person.firstName,
          last_name: person.lastName,
        }),
      }),
    );
    if (!isJoinLinkFor(join_url, id))
      throw new ZoomSkip("join link not for this webinar");
    return join_url;
  } catch (error) {
    console.warn("[masterclass] zoom-skip", {
      reason:
        error instanceof ZoomSkip
          ? error.message
          : error instanceof Error
            ? error.name
            : "unknown",
    });
    return null;
  }
}
