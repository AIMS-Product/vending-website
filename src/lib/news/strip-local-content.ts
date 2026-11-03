// Scraped articles carry AI-written FAQs aimed at one city, full of local
// sellers, lenders, and fees nobody has verified. Questions about the place go
// whole; elsewhere only the sentence naming it goes.
const LOCAL_QUESTION = /Eugene|Oregon|Lane County/;
const LOCAL_SENTENCE =
  /Eugene|Lane County|University of Oregon|Willamette|SELCO|EWEB|PeaceHealth|Autzen/;

const FAQ_HEADING = /^(#{1,6} )?Frequently Asked Questions$/i;

function isHeading(paragraph: string) {
  return /^#{1,6} /.test(paragraph);
}

function isQuestion(paragraph: string) {
  return /^(#{1,6} )?[^\n]*\?$/.test(paragraph.trim());
}

function withoutLocalSentences(paragraph: string) {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !LOCAL_SENTENCE.test(sentence))
    .join(" ")
    .trim();
}

export function stripLocalContent(body: string): string {
  const out: string[] = [];
  const paragraphs = body.split(/\n{2,}/);

  for (let i = 0; i < paragraphs.length; i += 1) {
    const paragraph = paragraphs[i];

    if (isQuestion(paragraph) && LOCAL_QUESTION.test(paragraph)) {
      // Drop the answer too: everything up to the next heading or question.
      while (
        i + 1 < paragraphs.length &&
        !isHeading(paragraphs[i + 1]) &&
        !isQuestion(paragraphs[i + 1])
      ) {
        i += 1;
      }
      continue;
    }

    if (isHeading(paragraph) || !LOCAL_SENTENCE.test(paragraph)) {
      out.push(paragraph);
      continue;
    }

    const kept = withoutLocalSentences(paragraph);
    if (kept) {
      out.push(kept);
    } else if (out.length > 0 && isQuestion(out[out.length - 1])) {
      // Its whole answer was local, so the question has nothing left to say.
      out.pop();
    }
  }

  // A FAQ whose questions were all local leaves a heading with nothing under it.
  return out
    .filter((paragraph, index) => {
      if (!FAQ_HEADING.test(paragraph)) return true;
      const next = out[index + 1];
      return next !== undefined && /^### |\?$/.test(next.trim());
    })
    .join("\n\n");
}
