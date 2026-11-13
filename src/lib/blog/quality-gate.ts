/**
 * Blog quality gate (spec: .claude/specs/2026-11-13-blog-frame.md).
 * Pure checks on a drafted post's markdown. A draft that fails is never saved;
 * the drafter rewrites once with the failures, then gives up.
 */

export type GateInput = {
  markdown: string; // body, starting with "# H1"
  keyword: string;
  seoTitle: string;
  metaDescription: string;
  /** Everything the writer was allowed to cite. Numbers must appear here. */
  groundingText: string;
  /** Extra copy rules (label, pattern). */
  bannedCopy?: ReadonlyArray<readonly [string, RegExp]>;
};

export type GateResult = {
  ok: boolean;
  failures: string[];
  stats: {
    words: number;
    h2: number;
    h3: number;
    tables: number;
    faqQuestions: number;
    internalLinks: number;
  };
};

// Phrasing that reads as machine-written (copy-editing skill's AI tells).
const AI_TELLS: ReadonlyArray<[string, RegExp]> = [
  [
    "\"it's not X, it's Y\"",
    /\b(it'?s|this is|that'?s) not (just |only )?[^.;\n]{1,60}[,;—-]\s*(it'?s|this is|that'?s)\b/i,
  ],
  ['"in today\'s ..."', /\bin today'?s\b/i],
  ["delve", /\bdelv(e|es|ing)\b/i],
  ["unlock", /\bunlock(s|ing)?\b/i],
  ["elevate", /\belevat(e|es|ing)\b/i],
  ["landscape", /\blandscape\b/i],
  ["navigate the", /\bnavigat(e|ing) the\b/i],
  ["game-changer", /\bgame[- ]chang(er|ing)\b/i],
  ["look no further", /\blook no further\b/i],
];

const PLACEHOLDER = /VERIFY|\{\{[A-Z_]+\}\}|\bTODO\b|\[citation/;

function wordsOf(text: string) {
  return text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
}

function stripLinks(markdown: string) {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
}

/** Numbers a reader would take as facts: 2+ digits, decimals, %, $ or ranges. */
export function factualNumbers(text: string): string[] {
  const out: string[] = [];
  for (const m of stripLinks(text).matchAll(/\$?\d+(?:,\d{3})*(?:\.\d+)?%?/g)) {
    const raw = m[0];
    const n = raw.replace(/[$,%]/g, "");
    const plainSmall =
      /^\d$/.test(n) && !raw.startsWith("$") && !raw.endsWith("%");
    const year = /^20[2-3]\d$/.test(n);
    if (plainSmall || year) continue;
    out.push(raw);
  }
  return out;
}

function normalizeNumber(raw: string) {
  return raw.replace(/[$,%]/g, "");
}

// "businesses" -> "busines", "business" -> "busines", "routes" -> "route".
const stem = (w: string) => w.replace(/(s|x|ch|sh)es$/, "$1").replace(/s$/, "");
/**
 * The keyword verbatim, or a natural form that keeps every word of it
 * ("vending businesses for sale" for "vending business sale").
 */
export function hasKeyword(text: string, keyword: string) {
  const t = text.toLowerCase();
  if (t.includes(keyword.toLowerCase())) return true;
  const words = new Set(t.split(/[^a-z0-9]+/).filter(Boolean).map(stem));
  return keyword
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)
    .every((w) => words.has(stem(w)));
}

export function checkPost(input: GateInput): GateResult {
  const { markdown, keyword } = input;
  const failures: string[] = [];
  const prose = stripLinks(markdown);

  const h1 = /^# (.+)$/m.exec(markdown)?.[1] ?? "";
  const h2s = markdown.match(/^## .+$/gm) ?? [];
  const tables = markdown.match(/^\|.*\|\s*\n\|\s*:?-{3,}/gm) ?? [];
  const faqStart = markdown.search(/^## Frequently asked questions/im);
  const faqBody =
    faqStart >= 0 ? markdown.slice(faqStart).split(/\n## /)[0] : "";
  // News posts write questions as "**Question?**" (src/lib/news/structured-data.ts reads that form).
  const faqQuestions = (faqBody.match(/^(### .+\?|\*\*.+\?\*\*)\s*$/gm) ?? []).length;
  // Entity cards only: FAQ questions are H3s too, but they are not cards.
  const h3s = markdown.replace(faqBody, "").match(/^### .+$/gm) ?? [];
  const internalLinks = (markdown.match(/\]\(\/[^)]*\)/g) ?? []).length;
  const words = wordsOf(prose);
  const bodyAfterH1 = prose.slice(prose.indexOf(h1) + h1.length);
  const first100 = bodyAfterH1
    .split(/\s+/)
    .slice(0, 100)
    .join(" ")
    .toLowerCase();

  if (words < 1400 || words > 3500)
    failures.push(`length ${words} words (want 1,400-3,500)`);
  if (!h1) failures.push("no H1 (# heading)");
  if (!hasKeyword(h1, keyword)) failures.push(`H1 lacks "${keyword}"`);
  if (!hasKeyword(first100, keyword))
    failures.push(`"${keyword}" not in the first 100 words`);
  if (!hasKeyword(input.seoTitle, keyword))
    failures.push(`SEO title lacks "${keyword}"`);
  if (input.seoTitle.length > 60)
    failures.push(`SEO title ${input.seoTitle.length} chars (max 60)`);
  if (!hasKeyword(input.metaDescription, keyword)) failures.push(`meta description lacks "${keyword}"`);
  const metaLen = input.metaDescription.length;
  if (metaLen < 110 || metaLen > 155)
    failures.push(`meta description ${metaLen} chars (want 110-155)`);
  if (h2s.length < 5) failures.push(`${h2s.length} H2 sections (want 5+)`);
  if (h3s.length < 6) failures.push(`${h3s.length} H3 items (want 6+)`);
  if (tables.length < 1) failures.push("no chart table");
  if (faqQuestions < 4)
    failures.push(`${faqQuestions} FAQ questions (want 4+, as "**Question?**")`);
  if (internalLinks < 5)
    failures.push(`${internalLinks} internal links (want 5+)`);
  if (PLACEHOLDER.test(markdown))
    failures.push("placeholder or VERIFY flag left in");
  if ((markdown.match(/—/g) ?? []).length > 2)
    failures.push("more than 2 em dashes");

  for (const [label, re] of [...AI_TELLS, ...(input.bannedCopy ?? [])]) {
    if (re.test(prose)) failures.push(`banned phrasing: ${label}`);
  }

  const grounding = input.groundingText.replace(/,/g, "");
  const unsourced = [
    ...new Set(
      factualNumbers(markdown).filter(
        (raw) => !grounding.includes(normalizeNumber(raw)),
      ),
    ),
  ];
  if (unsourced.length > 0)
    failures.push(
      `numbers not in the source data: ${unsourced.slice(0, 8).join(", ")}`,
    );

  return {
    ok: failures.length === 0,
    failures,
    stats: {
      words,
      h2: h2s.length,
      h3: h3s.length,
      tables: tables.length,
      faqQuestions,
      internalLinks,
    },
  };
}
