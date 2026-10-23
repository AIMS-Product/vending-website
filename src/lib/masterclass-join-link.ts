import "server-only";

import { config, publicConfig } from "@/lib/config";
import {
  readContactField,
  type CustomFieldWrite,
} from "@/lib/ghl/webinar-registration";
import { signCalendarToken } from "@/lib/masterclass-session";
import { checkPublicRateLimit } from "@/lib/public-rate-limit";
import {
  joinLinkFor,
  registerZoomRegistrant,
  roomWebinarId,
  type ZoomCredentials,
} from "@/lib/zoom/webinar-registrant";

/** GHL contact field `Zoom Url` (merge {{contact.zoom_url}}); the GHL > Zoom zap writes it too. */
export const ZOOM_URL_FIELD_ID = "xoutue68ds9zlMLTkabO";

let warnedMissing = false;

/** Anthony's Zoom S2S credentials, or null when any part is unset. */
function zoomCredentials(): ZoomCredentials | null {
  const {
    ANTHONY_ZOOM_ACCOUNT_ID,
    ANTHONY_ZOOM_CLIENT_ID,
    ANTHONY_ZOOM_CLIENT_SECRET,
  } = config;
  return ANTHONY_ZOOM_ACCOUNT_ID &&
    ANTHONY_ZOOM_CLIENT_ID &&
    ANTHONY_ZOOM_CLIENT_SECRET
    ? {
        accountId: ANTHONY_ZOOM_ACCOUNT_ID,
        clientId: ANTHONY_ZOOM_CLIENT_ID,
        clientSecret: ANTHONY_ZOOM_CLIENT_SECRET,
      }
    : null;
}

/**
 * The `beforeTrigger` hook for a site registration: after GHL saves the
 * contact, register them in Zoom and return the fields the first email merges
 * (`Zoom Url`, `Calendar Link`). Undefined when nothing is configured, so the
 * registration is exactly today's. Never throws; whatever is missing is left
 * to the zap and Zoom's own email. Spec: .claude/specs/2026-10-13-personal-zoom-link.md.
 */
export function joinLinkFields(
  email: string,
  startsAt: string,
):
  | ((
      contactId: string,
      stored: { firstName: string; lastName: string },
    ) => Promise<CustomFieldWrite[]>)
  | undefined {
  const creds = zoomCredentials();
  const calendarField = config.GHL_CALENDAR_LINK_FIELD_ID;
  if (
    (!creds || !calendarField || !config.MASTERCLASS_CAL_SECRET) &&
    !warnedMissing
  ) {
    warnedMissing = true;
    console.warn("[masterclass] personal join link partly off", {
      zoom: Boolean(creds),
      calendarLink: Boolean(calendarField && config.MASTERCLASS_CAL_SECRET),
    });
  }
  if (!creds && !calendarField) return undefined;

  return async (contactId, stored) => {
    const fields: CustomFieldWrite[] = [];
    if (creds) {
      // Zoom requires both names; without them leave registration to the zap.
      const joinUrl =
        stored.firstName && stored.lastName
          ? await registerZoomRegistrant({ email, startsAt, ...stored }, creds)
          : null;
      // The hook only runs for someone not yet tagged for this room, so any
      // link already on the contact is an earlier room's: clear it rather than
      // let the email merge it. The zap writes this room's link after the tag.
      fields.push({ id: ZOOM_URL_FIELD_ID, field_value: joinUrl ?? "" });
    }
    const token = calendarField
      ? signCalendarToken(
          contactId,
          new Date(startsAt),
          config.MASTERCLASS_CAL_SECRET,
        )
      : null;
    if (calendarField && token) {
      fields.push({
        id: calendarField,
        field_value: `${publicConfig.siteUrl}/masterclass/cal/${token}`,
      });
    }
    return fields;
  };
}

/** The zap can still be writing the link a few seconds after sign-up. */
export const JOIN_RETRY_MS = 3000;

/**
 * This room's personal Zoom join link for the contact, read from GHL at tap
 * time (calendar route, wallet Join), or null. Never throws.
 */
export async function readJoinUrl(
  contactId: string,
  startsAt: string,
  action: "masterclass_cal" | "masterclass_join",
): Promise<string | null> {
  const creds = zoomCredentials();
  if (!config.GHL_WRITE_TOKEN || !creds) return null;
  // Over budget, or the limiter is down: the generic event, no GHL read.
  const allowed = await checkPublicRateLimit(
    action,
    { ip: null, email: `contact:${contactId}` },
    { failClosed: true },
  );
  if (!allowed) return null;
  // Only this room's link: a returning contact's field can still hold last week's.
  const webinarId = await roomWebinarId(startsAt, creds);
  if (webinarId === null) return null;
  const read = async () =>
    joinLinkFor(
      await readContactField(contactId, ZOOM_URL_FIELD_ID, {
        token: config.GHL_WRITE_TOKEN ?? "",
      }),
      webinarId,
    );
  try {
    return (
      (await read()) ??
      (await new Promise((resolve) => setTimeout(resolve, JOIN_RETRY_MS)).then(
        read,
      ))
    );
  } catch (error) {
    // Degrades to the generic fallback (calendar event, or the confirmed page).
    console.error("[masterclass] join link read failed", {
      action,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}
