"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useFormStatus } from "react-dom";
import {
  changeUserRole,
  inviteUser,
  removeUserAccess,
  resendUserSetup,
  type UserSettingsActionState,
} from "@/app/admin/settings/users/actions";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import type {
  AppUserEvent,
  AppUserListItem,
  AppUserRole,
} from "@/lib/services/app-users";

const initialState: UserSettingsActionState = { status: "idle" };
const adminDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AdminUsersManager({
  users,
  events,
  currentUserEmail,
  currentUserRole,
}: {
  users: AppUserListItem[];
  events: AppUserEvent[];
  currentUserEmail: string;
  currentUserRole: AppUserRole;
}) {
  const canManageUsers = currentUserRole === "super_admin";
  const activeCount = users.filter((user) => user.status === "active").length;
  const pendingCount = users.filter(
    (user) => user.status === "pending_setup",
  ).length;
  const superAdminCount = users.filter(
    (user) => user.role === "super_admin",
  ).length;
  const adminCount = users.filter((user) => user.role === "admin").length;

  return (
    <div className="grid gap-5">
      <AdminMetricStrip>
        <AdminMetricPanel
          icon="check"
          tone="green"
          label="Active"
          value={activeCount}
          caption="signed in"
        />
        <AdminMetricPanel
          icon="pencil"
          tone="amber"
          label="Pending"
          value={pendingCount}
          caption="setup needed"
        />
        <AdminMetricPanel
          icon="crown"
          tone="purple"
          label="Super admins"
          value={superAdminCount}
          caption="account owners"
        />
        <AdminMetricPanel
          icon="shield"
          tone="blue"
          label="Admins"
          value={adminCount}
          caption="CMS access"
        />
      </AdminMetricStrip>

      {!canManageUsers ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          User management is read-only for your account. Super admins can add
          users, send password setup emails, change roles, and remove access.
        </section>
      ) : null}

      <section className={adminPanelClass}>
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="shrink-0 lg:max-w-sm">
              <h2 className="text-base font-semibold text-slate-950">
                Add user
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                New users receive a password setup email after access is added.
              </p>
            </div>
            <InviteUserForm disabled={!canManageUsers} />
          </div>
        </div>

        <UsersMobileList
          users={users}
          currentUserEmail={currentUserEmail}
          canManageUsers={canManageUsers}
        />

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold tracking-normal text-slate-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Email
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Role
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {users.length ? (
                users.map((user) => (
                  <tr key={user.email}>
                    <td className="px-4 py-2.5 font-medium text-slate-950">
                      <span className="block max-w-[18rem] truncate">
                        {user.email}
                      </span>
                      {user.email === currentUserEmail ? (
                        <span className="mt-1 block text-xs font-semibold text-[#0b63f6]">
                          You
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      {canManageUsers ? (
                        <RoleForm
                          email={user.email}
                          role={user.role}
                          saveInActions
                        />
                      ) : (
                        <span className="font-medium text-slate-700">
                          {roleLabel(user.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <AdminStatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      {canManageUsers ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <RoleFormSaveButton email={user.email} />
                          <ResendSetupForm
                            email={user.email}
                            pending={user.status === "pending_setup"}
                          />
                          <RemoveAccessForm email={user.email} />
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">
                          Super-admin only
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No admin users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={adminPanelClass}>
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-950">
            Recent account events
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Account access changes and setup emails.
          </p>
        </div>
        <div className="divide-y divide-slate-200">
          {events.length ? (
            events.map((event) => (
              <div
                key={event.id}
                className="grid gap-2 px-4 py-3 text-sm text-slate-600 lg:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">
                    {eventLabel(event.eventType)}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">{event.actorEmail}</span>{" "}
                    updated{" "}
                    <span className="font-medium">{event.targetEmail}</span>
                    {event.oldRole || event.newRole ? (
                      <>
                        {" "}
                        from {event.oldRole
                          ? roleLabel(event.oldRole)
                          : "none"}{" "}
                        to {event.newRole ? roleLabel(event.newRole) : "none"}
                      </>
                    ) : null}
                  </p>
                </div>
                <time className="text-xs font-medium text-slate-500">
                  {formatDate(event.createdAt)}
                </time>
              </div>
            ))
          ) : (
            <p className="px-4 py-7 text-sm text-slate-500">
              No account events recorded yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function UsersMobileList({
  users,
  currentUserEmail,
  canManageUsers,
}: {
  users: AppUserListItem[];
  currentUserEmail: string;
  canManageUsers: boolean;
}) {
  if (!users.length) {
    return (
      <p className="px-5 py-10 text-center text-sm text-slate-500 md:hidden">
        No admin users yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate-200 md:hidden">
      {users.map((user) => (
        <article key={user.email} className="grid gap-3 p-4">
          <div className="grid gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold break-words text-slate-950">
                  {user.email}
                </h3>
                {user.email === currentUserEmail ? (
                  <p className="mt-1 text-xs font-semibold text-[#0b63f6]">
                    You
                  </p>
                ) : null}
              </div>
              <AdminStatusBadge status={user.status} />
            </div>
            <dl className="text-sm">
              <div>
                <dt className="text-xs font-semibold tracking-normal text-slate-500 uppercase">
                  Role
                </dt>
                <dd className="mt-1 font-medium text-slate-700">
                  {roleLabel(user.role)}
                </dd>
              </div>
            </dl>
          </div>

          {canManageUsers ? (
            <div className="grid gap-2">
              <RoleForm email={user.email} role={user.role} />
              <div className="flex flex-wrap gap-1.5">
                <ResendSetupForm
                  email={user.email}
                  pending={user.status === "pending_setup"}
                />
                <RemoveAccessForm email={user.email} />
              </div>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-500">
              Super-admin only
            </span>
          )}
        </article>
      ))}
    </div>
  );
}

const inviteControlClass =
  "box-border h-11 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm leading-none text-slate-950 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-[#0b63f6] focus:ring-2 focus:ring-[#0b63f6]/15 disabled:cursor-not-allowed disabled:opacity-50";

function InviteUserForm({ disabled }: { disabled: boolean }) {
  const [state, formAction] = useActionState(inviteUser, initialState);
  return (
    <form action={formAction} className="w-full min-w-0 lg:max-w-3xl lg:flex-1">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center">
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          disabled={disabled}
          aria-label="User email"
          placeholder="admin@example.com"
          className={inviteControlClass}
        />
        <select
          id="invite-role"
          name="role"
          defaultValue="admin"
          disabled={disabled}
          aria-label="User role"
          className={inviteControlClass}
        >
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
        <SubmitButton
          disabled={disabled}
          label="Invite user"
          icon="plus"
          className="h-11 w-full whitespace-nowrap sm:w-auto"
        />
      </div>
      <ActionMessage state={state} className="mt-2" />
    </form>
  );
}

function roleFormId(email: string) {
  return `role-form-${email.replace(/[^a-z0-9]+/gi, "-")}`;
}

function RoleForm({
  email,
  role,
  saveInActions = false,
}: {
  email: string;
  role: AppUserRole;
  saveInActions?: boolean;
}) {
  const [state, formAction] = useActionState(changeUserRole, initialState);
  const roleSelect = (
    <select
      name="role"
      defaultValue={role}
      aria-label={`Role for ${email}`}
      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 shadow-sm focus:border-[#0b63f6] focus:ring-2 focus:ring-[#0b63f6]/15 focus:outline-none"
    >
      <option value="admin">Admin</option>
      <option value="super_admin">Super admin</option>
    </select>
  );

  return (
    <form id={roleFormId(email)} action={formAction} className="grid gap-1.5">
      <input type="hidden" name="email" value={email} />
      {saveInActions ? (
        roleSelect
      ) : (
        <div className="flex items-center gap-1.5">
          {roleSelect}
          <IconSubmitButton
            icon="save"
            label={`Save role for ${email}`}
            title="Save role"
          />
        </div>
      )}
      <ActionMessage state={state} />
    </form>
  );
}

function RoleFormSaveButton({ email }: { email: string }) {
  return (
    <IconSubmitButton
      form={roleFormId(email)}
      icon="save"
      label={`Save role for ${email}`}
      title="Save role"
    />
  );
}

function ResendSetupForm({
  email,
  pending,
}: {
  email: string;
  pending: boolean;
}) {
  const [state, formAction] = useActionState(resendUserSetup, initialState);
  const title = pending ? "Resend setup" : "Send reset";
  return (
    <form action={formAction} className="grid gap-1.5">
      <input type="hidden" name="email" value={email} />
      <IconSubmitButton
        icon="mail"
        label={`${title} for ${email}`}
        title={title}
      />
      <ActionMessage state={state} />
    </form>
  );
}

function RemoveAccessForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(removeUserAccess, initialState);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmOpen) cancelButtonRef.current?.focus();
  }, [confirmOpen]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setConfirmOpen(false);
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter(
      (element) =>
        !element.hasAttribute("disabled") &&
        element.getAttribute("aria-hidden") !== "true",
    );
    if (focusable.length === 0) return;

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <form action={formAction} className="grid gap-1.5">
      <input type="hidden" name="email" value={email} />
      <button
        type="button"
        aria-label={`Remove access for ${email}`}
        title="Remove access"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 text-xs font-semibold whitespace-nowrap text-red-700 shadow-sm transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:outline-none"
      >
        <span aria-hidden="true">
          <AdminIcon icon="trash" />
        </span>
        Remove access
      </button>
      {confirmOpen ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`remove-${email}`}
          onKeyDown={handleDialogKeyDown}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 py-6"
        >
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h2
              id={`remove-${email}`}
              className="text-base font-semibold text-slate-950"
            >
              Remove user access
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This removes {email} from Studio access and disables future
              sign-in until they are invited again.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={cancelButtonRef}
                type="button"
                className={adminSecondaryButtonClass}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove access
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ActionMessage state={state} />
    </form>
  );
}

function SubmitButton({
  disabled,
  label,
  icon,
  className = "",
}: {
  disabled?: boolean;
  label: string;
  icon?: "plus";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${adminPrimaryButtonClass} ${className}`.trim()}
    >
      {icon ? (
        <span aria-hidden="true">
          <AdminIcon icon={icon} />
        </span>
      ) : null}
      {pending ? "Working..." : label}
    </button>
  );
}

function IconSubmitButton({
  label,
  title,
  icon,
  tone = "default",
  form,
}: {
  label: string;
  title: string;
  icon: "mail" | "save";
  tone?: "default" | "danger";
  form?: string;
}) {
  const { pending } = useFormStatus();
  const isPending = form ? false : pending;
  const buttonLabel = isPending ? "Working..." : label;
  const visibleText = isPending ? "Working..." : title;
  return (
    <button
      type="submit"
      form={form}
      disabled={isPending}
      aria-label={buttonLabel}
      title={visibleText}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap shadow-sm transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger"
          ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-200"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0b63f6]/35"
      }`}
    >
      <span aria-hidden="true">
        <AdminIcon icon={icon} />
      </span>
      {visibleText}
    </button>
  );
}

function ActionMessage({
  state,
  className = "",
}: {
  state: UserSettingsActionState;
  className?: string;
}) {
  if (state.status === "idle") return null;
  return (
    <p
      className={`${className} text-xs font-medium ${
        state.status === "error" ? "text-red-600" : "text-emerald-700"
      }`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

function roleLabel(role: AppUserRole) {
  return role === "super_admin" ? "Super admin" : "Admin";
}

function eventLabel(eventType: string) {
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  if (!value) return "Not recorded";
  return adminDateFormatter.format(new Date(value));
}
