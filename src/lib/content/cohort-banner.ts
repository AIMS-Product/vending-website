// Site-wide "open seats" banner (Adam, 2026-09-28). The count resets to 15 on
// the 1st of each month and drops by one every other day, never below 1.
// Changing the start value or cadence is a one-line edit here.
const START_SEATS = 15;
const DAYS_PER_SEAT = 2;

export function cohortSeatsLeft(date: Date): number {
  return Math.max(
    1,
    START_SEATS - Math.floor((date.getDate() - 1) / DAYS_PER_SEAT),
  );
}

export function cohortMonth(date: Date): string {
  return date.toLocaleString("en-US", { month: "long" });
}

// UTMs land on the lead via buildLeadAttribution and show up as their own
// source row in /admin/analytics. first_* attribution keeps the original ad.
export const cohortBannerHref =
  "/contact?utm_source=website&utm_medium=banner&utm_campaign=cohort_seats";
