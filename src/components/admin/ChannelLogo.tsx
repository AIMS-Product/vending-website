/**
 * The mark for one reporting row, so a channel is found by shape and colour
 * instead of by reading eighteen rows of similar text.
 *
 * Brand colour is the whole point here and is the one place this admin uses it:
 * scanning for YouTube's red is faster than reading "YouTube", which is what a
 * table this wide needs. Anything we own (the site, the chatbot, a form) gets a
 * neutral glyph so first-party rows stay visually distinct from paid channels.
 *
 * Matched on the row label the report already produces, lowercased, longest key
 * first — "meta ads" must not resolve as "meta". An unknown label gets a
 * neutral dot rather than nothing, so every row still lines up.
 */

type Mark = { color: string; path: string; label: string };

// Single-path marks, drawn on a 24x24 grid.
const MARKS: Record<string, Mark> = {
  youtube: {
    color: "#FF0000",
    label: "YouTube",
    path: "M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z",
  },
  instagram: {
    color: "#E4405F",
    label: "Instagram",
    path: "M12 2.2c3.2 0 3.6 0 4.9.07 3.3.15 4.8 1.7 5 5 .06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.15 3.3-1.7 4.8-5 5-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-3.3-.15-4.8-1.7-5-5C2.05 15.6 2 15.2 2 12s0-3.6.07-4.9c.15-3.3 1.7-4.8 5-5C8.4 2.05 8.8 2.2 12 2.2Zm0 3.6a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4Zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.4-10.4a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z",
  },
  linkedin: {
    color: "#0A66C2",
    label: "LinkedIn",
    path: "M20.4 20.4h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.3V9.1h3.4v1.5h.05a3.8 3.8 0 0 1 3.4-1.9c3.6 0 4.3 2.4 4.3 5.5v6.2ZM5.3 7.5a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm1.8 12.9H3.5V9.1h3.6v11.3ZM22.2 0H1.8A1.77 1.77 0 0 0 0 1.75v20.5A1.77 1.77 0 0 0 1.8 24h20.4a1.77 1.77 0 0 0 1.8-1.75V1.75A1.77 1.77 0 0 0 22.2 0Z",
  },
  meta: {
    color: "#0866FF",
    label: "Meta",
    path: "M6.9 4.5C3.6 4.5 1.4 7.9 1.4 12c0 4.2 2.1 7.5 5.3 7.5 2.3 0 3.8-1.5 5.8-4.8l1.4-2.4c.5-.9.9-1.5 1.3-2.1.6.9 1.1 1.8 1.6 2.7l1 1.8c1.6 2.8 3 4.8 5.2 4.8 2.6 0 4-2.6 4-7.2 0-4.4-2.2-7.6-5.2-7.6-1.9 0-3.4 1.3-5.1 4l-.9 1.5c-.8-1.3-1.5-2.4-2.2-3.2-1.4-1.7-2.8-2.5-4.6-2.5Zm.5 2.6c1 0 1.9.6 2.9 1.9.5.6 1 1.4 1.6 2.4l-.9 1.4c-1.6 2.6-2.4 3.3-3.4 3.3-1.3 0-2.5-1.8-2.5-4.5 0-2.7 1.1-4.5 2.3-4.5Zm9.6 0c1.2 0 2.3 1.9 2.3 4.9 0 2.5-.6 3.9-1.8 3.9-1 0-1.8-.8-3.2-3.2l-1-1.7c1.6-2.6 2.6-3.9 3.7-3.9Z",
  },
  "meta ads": {
    color: "#0866FF",
    label: "Meta Ads",
    path: "M6.9 4.5C3.6 4.5 1.4 7.9 1.4 12c0 4.2 2.1 7.5 5.3 7.5 2.3 0 3.8-1.5 5.8-4.8l1.4-2.4c.5-.9.9-1.5 1.3-2.1.6.9 1.1 1.8 1.6 2.7l1 1.8c1.6 2.8 3 4.8 5.2 4.8 2.6 0 4-2.6 4-7.2 0-4.4-2.2-7.6-5.2-7.6-1.9 0-3.4 1.3-5.1 4l-.9 1.5c-.8-1.3-1.5-2.4-2.2-3.2-1.4-1.7-2.8-2.5-4.6-2.5Zm.5 2.6c1 0 1.9.6 2.9 1.9.5.6 1 1.4 1.6 2.4l-.9 1.4c-1.6 2.6-2.4 3.3-3.4 3.3-1.3 0-2.5-1.8-2.5-4.5 0-2.7 1.1-4.5 2.3-4.5Zm9.6 0c1.2 0 2.3 1.9 2.3 4.9 0 2.5-.6 3.9-1.8 3.9-1 0-1.8-.8-3.2-3.2l-1-1.7c1.6-2.6 2.6-3.9 3.7-3.9Z",
  },
  "google ads": {
    color: "#4285F4",
    label: "Google Ads",
    path: "M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5 0-.7-.06-1.4-.2-2.1H12Zm-7.3 4.3-.7.6-2.6 2A12 12 0 0 0 12 24c3.2 0 6-1.1 8-2.9l-3.3-2.6a7.2 7.2 0 0 1-10.7-3.8Zm-3.3-7A11.9 11.9 0 0 0 0 12c0 1.9.5 3.7 1.3 5.3l3.4-2.6a7.1 7.1 0 0 1 0-4.6L1.4 7.5Zm10.6-2.9c1.8 0 3.4.6 4.6 1.8l2.9-2.9A12 12 0 0 0 1.4 7.5l3.3 2.6A7.2 7.2 0 0 1 12 4.6Z",
  },
  google: {
    color: "#4285F4",
    label: "Google",
    path: "M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5 0-.7-.06-1.4-.2-2.1H12Zm-7.3 4.3-.7.6-2.6 2A12 12 0 0 0 12 24c3.2 0 6-1.1 8-2.9l-3.3-2.6a7.2 7.2 0 0 1-10.7-3.8Zm-3.3-7A11.9 11.9 0 0 0 0 12c0 1.9.5 3.7 1.3 5.3l3.4-2.6a7.1 7.1 0 0 1 0-4.6L1.4 7.5Zm10.6-2.9c1.8 0 3.4.6 4.6 1.8l2.9-2.9A12 12 0 0 0 1.4 7.5l3.3 2.6A7.2 7.2 0 0 1 12 4.6Z",
  },
  tiktok: {
    color: "#111111",
    label: "TikTok",
    path: "M16.6 0h-3.3v13.4a3 3 0 1 1-3-3c.2 0 .3 0 .5.04V7.1a6.4 6.4 0 1 0 5.8 6.3V6.6a7.6 7.6 0 0 0 4.4 1.4V4.7a4.4 4.4 0 0 1-4.4-4.7Z",
  },
  trustpilot: {
    color: "#00B67A",
    label: "Trustpilot",
    path: "M12 1.6 15 9h7.7l-6.3 4.6 2.4 7.4-6.8-4.6-6.8 4.6 2.4-7.4L1.3 9H9L12 1.6Z",
  },
  braze: {
    color: "#FF7759",
    label: "Braze",
    path: "M12 2c1.9 3.4 3.4 5.2 5.6 6.8C20 10.6 21 12 21 14.3A7 7 0 0 1 12 21a7 7 0 0 1-9-6.7c0-2.3 1-3.7 3.4-5.5C8.6 7.2 10.1 5.4 12 2Zm0 5.6c-1.1 1.7-2.1 2.8-3.5 3.9-1.5 1.1-2 1.8-2 2.8a5 5 0 0 0 11 0c0-1-.5-1.7-2-2.8-1.4-1.1-2.4-2.2-3.5-3.9Z",
  },
};

/** Anything we own. Neutral on purpose: these are not brands. */
const OWNED: Record<string, string> = {
  website:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.9a15 15 0 0 0-1.3-3.4A8 8 0 0 1 18.9 8ZM12 4.2c.7 1 1.3 2.2 1.7 3.8h-3.4c.4-1.6 1-2.8 1.7-3.8ZM4.3 14a8 8 0 0 1 0-4h3.3a17 17 0 0 0 0 4H4.3Zm.8 2h2.9c.3 1.3.8 2.4 1.3 3.4A8 8 0 0 1 5.1 16Zm2.9-8H5.1a8 8 0 0 1 4.2-3.4A15 15 0 0 0 8 8Zm4 11.8c-.7-1-1.3-2.2-1.7-3.8h3.4c-.4 1.6-1 2.8-1.7 3.8ZM14.1 14H9.9a15 15 0 0 1 0-4h4.2a15 15 0 0 1 0 4Zm.6 5.4c.5-1 1-2.1 1.3-3.4h2.9a8 8 0 0 1-4.2 3.4ZM16.4 14a17 17 0 0 0 0-4h3.3a8 8 0 0 1 0 4h-3.3Z",
  chatbot:
    "M12 3c5 0 9 3.4 9 7.5S17 18 12 18c-.9 0-1.8-.1-2.6-.3L4 20l1.3-3.6C3.9 15 3 12.9 3 10.5 3 6.4 7 3 12 3Zm-3.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
  form: "M6 2h8l6 6v14H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 2v5h5l-5-5Zm-4 9h8v2H9v-2Zm0 4h8v2H9v-2Z",
  email:
    "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.6 2L12 12.3 19.4 7H4.6Z",
  all: "M4 13h6v7H4v-7Zm0-9h6v7H4V4Zm10 0h6v16h-6V4Z",
};

/**
 * Longest key first so a more specific label wins: "meta ads" before "meta",
 * "google ads" before "google".
 */
const BRAND_KEYS = Object.keys(MARKS).sort((a, b) => b.length - a.length);

const OWNED_MATCHERS: Array<[RegExp, string]> = [
  [/^all channels/, "all"],
  [/chatbot|chat\b/, "chatbot"],
  [/form|ghl|typeform/, "form"],
  [/email|braze|newsletter|webinar/, "email"],
  [/website|organic|direct|seo|landing/, "website"],
];

export function ChannelLogo({ label }: { label: string }) {
  const key = label.trim().toLowerCase();

  const brand = BRAND_KEYS.find((name) => key.includes(name));
  if (brand) {
    const mark = MARKS[brand];
    return <Glyph path={mark.path} color={mark.color} title={mark.label} />;
  }

  const owned = OWNED_MATCHERS.find(([pattern]) => pattern.test(key));
  if (owned) {
    return (
      <Glyph path={OWNED[owned[1]]} color="currentColor" title={label} muted />
    );
  }

  // No mark, but still an aligned slot: a ragged first column is harder to
  // scan than a missing logo.
  return (
    <span
      aria-hidden="true"
      className="bg-ui-line-strong inline-block size-2 shrink-0 rounded-full"
      style={{ margin: "0.4rem" }}
    />
  );
}

function Glyph({
  path,
  color,
  title,
  muted,
}: {
  path: string;
  color: string;
  title: string;
  muted?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 shrink-0 ${muted ? "text-ui-text-subtle" : ""}`}
      fill={color}
      role="img"
      aria-label={title}
    >
      <path d={path} />
    </svg>
  );
}
