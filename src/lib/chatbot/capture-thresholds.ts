import type { ChatbotCaptureAggressiveness } from "@/lib/chatbot/config";

/**
 * How many assistant replies happen before the on-intent inline capture card
 * is offered. eager=after the 1st reply, balanced=after the 2nd (today's
 * behavior), relaxed=after the 3rd. Shared by ChatWidget's
 * maybeOfferInlineCapture so the mapping lives in one place.
 */
export function captureAggressivenessThreshold(
  aggressiveness: ChatbotCaptureAggressiveness | undefined,
): number {
  switch (aggressiveness) {
    case "eager":
      return 1;
    case "relaxed":
      return 3;
    case "balanced":
    default:
      return 2;
  }
}
