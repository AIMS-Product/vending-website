import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { ChatbotConversationsManager } from "@/components/admin/ChatbotConversationsManager";
import {
  adminListConversations,
  type AdminChatbotConversationsResult,
  type AdminChatbotSort,
} from "@/lib/services/chatbot-admin";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Chatbot conversations",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string | string[];
  sort?: string | string[];
  flag?: string | string[];
};

const EMPTY_RESULT: AdminChatbotConversationsResult = {
  items: [],
  totalCount: 0,
  highIntentCount: 0,
  missedHandoffCount: 0,
  badQualityCount: 0,
  flagCounts: {
    quality_good: 0,
    quality_bad: 0,
    needs_prompt_tuning: 0,
    lead_high_intent: 0,
    lead_low_intent: 0,
    followup_needed: 0,
    handoff_missed: 0,
  },
};

export default async function AdminChatbotConversationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ user, role }, params] = await Promise.all([
    requireAdmin(),
    searchParams,
  ]);
  const q = singleParam(params.q) ?? "";
  const sort =
    (singleParam(params.sort) as AdminChatbotSort | undefined) ?? "newest";
  const flag = singleParam(params.flag) ?? "all";

  let result = EMPTY_RESULT;
  let loadError = false;
  try {
    result = await adminListConversations({ q, sort, flag });
  } catch (error) {
    console.warn("chatbot conversations list failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    loadError = true;
  }

  return (
    <AdminShell
      activeSection="chatbot"
      eyebrow="Site chatbot"
      title="Conversations"
      description="Every transcript the chatbot has had with a visitor, with flags for what needs review."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link href="/admin/chatbot" className={adminSecondaryButtonClass}>
          <span aria-hidden="true">
            <AdminIcon icon="settings" />
          </span>
          Chatbot settings
        </Link>
      }
    >
      {loadError ? (
        <p className="text-ui-text-muted mb-5 text-sm">
          The chatbot tables aren&apos;t provisioned in this environment yet —
          this list will populate once the migration is applied.
        </p>
      ) : null}
      <ChatbotConversationsManager
        result={result}
        q={q}
        sort={sort}
        flag={flag}
      />
    </AdminShell>
  );
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
