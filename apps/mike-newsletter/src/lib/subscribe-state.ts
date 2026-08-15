/**
 * The action's return shape lives here rather than beside the action itself:
 * a `"use server"` module may only export async functions, so a plain object
 * like `initialSubscribeState` exported from `app/actions.ts` fails the
 * module at import time (500 on every submit, no error in the UI).
 */
export type SubscribeState =
  | { status: "idle" }
  | { status: "success"; email: string }
  | { status: "error"; message: string };

export const initialSubscribeState: SubscribeState = { status: "idle" };

/**
 * Fired on `window` the moment a signup succeeds. The sticky mobile bar
 * listens for it so it stops asking someone who has already said yes.
 */
export const SUBSCRIBED_EVENT = "ec:subscribed";
