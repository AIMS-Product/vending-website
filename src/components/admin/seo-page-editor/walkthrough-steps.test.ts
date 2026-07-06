import { describe, expect, it } from "vitest";
import { nextWalkthroughStep, panelToRevealForStep } from "./walkthrough-steps";

// I1: these pure helpers are what keeps the walkthrough's render phase free of
// controller mutations. The step transition is a value computation (no side
// effects), and the panel-reveal decision is data the component acts on from a
// click handler — never from a `setActiveStep` updater.
describe("walkthrough step logic (issue I1)", () => {
  describe("nextWalkthroughStep", () => {
    it("advances 1 -> 2 -> 3", () => {
      expect(nextWalkthroughStep(1)).toBe(2);
      expect(nextWalkthroughStep(2)).toBe(3);
    });

    it("returns null on the final step so the caller ends the tour", () => {
      expect(nextWalkthroughStep(3)).toBeNull();
    });

    it("is a pure value computation with no side effects", () => {
      // Calling it repeatedly must not change its result or mutate anything.
      expect(nextWalkthroughStep(1)).toBe(nextWalkthroughStep(1));
      expect(nextWalkthroughStep(2)).toBe(nextWalkthroughStep(2));
    });
  });

  describe("panelToRevealForStep", () => {
    it("maps each step to the panel it highlights", () => {
      expect(panelToRevealForStep(1)).toBe("blocks");
      expect(panelToRevealForStep(2)).toBe("seo");
    });

    it("reveals nothing for the AI step (the assistant is always mounted)", () => {
      expect(panelToRevealForStep(3)).toBeNull();
    });
  });
});
