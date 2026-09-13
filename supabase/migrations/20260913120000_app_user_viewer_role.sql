-- Read-only `viewer` role for the admin backend.
--
-- Why this exists: the request was a shared "continue as guest" password so
-- more people could see reporting. The admin holds 960+ leads with names,
-- emails and phone numbers, chatbot transcripts in which people discuss their
-- finances, and live edit access to the production site. A shared password
-- destroys the audit trail and survives offboarding. A `viewer` role with
-- individual logins gives the same reporting access without either cost.
--
-- `role` is plain text with a CHECK constraint, and the list is repeated in
-- FOUR places: app_user_emails, app_users, and both role columns on the
-- app_user_events audit table. Widening only the first two would let an
-- invite succeed and then fail when the audit row is written, leaving the
-- role changed with no record of who changed it. All four move together.
--
-- Existing rows are not touched. Every current admin and super_admin keeps
-- exactly the access they have today; this migration only widens what is
-- allowed, so it cannot lock anyone out.

alter table public.app_user_emails
  drop constraint if exists app_user_emails_role_check;

alter table public.app_user_emails
  add constraint app_user_emails_role_check
  check (role in ('viewer', 'admin', 'super_admin'));

alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check
  check (role in ('viewer', 'admin', 'super_admin'));

alter table public.app_user_events
  drop constraint if exists app_user_events_old_role_check;

alter table public.app_user_events
  add constraint app_user_events_old_role_check
  check (old_role is null or old_role in ('viewer', 'admin', 'super_admin'));

alter table public.app_user_events
  drop constraint if exists app_user_events_new_role_check;

alter table public.app_user_events
  add constraint app_user_events_new_role_check
  check (new_role is null or new_role in ('viewer', 'admin', 'super_admin'));

-- `is_app_admin()` deliberately keeps its 'admin' / 'super_admin' definition.
-- Every RLS policy in the schema is written against it, so adding 'viewer'
-- here would hand viewers write access to content tables in one line. The
-- four reporting pages a viewer may open read through the service-role
-- client on the server, which does not consult these policies at all.
