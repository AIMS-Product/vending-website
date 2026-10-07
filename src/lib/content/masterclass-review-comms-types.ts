/** Shapes for the team briefing's "every message" and launch checklist sections. */

export type CommsPhase =
  | "register"
  | "before"
  | "dayof"
  | "attended"
  | "missed"
  | "booked";

export type CommsChannel = "sms" | "email" | "voice" | "zoom";

/** Who fixes a flagged message or owns a checklist line. */
export type Owner =
  | "Adam"
  | "Ivan"
  | "Kody"
  | "Anthony"
  | "Mike"
  | "Liana"
  | "Yvonne"
  | "Pearl"
  | "Team"
  | "Site (done)";

export type CommsFlag = {
  /** What is wrong, in one sentence a non-technical reader understands. */
  issue: string;
  /** What it should be instead. */
  fix: string;
  owner: Owner;
  /** Plain date, e.g. "Mon Oct 5". */
  due: string;
};

export type CommsMessage = {
  /** Stable id from the comms map: S1..S19, E1..E27, V1, Z1. */
  id: string;
  phase: CommsPhase;
  /** When it arrives, relative and readable: "6 seconds after signing up", "24 hours before". */
  when: string;
  channel: CommsChannel;
  /** Shown sender, e.g. "Anthony (Vendingpreneurs)". */
  from: string;
  /** Email subject; omitted for SMS. */
  subject?: string;
  /**
   * The message as sent, verbatim. `{first}` = first name, `{zoom link}` = the
   * person's own Zoom link, other {placeholders} named in plain words.
   */
  body: string;
  /** False when only a summary is known (body not captured). */
  verbatim: boolean;
  /** Where the links in it go, e.g. "Replay page (GHL)". */
  links?: readonly string[];
  flag?: CommsFlag;
};

export type SwapRow = {
  /** The step of the journey, e.g. "Registration page". */
  step: string;
  /** Today (GHL). */
  today: string;
  /** After the swap (our site). */
  after: string;
  /** What must change for the swap, and by whom. */
  change: string;
  owner: Owner;
};

export type ChecklistItem = {
  item: string;
  owner: Owner;
  due: string;
  status: "done" | "open" | "decision";
  /** One line of evidence or context. */
  note?: string;
};
