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
  /(?:\$\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM]\b)?)|(?:\b\d[\d,]*(?:\.\d+)?(?:\s?[kKmM])?\s?(?:dollars|usd)\b)|(?:\busd\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM]\b)?)|(?:\b\d{1,4}(?:\.\d+)?\s?[kK]\b)/gi;

/**
 * Words that make a nearby amount a statement about what someone PAYS.
 * "start" and "startup" are in here because "spend X to get started" is the
 * exact sentence that shipped to a real lead.
 */
const COST_CONTEXT_PATTERN =
  /\b(cost|costs|costing|price|prices|priced|pricing|invest|investment|investing|spend|spends|spent|spending|pay|pays|paid|paying|afford|affordable|upfront|up-front|budget|capital|fee|fees|deposit|financ\w*|expense|expenses|outlay|ticket|tuition|enrol\w*|start|started|starting|startup|start-up|get\s+going|buy\s?-?in|runs?\s+(?:about|around|roughly)|all\s+in|per\s+machine|out\s+of\s+pocket)\b/i;

/**
 * Cost words that are NOT also normal member-story vocabulary.
 *
 * "started" is in COST_CONTEXT_PATTERN because "spend X to get started" is the
 * sentence that shipped, but it is also in half the case studies ("Shan
 * started with no experience"). These are the words that only ever appear
 * around money someone PAYS, and they are strong enough to beat an ambiguous
 * time-period marker. See the ordering note on findPriceLeak.
 */
const STRONG_COST_PATTERN =
  /\b(cost|costs|costing|price|prices|priced|pricing|invest|investment|investing|spend|spends|spent|spending|afford|affordable|upfront|up-front|budget|fee|fees|deposit|financ\w*|expense|expenses|outlay|tuition|out\s+of\s+pocket|per\s+machine|all\s+in|runs?\s+(?:about|around|roughly))\b/i;

/**
 * Words that make a nearby amount a statement about what someone EARNED.
 * Member results are the whole proof engine of this chat and they are full of
 * legitimate dollar figures, so an amount that reads as revenue is not a price
 * leak. Checked before the cost context, and it wins: "Shan does $25K/mo since
 * he started" contains "started" and is plainly not a price.
 */
const EARNINGS_WORD_PATTERN =
  /(?:\bin\s+(?:sales|revenue|profit)\b)|(?:\b(?:revenue|sales|profit|margin|income|earn\w*|mak(?:e|es|ing)|made|pull\w*|gross\w*|nets?|netting|brings?|bringing|generat\w*|does|doing|did)\b)/i;

/**
 * A recurring-period marker, which on its own says nothing about direction.
 * "$4K a month" is Mallorie's income; "$2,500 a month to operate" is a cost.
 * Treating these as proof of revenue is what made a recurring cost invisible,
 * so they now only veto when no STRONG cost word is present.
 */
const PERIOD_MARKER_PATTERN =
  /(?:\/\s?(?:mo|month|yr|year)\b)|(?:\b(?:a|per)\s+(?:month|year|week|day)\b)|(?:\bmonthly\b)|(?:\bannual\w*\b)/i;

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
 * Order matters: earnings framing is checked first and short-circuits, because
 * every member story in the prompt pairs a dollar figure with words like
 * "started". Without that precedence, citing a case study would flag every
 * time and the flag would stop meaning anything.
 *
 * Recall is deliberately imperfect. A regex cannot read "it runs about that
 * much to operate" as a price, and chasing the last few shapes would start
 * flagging real member results, which is the failure that makes a monitor
 * worthless. Layers 1 and 2 (the figure removed from the prompt, and the
 * absolute PRICING rule) are the prevention; this exists so a recurrence is
 * SEEN rather than silent.
 */
export function findPriceLeak(text: string): PriceLeak | null {
  if (!text) return null;

  for (const match of text.matchAll(AMOUNT_PATTERN)) {
    const index = match.index ?? 0;
    const context = text.slice(
      Math.max(0, index - CONTEXT_RADIUS),
      Math.min(text.length, index + match[0].length + CONTEXT_RADIUS),
    );

    // An unambiguous earnings word always wins: member results are the proof
    // engine of this chat and are full of legitimate dollar figures.
    if (EARNINGS_WORD_PATTERN.test(context)) continue;

    // A bare period marker only wins when nothing strongly says "cost". That
    // asymmetry is the whole point: "$4K a month" with no cost word is income,
    // "$2,500 a month" next to "costs" is a price.
    const strongCost = STRONG_COST_PATTERN.test(context);
    if (!strongCost && PERIOD_MARKER_PATTERN.test(context)) continue;

    if (!strongCost && !COST_CONTEXT_PATTERN.test(context)) continue;

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
