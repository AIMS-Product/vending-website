import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminUsersManager } from "./AdminUsersManager";
import type { AppUserEvent, AppUserListItem } from "@/lib/services/app-users";

vi.mock("@/app/admin/settings/users/actions", () => ({
  changeUserRole: vi.fn(),
  inviteUser: vi.fn(),
  removeUserAccess: vi.fn(),
  resendUserSetup: vi.fn(),
}));

const activeUser: AppUserListItem = {
  email: "active@example.com",
  role: "admin",
  status: "active",
  addedAt: "2026-06-01T09:00:00.000Z",
  userId: "user_1",
};

const pendingUser: AppUserListItem = {
  email: "pending@example.com",
  role: "super_admin",
  status: "pending_setup",
  addedAt: "2026-06-02T09:00:00.000Z",
  userId: null,
};

const events: AppUserEvent[] = [];

describe("AdminUsersManager row actions", () => {
  it("shows a visible text label beside each row action icon for super admins", () => {
    const html = renderToStaticMarkup(
      <AdminUsersManager
        users={[activeUser, pendingUser]}
        events={events}
        currentUserEmail="active@example.com"
        currentUserRole="super_admin"
      />,
    );

    expect(html).toContain("Save role");
    expect(html).toContain("Send reset");
    expect(html).toContain("Resend setup");
    expect(html).toContain("Remove access");
  });

  it("keeps the visible label as part of the accessible name for each action", () => {
    const html = renderToStaticMarkup(
      <AdminUsersManager
        users={[activeUser]}
        events={events}
        currentUserEmail="active@example.com"
        currentUserRole="super_admin"
      />,
    );

    expect(html).toContain(`aria-label="Save role for ${activeUser.email}"`);
    expect(html).toContain(`aria-label="Send reset for ${activeUser.email}"`);
    expect(html).toContain(
      `aria-label="Remove access for ${activeUser.email}"`,
    );
  });

  it("renders read-only access without action buttons for non-super-admins", () => {
    const html = renderToStaticMarkup(
      <AdminUsersManager
        users={[activeUser]}
        events={events}
        currentUserEmail="viewer@example.com"
        currentUserRole="admin"
      />,
    );

    expect(html).not.toContain("Save role");
    expect(html).not.toContain("Remove access");
    expect(html).toContain("Super-admin only");
  });
});
