/**
 * Belt and braces on the one thing the bot must never do: state a price.
 *
 * Layer 1 removed the figure from the prompt (site-knowledge.ts PROGRAM_FACTS
 * carried "$1,500-$5,000 a month in revenue per member", and cost-labelled
 * case-study stats are now filtered out of the index). Layer 2 is the absolute
 * PRICING rule in the system prompt. This is layer 3: it reads what the model
 * actually said and tells us when the first two failed.
 *
 * It never blocks or edits a reply. A model that has already streamed a wrong
 * number to a visitor cannot be un-streamed, and holding the stream to run a
 * check would make every reply slower for every visitor to catch a case that
 * should now be rare. So this only ever observes: it logs and flags the
 * conversation for review, which is what turns a silent recurrence into
 * something the team sees on /admin/chatbot/conversations.
 *
 * Client-safe on purpose (no server-only import) so it can be unit tested
 * and reused from either side later.
 */

/**
 * A currency amount in any of the shapes a model writes them: $1,500, $1.5k,
 * $10K, 1500 dollars, USD 2000. Deliberately does NOT match a bare number
 * ("about 2000") because the false-positive rate on years, machine counts and
 * location counts would drown the signal.
 */
const AMOUNT_PATTERN =
  /(?:\$\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?)|(?:\b\d[\d,]*(?:\.\d+)?\s?[kKmM]?\s?(?:dollars|usd)\b)|(?:\busd\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?)/gi;

/**
 * Words that make a nearby amount a statement about what someone PAYS.
 * "start" and "startup" are in here because "spend X to get started" is the
 * exact sentence that shipped to a real lead.
 */
const COST_CONTEXT_PATTERN =
  /\b(cost|costs|costing|price|prices|priced|pricing|invest|investment|investing|spend|spends|spent|spending|pay|pays|paid|paying|afford|affordable|upfront|up-front|budget|capital|fee|fees|deposit|financ\w*|expense|expenses|outlay|ticket|tuition|enrol\w*|start|started|starting|startup|start-up|get\s+going|buy\s?-?in)\b/i;

/**
 * Words that make a nearby amount a statement about what someone EARNED.
 * Member results are the whole proof engine of this chat and they are full of
 * legitimate dollar figures, so an amount that reads as revenue is not a price
 * leak. Checked before the cost context, and it wins: "Shan does $25K/mo since
 * he started" contains "started" and is plainly not a price.
 */
const REVENUE_CONTEXT_PATTERN =
  /(?:\/\s?(?:mo|month|yr|year)\b)|(?:\b(?:a|per)\s+(?:month|year|week|day)\b)|(?:\bmonthly\b)|(?:\bannual\w*\b)|(?:\bin\s+(?:sales|revenue|profit)\b)|(?:\b(?:revenue|sales|profit|margin|earn\w*|mak(?:e|es|ing)|made|pull\w*|gross\w*|nets?|netting|brings?|bringing|generat\w*|does|doing|did)\b)/i;

/** How far either side of the amount to read for context. */
const CONTEXT_RADIUS = 140;

export type PriceLeak = {
  /** The amount as the model wrote it, e.g. "$1,500". */
  amount: string;
  /** The surrounding sentence fragment, for the log line and the flag note. */
  context: string;
};

/**
 * Returns the first amount in `text` that reads as a price, or null.
 *
 * Order matters: revenue framing is checked first and short-circuits, because
 * every member story in the prompt pairs a dollar figure with words like
 * "started". Without that precedence, citing a case study would flag every
 * time and the flag would stop meaning anything.
 */
export function findPriceLeak(text: string): PriceLeak | null {
  if (!text) return null;

  for (const match of text.matchAll(AMOUNT_PATTERN)) {
    const index = match.index ?? 0;
    const context = text.slice(
      Math.max(0, index - CONTEXT_RADIUS),
      Math.min(text.length, index + match[0].length + CONTEXT_RADIUS),
    );

    if (REVENUE_CONTEXT_PATTERN.test(context)) continue;
    if (!COST_CONTEXT_PATTERN.test(context)) continue;

    return { amount: match[0].trim(), context: context.trim() };
  }

  return null;
}

/**
 * Scans every assistant reply a turn produced. Returns the first leak found so
 * one flag is raised per turn rather than one per sentence.
 */
export function findPriceLeakInReplies(
  replies: readonly string[],
): PriceLeak | null {
  for (const reply of replies) {
    const leak = findPriceLeak(reply);
    if (leak) return leak;
  }
  return null;
}
