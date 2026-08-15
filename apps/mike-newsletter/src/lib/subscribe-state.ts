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
