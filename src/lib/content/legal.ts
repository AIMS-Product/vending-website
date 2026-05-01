export type LegalListItem = {
  /** Optional emboldened lead-in (e.g. "Access:" before the body of a list item). */
  lead?: string;
  text: string;
};

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "p-strong"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: ReadonlyArray<LegalListItem> };

export type LegalSection = {
  /** Section number as displayed (e.g. "1", "10"). Subsections inside use h3 blocks. */
  number: string;
  heading: string;
  blocks: ReadonlyArray<LegalBlock>;
};

export type LegalDoc = {
  title: string;
  /** Human-readable date string, e.g. "January 26, 2026". */
  lastUpdated: string;
  sections: ReadonlyArray<LegalSection>;
};
