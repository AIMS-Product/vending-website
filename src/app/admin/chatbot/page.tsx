import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { ChatbotOverview } from "@/components/admin/ChatbotOverview";
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
import {
  getChatbotInsightsKpis,
  type AdminChatbotRange,
  type ChatbotInsightsKpis,
} from "@/lib/services/chatbot-insights";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Chatbot",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = { range?: string | string[] };

const EMPTY_KPIS: ChatbotInsightsKpis = {
  conversations: 0,
  captureRate: 0,
  avgMessages: 0,
  needsPromptTuningCount: 0,
  followUpTasksReadyCount: 0,
  followUpTasksDueTodayCount: 0,
  insightsCount: 0,
  knowledgeFixesCount: 0,
  siteRecsCount: 0,
  unansweredQuestionsCount: 0,
  lastLearningRun: null,
};

export default async function AdminChatbotPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const range = parseRange(params.range);

  // A missing table reads as "off, no activity" rather than a hard error; the
  // migration can ship ahead of being applied in every environment.
  let config: ChatbotConfig = DEFAULT_CHATBOT_CONFIG;
  let analytics: ChatbotAnalytics = EMPTY_CHATBOT_ANALYTICS;
  let kpis: ChatbotInsightsKpis = EMPTY_KPIS;
  let latestActivity: string | null = null;
  let loadError = false;
  try {
    [config, analytics, kpis, latestActivity] = await Promise.all([
      loadChatbotConfigFresh(),
      getChatbotAnalytics(),
      getChatbotInsightsKpis(range),
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
      description="How conversations with Mia are going, where they stop, and what needs a human."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link
            href="/admin/chatbot/conversations"
            className={adminSecondaryButtonClass}
          >
            <span aria-hidden="true">
              <AdminIcon icon="message-square" />
            </span>
            Conversations
          </Link>
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
            href="/admin/chatbot/settings"
            className={adminSecondaryButtonClass}
          >
            <span aria-hidden="true">
              <AdminIcon icon="settings" />
            </span>
            Settings
          </Link>
        </>
      }
    >
      {loadError ? (
        <p className="text-ui-text-muted mb-5 text-sm">
          The chatbot tables aren&apos;t provisioned in this environment yet.
        </p>
      ) : null}
      <ChatbotOverview
        analytics={analytics}
        kpis={kpis}
        range={range}
        enabled={config.enabled}
        latestActivity={latestActivity}
      />
    </AdminShell>
  );
}

function parseRange(value: string | string[] | undefined): AdminChatbotRange {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  return raw === 7 || raw === 90 ? raw : 30;
}
