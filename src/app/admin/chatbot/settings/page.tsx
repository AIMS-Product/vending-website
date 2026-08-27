import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { ChatbotConfigForm } from "@/components/admin/ChatbotConfigForm";
import { ChatbotLeadRoutingPanel } from "@/components/admin/ChatbotLeadRoutingPanel";
import {
  DEFAULT_CHATBOT_CONFIG,
  loadChatbotConfigFresh,
  type ChatbotConfig,
} from "@/lib/chatbot/config";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Chatbot settings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminChatbotSettingsPage() {
  const { user, role } = await requireAdmin();

  // The chatbot migration ships ahead of being applied in every environment
  // (see the spec) — a missing table reads as "off, no activity" rather than
  // a hard error.
  let config: ChatbotConfig = DEFAULT_CHATBOT_CONFIG;
  let loadError = false;
  try {
    config = await loadChatbotConfigFresh();
  } catch (error) {
    console.warn("chatbot admin page load failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    loadError = true;
  }

  return (
    <AdminShell
      activeSection="chatbot"
      eyebrow="Site chatbot"
      title="Chatbot settings"
      description="What Mia says, how she captures contact details, and where leads go."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link href="/admin/chatbot" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="target" />
            </span>
            Overview
          </Link>
          <Link
            href="/admin/chatbot/conversations"
            className={adminSecondaryButtonClass}
          >
            <span aria-hidden="true">
              <AdminIcon icon="message-square" />
            </span>
            Conversations
          </Link>
        </>
      }
    >
      {loadError ? (
        <p className="text-ui-text-muted mb-5 text-sm">
          The chatbot tables aren&apos;t provisioned in this environment yet.
          Settings below will start working once the migration is applied.
        </p>
      ) : null}

      <div className="grid gap-5">
        <ChatbotConfigForm config={config} />
        <ChatbotLeadRoutingPanel config={config} />
      </div>
    </AdminShell>
  );
}
