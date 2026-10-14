import "server-only";

import { config, publicConfig } from "@/lib/config";
import type { CustomFieldWrite } from "@/lib/ghl/webinar-registration";
import { signCalendarToken } from "@/lib/masterclass-session";
import { registerZoomRegistrant } from "@/lib/zoom/webinar-registrant";

/** GHL contact field `Zoom Url` (merge {{contact.zoom_url}}); the GHL > Zoom zap writes it too. */
export const ZOOM_URL_FIELD_ID = "xoutue68ds9zlMLTkabO";

let warnedMissing = false;

/**
 * The `beforeTrigger` hook for a site registration: after GHL saves the
 * contact, register them in Zoom and return the fields the first email merges
 * (`Zoom Url`, `Calendar Link`). Undefined when nothing is configured, so the
 * registration is exactly today's. Never throws; whatever is missing is left
 * to the zap and Zoom's own email. Spec: .claude/specs/2026-10-13-personal-zoom-link.md.
 */
export function joinLinkFields(
  person: { email: string; firstName: string; lastName: string },
  startsAt: string,
): ((contactId: string) => Promise<CustomFieldWrite[]>) | undefined {
  const {
    ANTHONY_ZOOM_ACCOUNT_ID,
    ANTHONY_ZOOM_CLIENT_ID,
    ANTHONY_ZOOM_CLIENT_SECRET,
  } = config;
  const creds =
    ANTHONY_ZOOM_ACCOUNT_ID &&
    ANTHONY_ZOOM_CLIENT_ID &&
    ANTHONY_ZOOM_CLIENT_SECRET
      ? {
          accountId: ANTHONY_ZOOM_ACCOUNT_ID,
          clientId: ANTHONY_ZOOM_CLIENT_ID,
          clientSecret: ANTHONY_ZOOM_CLIENT_SECRET,
        }
      : null;
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

  return async (contactId) => {
    const fields: CustomFieldWrite[] = [];
    const joinUrl = creds
      ? await registerZoomRegistrant({ ...person, startsAt }, creds)
      : null;
    if (joinUrl) fields.push({ id: ZOOM_URL_FIELD_ID, field_value: joinUrl });
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
