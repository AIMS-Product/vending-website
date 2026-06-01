# Admin Settings Users Test Matrix

Last updated: 2026-06-01

## Current Result

The linked Supabase project is now up to date with local migrations through
`20260601100000`.

The earlier failed `super_admin` save was caused by the remote schema still
using the old `app_user_emails_role_check` constraint. The admin-role migration
has now been applied, and `/admin/settings/users` reloads without the
migration-pending message.

## Browser Checks

| Check                                                                        | Route                                   | Result  | Evidence                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------- | ------- | ----------------------------------------------------------------- |
| Settings moved out of the Content nav and into the account/sign-out area     | `/admin/settings/users` desktop         | Pass    | In-app browser screenshot after refresh                           |
| Settings appears above Sign out in the mobile menu                           | `/admin/settings/users` mobile viewport | Pass    | In-app browser mobile menu screenshot                             |
| Users table does not clip columns on mobile                                  | `/admin/settings/users` mobile viewport | Pass    | `reports/admin-settings-users/settings-users-mobile.png`          |
| Role change to `super_admin` does not expose raw SQL when migration is stale | `/admin/settings/users`                 | Pass    | Browser save attempt shows migration-pending message              |
| Role change to `super_admin` persists in Supabase                            | `/admin/settings/users`                 | Not run | Requires explicit approval because it changes account permissions |
| Login route is public                                                        | `/admin/login`                          | Pass    | HTTP 200 in smoke                                                 |
| Forgot-password route is public                                              | `/admin/forgot-password`                | Pass    | HTTP 200 in smoke                                                 |
| Reset-password route is protected without recovery session                   | `/admin/reset-password`                 | Pass    | HTTP 307 to `/admin/login` in smoke                               |

## Automated Checks

| Check                         | Result                                                   |
| ----------------------------- | -------------------------------------------------------- |
| `npm run test`                | Pass, 48 files and 265 tests                             |
| `npm run lint`                | Pass                                                     |
| `npm run typecheck`           | Pass                                                     |
| `git diff --check`            | Pass                                                     |
| Feature-scoped Prettier check | Pass                                                     |
| `supabase migration list`     | Pass, remote project is current through `20260601100000` |
| `supabase db push --dry-run`  | Pass, remote database is up to date                      |

## Required Post-Migration Live Checks

Run these after approval to perform live account-permission changes:

1. Promote `jamesv@aimanagingservices.com` to `super_admin` from Settings.
2. Confirm the row reloads as `Super admin`.
3. Confirm `Super admins` metric increments.
4. Confirm an audit event appears under Recent account events.
5. Demote back only if that is the intended final role.
6. Verify a regular `admin` account can view Settings but cannot invite, role-change, resend, or remove users.
7. Verify `Remove` blocks deleting/demoting the last `super_admin`.
