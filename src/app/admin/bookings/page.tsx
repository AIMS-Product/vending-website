import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminBar,
  AdminMetricPanel,
  AdminMetricStrip,
  adminPanelClass,
  adminSectionTitleClass,
} from "@/components/admin/AdminUi";
import { SETTER_CALENDLY_URL } from "@/lib/qualification/thank-you-links";
import { buildCallCreditReport } from "@/lib/services/call-credit-data";
import {
  SETTER_NAMES,
  setterBookingUrl,
  summarizeCallCredits,
  type CallCreditKind,
  type CallCreditRow,
  type CallCreditSummary,
  type RepRole,
} from "@/lib/services/call-credit";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Who set this call",
  robots: { index: false, follow: false },
};

// Booking credit is read fresh on every load: this is the page two people open
// when they disagree about the same booking.
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
] as const;

const ROLE_LABEL: Record<RepRole, string> = {
  setter: "Setter",
  not_setter: "Not a setter",
  unclassified: "Unclassified",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rangeKey = singleParam(params.range) ?? "30";
  const range = RANGES.find((entry) => entry.key === rangeKey) ?? RANGES[1];
  // The chatbot's own view of this page: every booked call where the bot had
  // spoken to the person first, still credited to whoever set the call.
  const chatOnly = singleParam(params.chat) === "1";

  const [{ user, role }, report] = await Promise.all([
    requireAdmin(),
    buildCallCreditReport({ days: range.days }),
  ]);
  const rows = chatOnly
    ? report.rows.filter((row) => row.chat !== null)
    : report.rows;
  const summary = chatOnly ? summarizeCallCredits(rows) : report.summary;

  return (
    <AdminShell
      activeSection="bookings"
      eyebrow="Lead operations"
      title="Who set this call"
      description="One answer per booked call, and the evidence for it. Calendly records who books a call on a lead's behalf, so a call a setter booked says their name — no field to fill in, nothing inferred from activity near the booking."
      userEmail={user.email}
      userRole={role}
    >
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Date range">
        {RANGES.map((entry) => (
          <Link
            key={entry.key}
            href={`/admin/bookings?range=${entry.key}${chatOnly ? "&chat=1" : ""}`}
            aria-current={entry.key === range.key ? "page" : undefined}
            className={`rounded-ui border px-3 py-1.5 text-sm ${
              entry.key === range.key
                ? "border-ui-accent bg-ui-accent text-white"
                : "border-ui-line-strong bg-ui-surface text-ui-text-muted hover:bg-ui-canvas"
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Which calls">
        {[
          {
            key: "all",
            label: "All booked calls",
            href: `/admin/bookings?range=${range.key}`,
          },
          {
            key: "chat",
            label: "Chatted with the bot first",
            href: `/admin/bookings?range=${range.key}&chat=1`,
          },
        ].map((entry) => {
          const isActive = entry.key === (chatOnly ? "chat" : "all");
          return (
            <Link
              key={entry.key}
              href={entry.href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-ui border px-3 py-1.5 text-sm ${
                isActive
                  ? "border-ui-accent bg-ui-accent text-white"
                  : "border-ui-line-strong bg-ui-surface text-ui-text-muted hover:bg-ui-canvas"
              }`}
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>

      {report.connected ? null : (
        <p className={`${adminPanelClass} mb-4 p-4 text-sm`}>
          The bookings table is not available in this environment, so there is
          nothing to credit yet.
        </p>
      )}

      <AdminMetricStrip>
        <AdminMetricPanel
          label="Calls booked"
          value={summary.total}
          caption={`Booked in the last ${range.days} days`}
        />
        <AdminMetricPanel
          tone="green"
          label="Booked by a person"
          value={summary.byKind.rep}
          caption="Calendly names who booked it"
        />
        <AdminMetricPanel
          label="Self-booked, tagged link"
          value={summary.byKind.chatbot + summary.byKind.channel}
          caption={`${summary.byKind.chatbot} from the chat, ${summary.byKind.channel} from another tagged link`}
        />
        <AdminMetricPanel
          tone="amber"
          label="Untagged"
          value={summary.byKind.untagged}
          caption="Nothing on the booking says who sent the link"
        />
        <AdminMetricPanel
          label="Chatted first"
          value={summary.chatTouched}
          caption={`${summary.byKind.chatbot} of them booked in the chat itself`}
        />
      </AdminMetricStrip>

      <PeoplePanel summary={summary} />
      <UntaggedNote summary={summary} />
      <SetterLinksPanel />
      <CallsPanel rows={rows} days={range.days} chatOnly={chatOnly} />
    </AdminShell>
  );
}

function PeoplePanel({ summary }: { summary: CallCreditSummary }) {
  if (summary.people.length === 0) {
    return (
      <section className={`${adminPanelClass} mb-4 p-4`}>
        <h2 className={adminSectionTitleClass}>Calls set, by person</h2>
        <p className="text-ui-text-muted mt-2 text-sm">
          Nobody booked a call on a lead&apos;s behalf in this window.
        </p>
      </section>
    );
  }

  const top = summary.people[0].calls;

  return (
    <section className={`${adminPanelClass} mb-4 p-4`}>
      <h2 className={adminSectionTitleClass}>Calls set, by person</h2>
      <p className="text-ui-text-muted mt-1 mb-3 text-xs">
        Calls this person booked inside Calendly on a lead&apos;s behalf. It
        does not count calls a lead booked themselves from a link that person
        sent — an untagged link carries no name.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-ui-text-muted text-left text-xs">
            <th className="py-1.5 font-medium">Person</th>
            <th className="py-1.5 font-medium">Role</th>
            <th className="py-1.5 text-right font-medium">Calls set</th>
            <th className="w-1/3 py-1.5 font-medium"> </th>
          </tr>
        </thead>
        <tbody className="divide-ui-line divide-y">
          {summary.people.map((person) => (
            <tr key={person.who}>
              <td className="text-ui-text py-2 font-medium">{person.who}</td>
              <td className="text-ui-text-muted py-2">
                {ROLE_LABEL[person.role]}
              </td>
              <td className="text-ui-text py-2 text-right tabular-nums">
                {person.calls}
              </td>
              <td className="py-2 pl-4">
                <AdminBar share={person.calls / top} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function UntaggedNote({ summary }: { summary: CallCreditSummary }) {
  if (summary.byKind.untagged === 0 && summary.unclassified.length === 0) {
    return null;
  }

  return (
    <section className={`${adminPanelClass} mb-4 p-4`}>
      <h2 className={adminSectionTitleClass}>What is still unaccounted for</h2>
      <ul className="text-ui-text-muted mt-2 space-y-1.5 text-sm">
        {summary.byKind.untagged > 0 ? (
          <li>
            <span className="text-ui-text font-medium">
              {summary.byKind.untagged} calls
            </span>{" "}
            came from an untagged link. Usually a rep who texted a raw Calendly
            link instead of booking the call themselves. Give each setter a link
            with their own tag on it and these start carrying a name.
          </li>
        ) : null}
        {summary.unclassified.length > 0 ? (
          <li>
            Not yet marked setter or not:{" "}
            <span className="text-ui-text font-medium">
              {summary.unclassified.join(", ")}
            </span>
            . Their calls are counted; only the role column is blank.
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/**
 * Each setter's own booking link, ready to hand out.
 *
 * This is the fix for the untagged pile above: a setter who texts one of these
 * gets the same named credit as one who books the call inside Calendly, because
 * Calendly echoes the tag back on the booking.
 *
 * Every link points at the one Lane 2 round robin all the setters share, which
 * is exactly why the tag is needed: the calendar cannot say who sent the link,
 * and the round robin's host is whoever takes the call, not who set it.
 */
function SetterLinksPanel() {
  return (
    <details className={`${adminPanelClass} mb-4 p-4`}>
      <summary className={`${adminSectionTitleClass} cursor-pointer`}>
        Each setter&apos;s own booking link
      </summary>
      <p className="text-ui-text-muted mt-2 mb-3 text-xs">
        Hand these out and a call booked off one lands under that setter&apos;s
        name, the same as a call they booked themselves. Any other Calendly link
        works too — add{" "}
        <code>
          utm_source=setter&amp;utm_medium=text&amp;utm_content=their-tag
        </code>{" "}
        to it.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-ui-text-muted text-left text-xs">
              <th className="py-1.5 font-medium">Setter</th>
              <th className="py-1.5 font-medium">Their Lane 2 booking link</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {SETTER_NAMES.map((name) => (
              <tr key={name}>
                <td className="text-ui-text py-2 font-medium whitespace-nowrap">
                  {name}
                </td>
                <td className="text-ui-text-muted py-2 text-xs break-all">
                  {setterBookingUrl(SETTER_CALENDLY_URL, name)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function CallsPanel({
  rows,
  days,
  chatOnly,
}: {
  rows: CallCreditRow[];
  days: number;
  chatOnly: boolean;
}) {
  const shown = rows.slice(0, 100);

  return (
    <section className={`${adminPanelClass} p-4`}>
      <h2 className={adminSectionTitleClass}>
        {chatOnly
          ? "Every call the bot touched, and who set it"
          : "Every call, with its evidence"}
      </h2>
      <p className="text-ui-text-muted mt-1 mb-3 text-xs">
        Booked in the last {days} days, newest first
        {rows.length > shown.length
          ? `, showing ${shown.length} of ${rows.length}`
          : ""}
        .
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="text-ui-text-muted text-left text-xs">
              <th className="py-1.5 font-medium">Booked</th>
              <th className="py-1.5 font-medium">Lead</th>
              <th className="py-1.5 font-medium">Calendar</th>
              <th className="py-1.5 font-medium">Set by (last touch)</th>
              <th className="py-1.5 font-medium">Chat (earlier touch)</th>
              <th className="py-1.5 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-ui-line divide-y">
            {shown.map((row) => (
              <tr key={row.id}>
                <td className="text-ui-text-muted py-2 whitespace-nowrap">
                  {formatDay(row.bookedAt)}
                </td>
                <td className="text-ui-text py-2">
                  {row.inviteeName?.trim() || row.inviteeEmail || "Unknown"}
                  {row.canceled ? (
                    <span className="text-ui-text-muted"> (canceled)</span>
                  ) : null}
                </td>
                <td className="text-ui-text-muted py-2">
                  {row.calendar ?? "Unknown calendar"}
                </td>
                <td className="text-ui-text py-2 font-medium">
                  {row.credit.who}
                  <span className="text-ui-text-muted block text-xs font-normal">
                    {KIND_LABEL[row.credit.kind]}
                  </span>
                </td>
                <td className="py-2 text-xs">
                  {row.chat ? (
                    <Link
                      href={`/admin/chatbot/conversations/${row.chat.conversationId}`}
                      className="text-ui-accent hover:underline"
                    >
                      {row.chat.bookedInChat
                        ? "Booked in this chat"
                        : `Chatted ${formatDay(row.chat.chattedAt)}`}
                    </Link>
                  ) : (
                    <span className="text-ui-text-muted">No chat</span>
                  )}
                </td>
                <td className="text-ui-text-muted py-2 text-xs">
                  {row.credit.evidence}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 ? (
        <p className="text-ui-text-muted text-sm">
          No calls booked in this window.
        </p>
      ) : null}
    </section>
  );
}

const KIND_LABEL: Record<CallCreditKind, string> = {
  rep: "Booked by a person",
  chatbot: "Website chatbot",
  channel: "Self-booked, tagged link",
  untagged: "Self-booked, untagged link",
};

function formatDay(value: string | null): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function singleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
