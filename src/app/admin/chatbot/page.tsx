import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { ChatbotConfigForm } from "@/components/admin/ChatbotConfigForm";
import { ChatbotLeadRoutingPanel } from "@/components/admin/ChatbotLeadRoutingPanel";
import { ChatbotPerformancePanel } from "@/components/admin/ChatbotPerformancePanel";
import {
  EMPTY_CHATBOT_ANALYTICS,
  getChatbotAnalytics,
  type ChatbotAnalytics,
} from "@/lib/chatbot/analytics";
import {
  DEFAULT_CHATBOT_CONFIG,
  loadChatbotConfigFresh,
  type ChatbotConfig,
} from "@/lib/chatbot/config";
import { adminGetLatestActivity } from "@/lib/services/chatbot-admin";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Chatbot admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string | string[] };

export default async function AdminChatbotPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const tab = singleParam(params.tab);

  // The chatbot migration ships ahead of being applied in every environment
  // (see the spec) — a missing table reads as "off, no activity" rather than
  // a hard error.
  let config: ChatbotConfig = DEFAULT_CHATBOT_CONFIG;
  let analytics: ChatbotAnalytics = EMPTY_CHATBOT_ANALYTICS;
  let latestActivity: string | null = null;
  let loadError = false;
  try {
    [config, analytics, latestActivity] = await Promise.all([
      loadChatbotConfigFresh(),
      getChatbotAnalytics(),
      adminGetLatestActivity(),
    ]);
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
      title="Chatbot"
      description="Configure the on-site AI setter, review performance, and route captured leads."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link
            href="/admin/chatbot/insights"
            className={adminSecondaryButtonClass}
          >
            <span aria-hidden="true">
              <AdminIcon icon="target" />
            </span>
            Insights
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
        <ChatbotPerformancePanel
          analytics={analytics}
          config={config}
          latestActivity={latestActivity}
          activeTab={tab}
        />
        <ChatbotConfigForm config={config} />
        <ChatbotLeadRoutingPanel config={config} />
      </div>
    </AdminShell>
  );
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
