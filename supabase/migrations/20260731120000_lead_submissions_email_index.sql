-- Index the plain `email` column on lead_submissions.
--
-- The table already carries `lead_submissions_email_lower_idx` on
-- `lower(email)`, but every caller filters the column directly:
--
--   qualification-intake.ts  findLatestLeadByEmail   .eq("email", email)
--   calendly-bookings.ts     recordCalendlyBooking   .eq("email", email)
--
-- Postgres only uses an expression index when the query repeats that exact
-- expression, so `email = $1` cannot use the `lower(email)` one and falls back
-- to a sequential scan. That scan runs on the site's primary conversion action
-- (every qualification form submit) and on every inbound Calendly booking
-- webhook, against a table that grows without bound.
--
-- Adding the plain-column index rather than rewriting the callers keeps the
-- existing case-insensitive lookups working unchanged; both indexes are small
-- and serve different query shapes.

create index if not exists lead_submissions_email_idx
on public.lead_submissions (email);
