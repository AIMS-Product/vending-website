import "server-only";

import { resolveCloseLeadId } from "@/lib/chatbot/close-note";
import { createCloseClient, type CloseClient } from "@/lib/close/client";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Asked before EVERY agent email: has the team already got this lead?
 *
 * A setter may have called, texted and booked them since the chat. Stop for
 * good when Close shows any of: an opportunity, a filled "booked" date field,
 * a meeting, or a person calling / texting / emailing them in the last 72h.
 * Close unreachable = stop (fail closed): a missed follow-up costs less than
 * emailing someone a setter is already working.
 */
export type CloseGateResult =
  | { send: true; leadId: string | null }
  | { send: false; reason: string };

const HUMAN_TOUCH_HOURS = 72;
const HUMAN_TYPES = new Set(["Call", "SMS", "Email", "Meeting"]);

type Deps = {
  close?: Pick<
    CloseClient,
    "getLead" | "listLeadActivities" | "searchContactsByEmail"
  >;
  resolveLeadId?: (conversationId: string) => Promise<string | null>;
  now?: () => Date;
};

export async function checkCloseBeforeEmail(
  input: { conversationId: string; email: string },
  deps: Deps = {},
): Promise<CloseGateResult> {
  try {
    const close =
      deps.close ??
      createCloseClient({
        apiKey: config.CLOSE_API_KEY,
        baseUrl: config.CLOSE_API_BASE_URL,
      });
    const resolve =
      deps.resolveLeadId ??
      ((id: string) => resolveCloseLeadId(createAdminClient(), id));

    let leadId = await resolve(input.conversationId);
    if (!leadId) {
      const found = await close.searchContactsByEmail(input.email);
      const leadIds = [...new Set(found.data.map((c) => c.lead_id))];
      if (leadIds.length > 1) {
        return { send: false, reason: "several Close leads share this email" };
      }
      leadId = leadIds[0] ?? null;
    }
    // No Close lead yet: nobody on the team can have worked them.
    if (!leadId) return { send: true, leadId: null };

    const lead = await close.getLead(leadId);
    if (!lead) return { send: true, leadId: null };
    if ((lead.opportunities ?? []).length > 0) {
      return { send: false, reason: "lead has an opportunity in Close" };
    }
    const bookedField = Object.entries(lead.custom ?? {}).find(
      ([key, value]) => /booked/i.test(key) && value != null && value !== "",
    );
    if (bookedField) {
      return { send: false, reason: `Close "${bookedField[0]}" is set` };
    }

    const now = (deps.now ?? (() => new Date()))();
    const since = now.getTime() - HUMAN_TOUCH_HOURS * 3_600_000;
    const activities = (await close.listLeadActivities(leadId, 50)).data ?? [];
    const touch = activities.find((a) => {
      if (!a._type || !HUMAN_TYPES.has(a._type)) return false;
      if (a._type === "Meeting") return true;
      const at = a.date_created ? Date.parse(a.date_created) : NaN;
      return Boolean(a.user_name) && Number.isFinite(at) && at >= since;
    });
    if (touch) {
      return {
        send: false,
        reason:
          touch._type === "Meeting"
            ? "lead has a meeting in Close"
            : `${touch.user_name} logged a ${touch._type} in the last ${HUMAN_TOUCH_HOURS}h`,
      };
    }
    return { send: true, leadId };
  } catch (error) {
    console.warn("chatbot email agent: Close check failed, not sending", {
      conversationId: input.conversationId,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { send: false, reason: "Close could not be checked" };
  }
}
