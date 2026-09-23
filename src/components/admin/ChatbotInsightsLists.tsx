import Link from "next/link";
import {
  applyKnowledgeSuggestionAction,
  dismissFollowUpTaskAction,
  dismissKnowledgeSuggestionAction,
  dismissLearningCaseAction,
  dismissSiteRecommendationAction,
  markFollowUpTaskSentAction,
  markLearningCaseReviewedAction,
  markSiteRecommendationPlannedAction,
} from "@/app/admin/chatbot/insights/actions";
import {
  adminCardClass,
  adminLinkClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { ChatbotInsightItemActions } from "@/components/admin/ChatbotInsightItemActions";
import { ChatbotUnansweredQuestionCard } from "@/components/admin/ChatbotUnansweredQuestionCard";
import type {
  AdminFollowUpTask,
  AdminKnowledgeSuggestion,
  AdminLearningCase,
  AdminSiteRecommendation,
  AdminUnknownQuestion,
} from "@/lib/services/chatbot-insights";

const TASK_TYPE_LABELS: Record<string, string> = {
  invite_to_call: "Invite to call",
  send_resources: "Send resources",
  confirm_fit: "Confirm fit",
  general_follow_up: "General follow-up",
};

const CASE_TYPE_LABELS: Record<string, string> = {
  stalled_lead: "Stalled lead",
  uncaptured_engaged: "Engaged, never captured",
  call_intent_no_booking: "Asked for a call, no booking",
  pricing_question_no_capture: "Pricing question, no capture",
  resource_intent_no_capture: "Wanted a resource, no capture",
  bot_fallback_pattern: "Bot punted an answer",
};

const HANDOFF_REASON_LABELS: Record<string, string> = {
  callback: "Callback",
  support: "Member support",
  accessibility: "No phone call",
  other: "Hand-off",
};

export function ChatbotInsightsLists({
  followUpTasks,
  handoffs,
  learningCases,
  knowledgeSuggestions,
  siteRecommendations,
  unansweredQuestions,
}: {
  followUpTasks: AdminFollowUpTask[];
  handoffs: AdminFollowUpTask[];
  learningCases: AdminLearningCase[];
  knowledgeSuggestions: AdminKnowledgeSuggestion[];
  siteRecommendations: AdminSiteRecommendation[];
  unansweredQuestions: AdminUnknownQuestion[];
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <UnansweredQuestionsPanel questions={unansweredQuestions} />
      <HandoffsPanel handoffs={handoffs} />
      <FollowUpTasksPanel tasks={followUpTasks} />
      <ObjectionsPanel cases={learningCases} />
      <KnowledgeFixesPanel suggestions={knowledgeSuggestions} />
      <SiteRecommendationsPanel recommendations={siteRecommendations} />
    </div>
  );
}

/**
 * The bot's own reported gaps, ahead of everything inferred — a question it
 * said it could not answer is a stronger signal than any heuristic on this
 * page, and answering one makes the bot permanently better.
 */
function UnansweredQuestionsPanel({
  questions,
}: {
  questions: AdminUnknownQuestion[];
}) {
  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>
        Questions the bot couldn&apos;t answer
      </h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Reported by the bot itself. Answer one and it goes straight into the
        knowledge base for every future chat.
      </p>
      {questions.length ? (
        <div className="mt-3 grid gap-3">
          {questions.map((question) => (
            <ChatbotUnansweredQuestionCard
              key={question.id}
              question={question}
            />
          ))}
        </div>
      ) : (
        <p className="text-ui-text-muted mt-3 text-sm">
          Nothing open — the bot answered everything it was asked in this
          window.
        </p>
      )}
    </section>
  );
}

/**
 * People the bot promised a human to: a callback, member support, someone who
 * cannot take a phone call. Kept apart from the sales drafts so a cancellation
 * request is never read as a lead to chase.
 */
function HandoffsPanel({ handoffs }: { handoffs: AdminFollowUpTask[] }) {
  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Hand-offs</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        The bot told these people a teammate would reach out. Not sales
        follow-ups: support requests go to support, callbacks to the setter.
      </p>
      {handoffs.length ? (
        <div className="mt-3 grid gap-3">
          {handoffs.map((task) => (
            <div key={task.id} className="border-ui-line rounded-md border p-3">
              <p className="text-ui-text text-sm font-medium">
                {HANDOFF_REASON_LABELS[task.handoffReason ?? "other"] ??
                  HANDOFF_REASON_LABELS.other}
                {" — "}
                {task.conversationId ? (
                  <Link
                    href={`/admin/chatbot/conversations/${task.conversationId}`}
                    className={adminLinkClass}
                  >
                    {task.conversationLabel}
                  </Link>
                ) : (
                  task.conversationLabel
                )}
              </p>
              <p className="text-ui-text-muted mt-1 text-xs">
                {task.reasonSummary.replace(/^\[\w+\]\s*/, "")}
              </p>
              <ChatbotInsightItemActions
                id={task.id}
                primaryLabel="Mark handled"
                primaryAction={markFollowUpTaskSentAction}
                dismissAction={dismissFollowUpTaskAction}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="No open hand-offs in this window." />
      )}
    </section>
  );
}

function FollowUpTasksPanel({ tasks }: { tasks: AdminFollowUpTask[] }) {
  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Sales follow-ups</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Templated drafts for people who left details and have not booked —
        review before sending, nothing goes out automatically. The next learning
        pass closes a draft once the person books, and any draft older than 7
        days.
      </p>
      {tasks.length ? (
        <div className="mt-3 grid gap-3">
          {tasks.map((task) => (
            <div key={task.id} className="border-ui-line rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-ui-text text-sm font-medium">
                    {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
                    {" — "}
                    {task.conversationId ? (
                      <Link
                        href={`/admin/chatbot/conversations/${task.conversationId}`}
                        className={adminLinkClass}
                      >
                        {task.conversationLabel}
                      </Link>
                    ) : (
                      task.conversationLabel
                    )}
                  </p>
                  <p className="text-ui-text-muted mt-1 text-xs">
                    {task.reasonSummary}
                  </p>
                </div>
                <span className="text-ui-text-subtle text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
                  Priority {task.priority}
                </span>
              </div>
              {task.draftSubject || task.draftBody ? (
                <div className="bg-ui-canvas mt-2 rounded-md p-2 text-xs">
                  {task.draftSubject ? (
                    <p className="text-ui-text font-medium">
                      {task.draftSubject}
                    </p>
                  ) : null}
                  {task.draftBody ? (
                    <p className="text-ui-text-muted mt-1 whitespace-pre-wrap">
                      {task.draftBody}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <ChatbotInsightItemActions
                id={task.id}
                primaryLabel="Mark sent"
                primaryAction={markFollowUpTaskSentAction}
                dismissAction={dismissFollowUpTaskAction}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="No open follow-up tasks in this window." />
      )}
    </section>
  );
}

function ObjectionsPanel({ cases }: { cases: AdminLearningCase[] }) {
  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Objections &amp; gaps</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Patterns the learning pass flagged in individual conversations.
      </p>
      {cases.length ? (
        <div className="mt-3 grid gap-3">
          {cases.map((learningCase) => (
            <div
              key={learningCase.id}
              className="border-ui-line rounded-md border p-3"
            >
              <p className="text-ui-text text-sm font-medium">
                {CASE_TYPE_LABELS[learningCase.caseType] ??
                  learningCase.caseType}
                {" — "}
                {learningCase.conversationId ? (
                  <Link
                    href={`/admin/chatbot/conversations/${learningCase.conversationId}`}
                    className={adminLinkClass}
                  >
                    {learningCase.conversationLabel}
                  </Link>
                ) : (
                  learningCase.conversationLabel
                )}
              </p>
              <p className="text-ui-text-muted mt-1 text-xs">
                {learningCase.reasonSummary}
              </p>
              <ChatbotInsightItemActions
                id={learningCase.id}
                primaryLabel="Mark reviewed"
                primaryAction={markLearningCaseReviewedAction}
                dismissAction={dismissLearningCaseAction}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="No open objections or gaps in this window." />
      )}
    </section>
  );
}

function KnowledgeFixesPanel({
  suggestions,
}: {
  suggestions: AdminKnowledgeSuggestion[];
}) {
  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Knowledge fixes</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Applying appends the suggestion straight onto the knowledge base — no
        extra save step.
      </p>
      {suggestions.length ? (
        <div className="mt-3 grid gap-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="border-ui-line rounded-md border p-3"
            >
              <p className="text-ui-text text-sm font-medium">
                {suggestion.affectedCount} conversation
                {suggestion.affectedCount === 1 ? "" : "s"}
              </p>
              <p className="text-ui-text-muted mt-1 text-xs">
                {suggestion.suggestedText}
              </p>
              <ChatbotInsightItemActions
                id={suggestion.id}
                primaryLabel="Apply"
                primaryAction={applyKnowledgeSuggestionAction}
                dismissAction={dismissKnowledgeSuggestionAction}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="No open knowledge fixes in this window." />
      )}
    </section>
  );
}

function SiteRecommendationsPanel({
  recommendations,
}: {
  recommendations: AdminSiteRecommendation[];
}) {
  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Site recommendations</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Content gaps worth addressing on the site itself, not just in chat.
      </p>
      {recommendations.length ? (
        <div className="mt-3 grid gap-3">
          {recommendations.map((rec) => (
            <div key={rec.id} className="border-ui-line rounded-md border p-3">
              <p className="text-ui-text text-sm font-medium">
                {rec.suggestedTitle}
              </p>
              <p className="text-ui-text-muted mt-1 text-xs">
                {rec.suggestedBody}
              </p>
              <ChatbotInsightItemActions
                id={rec.id}
                primaryLabel="Mark planned"
                primaryAction={markSiteRecommendationPlannedAction}
                dismissAction={dismissSiteRecommendationAction}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="No open site recommendations in this window." />
      )}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-ui-text-subtle mt-3 text-sm">{label}</p>;
}
