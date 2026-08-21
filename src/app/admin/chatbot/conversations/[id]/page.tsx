import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { ChatbotConversationDetail } from "@/components/admin/ChatbotConversationDetail";
import { adminGetConversationDetail } from "@/lib/services/chatbot-admin";
import { requireAdmin } from "@/lib/supabase/auth";

type Params = { id: string };

export const metadata: Metadata = {
  title: "Conversation detail",
  robots: { index: false, follow: false },
};

export default async function AdminChatbotConversationPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const [{ user, role }, { id }] = await Promise.all([requireAdmin(), params]);
  // A load failure (table not provisioned, or a transient DB error) reads as
  // "no such conversation" rather than a hard error page.
  const conversation = await adminGetConversationDetail(id).catch(() => null);
  if (!conversation) notFound();

  return (
    <AdminShell
      activeSection="chatbot"
      eyebrow="Site chatbot"
      title={
        conversation.capturedName ||
        conversation.capturedEmail ||
        "Anonymous visitor"
      }
      description="Full transcript, review flags, and handoff status."
      userEmail={user.email}
      userRole={role}
      actions={
        <Link
          href="/admin/chatbot/conversations"
          className={adminSecondaryButtonClass}
        >
          <span aria-hidden="true">
            <AdminIcon icon="list" />
          </span>
          All conversations
        </Link>
      }
    >
      <ChatbotConversationDetail conversation={conversation} />
    </AdminShell>
  );
}
