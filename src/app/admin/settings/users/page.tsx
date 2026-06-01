import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import {
  adminListAppUserEvents,
  adminListAppUsers,
  isMissingAppUserEventsTableError,
} from "@/lib/services/app-users";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "User settings admin",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsUsersPage() {
  const { user, role } = await requireAdmin();
  const [users, events] = await Promise.all([
    adminListAppUsers(),
    listEventsForSettingsPage(),
  ]);

  return (
    <AdminShell
      activeSection="settings"
      eyebrow="Studio Settings"
      title="Users and access"
      description="Review admin access, send password setup emails, and manage account roles."
      userEmail={user.email}
      userRole={role}
    >
      <AdminUsersManager
        users={users}
        events={events}
        currentUserEmail={user.email}
        currentUserRole={role}
      />
    </AdminShell>
  );
}

async function listEventsForSettingsPage() {
  try {
    return await adminListAppUserEvents();
  } catch (error) {
    if (
      process.env.NODE_ENV === "development" &&
      isMissingAppUserEventsTableError(error)
    ) {
      console.warn(
        "app_user_events table is missing; run the admin settings migration to enable the Settings audit feed.",
      );
      return [];
    }

    throw error;
  }
}
