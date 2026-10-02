import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { ChatbotConversationDetail } from "@/components/admin/ChatbotConversationDetail";
import { adminGetConversationDetail } from "@/lib/services/chatbot-admin";
import { requireReadAccess } from "@/lib/supabase/auth";

type Params = { id: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const backLink = (
  <Link
    href="/admin/chatbot/conversations"
    className={adminSecondaryButtonClass}
  >
    <span aria-hidden="true">
      <AdminIcon icon="list" />
    </span>
    All conversations
  </Link>
);

export const metadata: Metadata = {
  title: "Conversation detail",
  robots: { index: false, follow: false },
};

export default async function AdminChatbotConversationPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const [{ user, role }, { id }] = await Promise.all([
    requireReadAccess(),
    params,
  ]);
  // The id column is a uuid, so anything else can never match a row; asking
  // the database would only turn a bad link into a load error.
  if (!UUID_PATTERN.test(id)) notFound();

  let conversation: Awaited<ReturnType<typeof adminGetConversationDetail>>;
  try {
    conversation = await adminGetConversationDetail(id);
  } catch (error) {
    // Not "no such conversation": a transient database error must not tell the
    // admin the chat was deleted. Logged, and the page offers a reload.
    console.warn("chatbot conversation detail failed", {
      id,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return (
      <AdminShell
        activeSection="chatbot"
        eyebrow="Site chatbot"
        title="Conversation"
        userEmail={user.email}
        userRole={role}
        actions={backLink}
      >
        <p className={`${adminPanelClass} p-4 text-sm`} role="alert">
          This conversation could not be loaded just now. Reload to try again.
        </p>
      </AdminShell>
    );
  }
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
      actions={backLink}
    >
      <ChatbotConversationDetail conversation={conversation} />
    </AdminShell>
  );
}
