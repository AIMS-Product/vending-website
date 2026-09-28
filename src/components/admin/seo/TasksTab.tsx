import Link from "next/link";
import {
  AdminMetricPanel,
  AdminMetricStrip,
  adminCardClass,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";
import { PLAYBOOK, TRIGGER_NAMES, type TriggerCode } from "@/lib/seo/triggers";
import { type Tables } from "@/types/database";
import { addTask, updateTaskStatus } from "@/app/admin/seo/actions";
import { SITE, n, label } from "./shared";

const TYPES = [
  "publish",
  "refresh",
  "optimize",
  "optimize_ctr",
  "add_links",
  "aeo_pairing",
  "verify_facts",
  "technical",
  "outreach",
];

export function SeoTasksTab({
  tasks,
  canEdit,
  status,
  today,
}: {
  tasks: Tables<"seo_tasks">[];
  canEdit: boolean;
  status: string;
  today: string;
}) {
  const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const overdue = tasks.filter(
    (t) => t.due_date && t.due_date < today && t.status !== "done",
  );
  const thisWeek = tasks.filter(
    (t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd,
  );
  return (
    <div className="space-y-5">
      <AdminMetricStrip columns={4}>
        <AdminMetricPanel
          label="Showing"
          value={n(tasks.length)}
          caption={`${status} tasks`}
        />
        <AdminMetricPanel
          label="Overdue"
          value={n(overdue.length)}
          caption="due before today"
        />
        <AdminMetricPanel
          label="Due this week"
          value={n(thisWeek.length)}
          caption={`through ${weekEnd}`}
        />
        <AdminMetricPanel
          label="From Kody's triggers"
          value={n(tasks.filter((t) => t.trigger_code).length)}
          caption="opened by the Monday job"
        />
      </AdminMetricStrip>
      <nav className="flex flex-wrap gap-2 text-xs" aria-label="Task filter">
        {(["open", "done", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/seo?tab=tasks&status=${s}`}
            className={`rounded-ui border px-2 py-1 ${s === status ? "border-ui-accent text-ui-accent" : "border-ui-line text-ui-text-muted"}`}
          >
            {s}
          </Link>
        ))}
        {TYPES.map((t) => (
          <Link
            key={t}
            href={`/admin/seo?tab=tasks&status=${status}&type=${t}`}
            className="rounded-ui border-ui-line text-ui-text-muted border px-2 py-1"
          >
            {label(t)}
          </Link>
        ))}
      </nav>
      <ul className="space-y-3">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            canEdit={canEdit}
            overdue={Boolean(
              t.due_date && t.due_date < today && t.status !== "done",
            )}
          />
        ))}
      </ul>
      {canEdit ? <NewTaskForm /> : null}
    </div>
  );
}

function TaskCard({
  task,
  canEdit,
  overdue,
}: {
  task: Tables<"seo_tasks">;
  canEdit: boolean;
  overdue: boolean;
}) {
  const evidence =
    task.evidence &&
    typeof task.evidence === "object" &&
    !Array.isArray(task.evidence)
      ? Object.entries(task.evidence).filter(([k]) => k !== "seenAt")
      : [];
  const link = task.url
    ? task.url.startsWith("/")
      ? `${SITE}${task.url}`
      : task.url
    : null;
  return (
    <li className={adminCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui-text text-sm font-semibold">{task.title}</p>
          <p className="text-ui-text-subtle mt-0.5 text-xs">
            {label(task.type)} · {task.priority}
            {task.trigger_code
              ? ` · trigger ${task.trigger_code} (${TRIGGER_NAMES[task.trigger_code as TriggerCode]})`
              : ""}
            {task.due_date ? (
              <span className={overdue ? "text-ui-bad font-medium" : ""}>
                {" "}
                · due {task.due_date}
              </span>
            ) : null}
            {task.owner ? ` · ${task.owner}` : ""} · {label(task.status)}
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-1.5">
            {task.status !== "in_progress" && task.status !== "done" ? (
              <StatusButton id={task.id} status="in_progress" text="Start" />
            ) : null}
            {task.status !== "done" ? (
              <StatusButton id={task.id} status="done" text="Mark done" />
            ) : (
              <StatusButton id={task.id} status="open" text="Reopen" />
            )}
            {task.status !== "dismissed" && task.status !== "done" ? (
              <StatusButton id={task.id} status="dismissed" text="Dismiss" />
            ) : null}
          </div>
        ) : null}
      </div>
      {task.detail ? (
        <p className="text-ui-text-muted mt-2 text-sm whitespace-pre-line">
          {task.detail}
        </p>
      ) : null}
      {task.trigger_code && !task.detail ? (
        <p className="text-ui-text-muted mt-2 text-sm">
          {PLAYBOOK[task.trigger_code as TriggerCode]}
        </p>
      ) : null}
      {evidence.length ? (
        <p className="text-ui-text-subtle mt-2 text-xs tabular-nums">
          {evidence.map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
      ) : null}
      {link ? (
        <a
          className="text-ui-accent mt-2 inline-flex items-center gap-1 text-xs"
          href={link}
          target="_blank"
          rel="noreferrer"
        >
          {link.replace(SITE, "")}
        </a>
      ) : null}
      {task.metrics_at_done ? <OptimizationLog task={task} /> : null}
    </li>
  );
}

function OptimizationLog({ task }: { task: Tables<"seo_tasks"> }) {
  const cols: Array<[string, unknown]> = [
    ["At done", task.metrics_at_done],
    ["+14 days", task.metrics_after_14],
    ["+28 days", task.metrics_after_28],
  ];
  return (
    <table className="mt-3 text-xs tabular-nums">
      <thead>
        <tr className="text-ui-text-subtle">
          <th className="pr-4 text-left">Optimization log</th>
          <th className="pr-4">Impr. 28d</th>
          <th className="pr-4">Clicks</th>
          <th className="pr-4">CTR</th>
          <th>Position</th>
        </tr>
      </thead>
      <tbody>
        {cols.map(([name, m]) => {
          const v = (m ?? {}) as Record<string, number | null>;
          return (
            <tr key={name}>
              <td className="text-ui-text-muted pr-4">{name}</td>
              <td className="pr-4 text-center">
                {m ? n(v.impressions28) : "pending"}
              </td>
              <td className="pr-4 text-center">{m ? n(v.clicks28) : ""}</td>
              <td className="pr-4 text-center">
                {m && v.ctrPct !== null ? `${v.ctrPct}%` : ""}
              </td>
              <td className="text-center">{m ? n(v.position, 1) : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StatusButton({
  id,
  status,
  text,
}: {
  id: string;
  status: string;
  text: string;
}) {
  return (
    <form action={updateTaskStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={adminSmallButtonClass}>
        {text}
      </button>
    </form>
  );
}

function NewTaskForm() {
  return (
    <details className={adminCardClass}>
      <summary className="text-ui-text cursor-pointer text-sm font-semibold">
        Add a task
      </summary>
      <form action={addTask} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          Title
          <input
            name="title"
            required
            minLength={3}
            maxLength={300}
            className={adminInputClass}
          />
        </label>
        <label className="text-sm">
          Type
          <select
            name="type"
            className={adminInputClass}
            defaultValue="optimize"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Priority
          <select
            name="priority"
            className={adminInputClass}
            defaultValue="medium"
          >
            {["urgent", "high", "medium", "low"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Page URL or path
          <input
            name="url"
            maxLength={500}
            placeholder="/resources/..."
            className={adminInputClass}
          />
        </label>
        <label className="text-sm">
          Owner
          <input name="owner" maxLength={120} className={adminInputClass} />
        </label>
        <label className="text-sm">
          Due
          <input name="due_date" type="date" className={adminInputClass} />
        </label>
        <label className="text-sm sm:col-span-2">
          Detail
          <textarea
            name="detail"
            rows={3}
            maxLength={4000}
            className={adminInputClass}
          />
        </label>
        <div>
          <button type="submit" className={adminPrimaryButtonClass}>
            Add task
          </button>
        </div>
      </form>
    </details>
  );
}
