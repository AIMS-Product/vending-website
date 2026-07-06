// Pure step logic for the opt-in builder Quick Tour (BuilderEditorWalkthrough).
//
// I1: keeping the step transition and "which panel does this step highlight"
// mapping as pure functions guarantees the walkthrough never mutates the
// editor controller from inside a `setActiveStep` updater. The component calls
// `panelToRevealForStep` from click handlers only (where a controller state
// update is safe) and uses `nextWalkthroughStep` purely to compute the next
// step — so the render phase can never trigger a controller setState, which is
// what produced the "Cannot update a component (SeoPageEditorForm) while
// rendering a different component (BuilderEditorWalkthrough)" warning.

export type WalkthroughStepId = 1 | 2 | 3;

/** Which highlightable panel a step points at, or null when nothing needs revealing. */
export type WalkthroughPanel = "blocks" | "seo" | null;

/**
 * The panel a step highlights. Step 1 = blocks rail, step 2 = SEO panel,
 * step 3 = the AI assistant which is always mounted (nothing to reveal).
 */
export function panelToRevealForStep(
  step: WalkthroughStepId,
): WalkthroughPanel {
  if (step === 1) return "blocks";
  if (step === 2) return "seo";
  return null;
}

/**
 * The next step after `current`, or null on the final step (the caller ends the
 * tour instead of advancing). Pure — no side effects.
 */
export function nextWalkthroughStep(
  current: WalkthroughStepId,
): WalkthroughStepId | null {
  if (current === 1) return 2;
  if (current === 2) return 3;
  return null;
}
