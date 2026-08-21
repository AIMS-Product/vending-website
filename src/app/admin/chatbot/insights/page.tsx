import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { ChatbotInsightsLists } from "@/components/admin/ChatbotInsightsLists";
import { ChatbotInsightsOverview } from "@/components/admin/ChatbotInsightsOverview";
import {
  getChatbotInsightsKpis,
  listOpenFollowUpTasks,
  listOpenKnowledgeSuggestions,
  listOpenLearningCases,
  listOpenSiteRecommendations,
  type AdminChatbotRange,
  type AdminFollowUpTask,
  type AdminKnowledgeSuggestion,
  type AdminLearningCase,
  type AdminSiteRecommendation,
  type ChatbotInsightsKpis,
} from "@/lib/services/chatbot-insights";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Chatbot insights",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const RANGES: AdminChatbotRange[] = [7, 30, 90];

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
  lastLearningRun: null,
};

export default async function AdminChatbotInsightsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const range = parseRange(params.range);

  let kpis: ChatbotInsightsKpis = EMPTY_KPIS;
  let followUpTasks: AdminFollowUpTask[] = [];
  let learningCases: AdminLearningCase[] = [];
  let knowledgeSuggestions: AdminKnowledgeSuggestion[] = [];
  let siteRecommendations: AdminSiteRecommendation[] = [];
  let loadError = false;

  try {
    [
      kpis,
      followUpTasks,
      learningCases,
      knowledgeSuggestions,
      siteRecommendations,
    ] = await Promise.all([
      getChatbotInsightsKpis(range),
      listOpenFollowUpTasks(range),
      listOpenLearningCases(range),
      listOpenKnowledgeSuggestions(range),
      listOpenSiteRecommendations(range),
    ]);
  } catch (error) {
    console.warn("chatbot insights page load failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    loadError = true;
  }

  return (
    <AdminShell
      activeSection="chatbot"
      eyebrow="Site chatbot"
      title="Insights"
      description="What the learning pass found in conversations, and what it drafted for review."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/chatbot" className={adminSecondaryButtonClass}>
          <span aria-hidden="true">
            <AdminIcon icon="settings" />
          </span>
          Settings
        </Link>
      }
    >
      {loadError ? (
        <p className="text-ui-text-muted mb-5 text-sm">
          The chatbot learning tables aren&apos;t provisioned in this
          environment yet. This page will start working once the migration is
          applied.
        </p>
      ) : null}

      <div className="grid gap-5">
        <ChatbotInsightsOverview range={range} ranges={RANGES} kpis={kpis} />
        <ChatbotInsightsLists
          followUpTasks={followUpTasks}
          learningCases={learningCases}
          knowledgeSuggestions={knowledgeSuggestions}
          siteRecommendations={siteRecommendations}
        />
      </div>
    </AdminShell>
  );
}

function parseRange(value: string | string[] | undefined): AdminChatbotRange {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return RANGES.includes(parsed as AdminChatbotRange)
    ? (parsed as AdminChatbotRange)
    : 30;
}
