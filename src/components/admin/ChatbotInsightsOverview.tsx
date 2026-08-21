import Link from "next/link";
import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminCardClass,
  adminEyebrowClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { RunLearningPassButton } from "@/components/admin/RunLearningPassButton";
import type {
  AdminChatbotRange,
  ChatbotInsightsKpis,
} from "@/lib/services/chatbot-insights";

export function ChatbotInsightsOverview({
  range,
  ranges,
  kpis,
}: {
  range: AdminChatbotRange;
  ranges: AdminChatbotRange[];
  kpis: ChatbotInsightsKpis;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeTabs range={range} ranges={ranges} />
        <RunLearningPassButton />
      </div>

      <AdminMetricStrip>
        <AdminMetricPanel
          label="Conversations"
          value={kpis.conversations}
          caption={`${Math.round(kpis.captureRate * 100)}% captured contact info`}
        />
        <AdminMetricPanel
          label="Avg messages"
          value={kpis.avgMessages.toFixed(1)}
          caption="per conversation"
        />
        <AdminMetricPanel
          label="Follow-up tasks"
          value={kpis.followUpTasksReadyCount}
          tone={kpis.followUpTasksReadyCount ? "amber" : "slate"}
          caption={`${kpis.followUpTasksDueTodayCount} due today`}
        />
        <AdminMetricPanel
          label="Needs prompt tuning"
          value={kpis.needsPromptTuningCount}
          tone={kpis.needsPromptTuningCount ? "amber" : "slate"}
          caption="flagged conversations"
        />
      </AdminMetricStrip>

      <AdminMetricStrip>
        <AdminMetricPanel
          label="Insights"
          value={kpis.insightsCount}
          caption="open"
        />
        <AdminMetricPanel
          label="Knowledge fixes"
          value={kpis.knowledgeFixesCount}
          caption="open"
        />
        <AdminMetricPanel
          label="Site recommendations"
          value={kpis.siteRecsCount}
          caption="open"
        />
        <div className="px-4 py-3.5">
          <p className={adminEyebrowClass}>Approval mode</p>
          <p className="text-ui-text mt-2 text-sm font-medium">
            Nothing auto-sends
          </p>
          <p className="text-ui-text-muted mt-1.5 text-xs">
            Every follow-up draft below waits for a human to review it.
          </p>
        </div>
      </AdminMetricStrip>

      <LastRunPanel run={kpis.lastLearningRun} />
    </div>
  );
}

function RangeTabs({
  range,
  ranges,
}: {
  range: AdminChatbotRange;
  ranges: AdminChatbotRange[];
}) {
  return (
    <div
      className="rounded-ui border-ui-line-strong inline-flex overflow-hidden border"
      role="group"
      aria-label="Date range"
    >
      {ranges.map((option) => (
        <Link
          key={option}
          href={`/admin/chatbot/insights?range=${option}`}
          aria-current={range === option ? "page" : undefined}
          className={`px-3 py-1.5 text-sm font-medium transition ${
            range === option
              ? "bg-ui-accent text-white"
              : "text-ui-text-muted hover:bg-ui-canvas bg-white"
          }`}
        >
          {option}d
        </Link>
      ))}
    </div>
  );
}

function LastRunPanel({
  run,
}: {
  run: ChatbotInsightsKpis["lastLearningRun"];
}) {
  return (
    <section className={adminCardClass}>
      <h2 className={adminSectionTitleClass}>Last learning run</h2>
      {run ? (
        <p className="text-ui-text-muted mt-2 text-sm">
          Started {formatDateTime(run.startedAt)}
          {run.finishedAt
            ? `, finished ${formatDateTime(run.finishedAt)}`
            : " — still running or never finished"}
          .{" "}
          {run.ok === false
            ? `Failed: ${run.error ?? "unknown error"}.`
            : `Scanned ${run.conversationsScanned} conversations, wrote ${run.recordsWritten} records.`}
        </p>
      ) : (
        <p className="text-ui-text-subtle mt-2 text-sm">
          No learning pass has run yet — use the button above to run one now.
        </p>
      )}
    </section>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
