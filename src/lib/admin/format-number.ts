/**
 * Shared whole-number and whole-dollar formatting for the admin panels, so a
 * $1,250 cost per lead never prints as "$1250" next to a $1,250 revenue
 * figure. Display only: callers keep their own rounding rules for rates.
 */

/** "4,276". Rounds to a whole number. */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** "$1,250", and "-$500" (sign before the dollar sign) for a negative. */
export function formatUsd(value: number): string {
  const rounded = Math.round(value);
  // Math.round(-0.4) is -0, which would print as "-$0".
  const whole = Object.is(rounded, -0) ? 0 : rounded;
  const grouped = Math.abs(whole).toLocaleString("en-US");
  return whole < 0 ? `-$${grouped}` : `$${grouped}`;
}
