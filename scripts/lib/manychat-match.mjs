/**
 * Evidence rules for joining a Close lead to a ManyChat contact.
 *
 * ManyChat's Instagram contacts carry no email or phone, and Close carries no
 * Instagram handle, so no single field proves two records are one person.
 * Each candidate is scored on independent signals; a match is CONFIRMED only
 * when two of them agree, the contact existed before the booking, and one of
 * them puts the contact in the booking conversation (link, tag, or active).
 *
 *   link    the lead's own Calendly booking carries this contact's ManyChat
 *           id in utm_campaign (setter links append {{user_id}})
 *   name    the ManyChat name has the lead's first and last name
 *   handle  the IG handle and the lead's email local part share a 5+ char run
 *           of letters/digits, or the handle holds first+last name
 *   tag     the contact carries a booking tag (Call Booked / booking link sent)
 *   active  (gate only, not counted as a signal) the contact's last ManyChat
 *           interaction is no earlier than 21 days before the booking
 *
 * Measured 2026-10-08 against 58 leads whose booking link carried a personal
 * ManyChat id: name+handle was right 10/10 when active and wrong 2/2 when not;
 * name+active alone was wrong 1 in 6, so activity gates but never confirms.
 *
 * One signal alone is "single" and is never counted as confirmed: a setter can
 * forward a link, and two people can share a name.
 */

export const BOOKING_TAG = /call booked|booking link/i;

// A numeric utm_campaign is a ManyChat id only on DM links; on Google it is a campaign id.
const DM_LINK_SOURCE = /instagram|facebook|^ig$|manychat/i;

/**
 * Email -> ManyChat ids from setter booking links. An id booked by more than
 * one email is dropped: it is a link a setter reused for many people (one Will
 * Graves link carried the same id for 12 different invitees), so it says
 * nothing about who any of them is.
 */
export function personalLinkIds(bookings) {
  const emailsById = new Map();
  for (const b of bookings) {
    if (!/^\d{6,}$/.test(b.utm_campaign ?? "") || !DM_LINK_SOURCE.test(b.utm_source ?? "")) continue;
    const email = String(b.invitee_email ?? "").toLowerCase();
    if (!email) continue;
    if (!emailsById.has(b.utm_campaign)) emailsById.set(b.utm_campaign, new Set());
    emailsById.get(b.utm_campaign).add(email);
  }
  const byEmail = new Map();
  for (const [id, emails] of emailsById) {
    if (emails.size !== 1) continue;
    const [email] = emails;
    if (!byEmail.has(email)) byEmail.set(email, new Set());
    byEmail.get(email).add(id);
  }
  return byEmail;
}

/** Lowercase, strip accents and anything but letters, digits and spaces. */
export function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const alnum = (value) => normalizeName(value).replace(/ /g, "");

/** Shared run of at least `min` characters between two strings. */
function sharesRun(a, b, min = 5) {
  if (a.length < min || b.length < min) return false;
  for (let i = 0; i + min <= a.length; i++) {
    if (b.includes(a.slice(i, i + min))) return true;
  }
  return false;
}

export function nameSignal(leadName, contactName) {
  const lead = normalizeName(leadName).split(" ").filter(Boolean);
  const contact = new Set(normalizeName(contactName).split(" ").filter(Boolean));
  if (lead.length < 2) return false;
  return contact.has(lead[0]) && contact.has(lead.at(-1));
}

export function handleSignal(lead, contact) {
  const handle = alnum(contact.ig_username);
  if (!handle) return false;
  const local = alnum(String(lead.email ?? "").split("@")[0]);
  if (sharesRun(local, handle)) return true;
  const parts = normalizeName(lead.display_name).split(" ").filter(Boolean);
  return parts.length >= 2 && handle.includes(`${parts[0]}${parts.at(-1)}`);
}

const ACTIVE_WINDOW_DAYS = 21;

/** Last ManyChat interaction on or after 21 days before the booking. */
export function isActiveNear(contact, bookedOn) {
  const last = String(contact.ig_last_interaction || contact.last_interaction || "").slice(0, 10);
  if (!last || !bookedOn) return false;
  const cutoff = new Date(Date.parse(`${bookedOn}T00:00:00Z`) - ACTIVE_WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
  return last >= cutoff;
}

/**
 * Scores one candidate. `bookedOn` is YYYY-MM-DD (the lead's first booked
 * date); a contact subscribed after it cannot have been the DM that earned it.
 */
export function scoreCandidate(lead, contact, { linkedIds, bookedOn }) {
  const signals = [];
  if (linkedIds.has(String(contact.id))) signals.push("link");
  if (nameSignal(lead.display_name, contact.name)) signals.push("name");
  if (handleSignal(lead, contact)) signals.push("handle");
  if ((contact.tags ?? []).some((t) => BOOKING_TAG.test(t.name ?? ""))) signals.push("tag");
  const subscribedOn = String(contact.subscribed ?? "").slice(0, 10);
  const before = Boolean(subscribedOn) && (!bookedOn || subscribedOn <= bookedOn);
  const active = isActiveNear(contact, bookedOn);
  const inConversation = signals.includes("link") || signals.includes("tag") || active;
  const level = !before
    ? "after"
    : signals.length >= 2 && inConversation
      ? "confirmed"
      : signals.length >= 1
        ? "single"
        : "none";
  return { id: String(contact.id), signals, before, active, level };
}

/**
 * Picks the lead's match from all candidates (link lookups + name search).
 * Two different confirmed contacts is a conflict and matches nothing.
 */
export function pickMatch(scored) {
  const byId = new Map();
  for (const s of scored) if (!byId.has(s.id)) byId.set(s.id, s);
  const unique = [...byId.values()];
  const confirmed = unique.filter((s) => s.level === "confirmed");
  if (confirmed.length > 1) return { level: "conflict", match: null, candidates: unique };
  if (confirmed.length === 1) return { level: "confirmed", match: confirmed[0], candidates: unique };
  const single = unique.filter((s) => s.level === "single");
  if (single.length === 1) return { level: "single", match: single[0], candidates: unique };
  if (single.length > 1) return { level: "ambiguous", match: null, candidates: unique };
  return { level: "none", match: null, candidates: unique };
}
