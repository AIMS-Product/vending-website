/**
 * Two tiny synthesized cues for the chat widget: a short click when the
 * visitor sends, a softer, lower pop when Mia replies. Web Audio only, no
 * files to load. Silent on any failure (no AudioContext, autoplay policy,
 * reduced-motion preference) since a sound is never worth an error.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function blip(
  from: number,
  to: number,
  duration: number,
  gain: number,
  type: OscillatorType,
): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Audio is decorative; swallowing here is the intended behaviour.
  }
}

/** Crisp, rising click: the visitor's message left. */
export function playSendSound(): void {
  blip(900, 1400, 0.07, 0.08, "square");
}

/** Rounder, falling pop: a reply landed. */
export function playReceiveSound(): void {
  blip(600, 380, 0.13, 0.12, "sine");
}
