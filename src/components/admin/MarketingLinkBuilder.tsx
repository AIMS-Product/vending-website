"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createLink,
  type LinkBuilderActionState,
} from "@/app/admin/links/actions";
import {
  AdminIcon,
  adminEyebrowClass,
  adminInputClass,
  adminLabelClass,
  adminPanelClass,
  adminPrimaryButtonClass,
  adminSmallButtonClass,
} from "@/components/admin/AdminUi";
import {
  buildStandardLink,
  LINK_DESTINATIONS,
  LINK_MEDIUMS,
  LINK_SOURCES,
  linkStandardSchema,
} from "@/lib/analytics/link-standard";
import type { MarketingLink } from "@/lib/services/marketing-links";
import { cn } from "@/lib/utils";

const initialState: LinkBuilderActionState = { status: "idle" };

const DEFAULT_BASE_URL = "https://www.vendingpreneurs.com/";

const controlClass = cn(adminInputClass, "mt-1 min-w-0");

/** What each destination means, in the words the team uses. */
const DESTINATION_HELP: Record<(typeof LINK_DESTINATIONS)[number], string> = {
  "book-call": "Straight to the calendar",
  "lead-magnet": "A download or free resource",
  "webinar-register": "Webinar registration",
  apply: "The application form",
  content: "An article, video or page to read",
  none: "No call to action (profile, mention)",
};

export function MarketingLinkBuilder({
  links,
  bitlyConnected,
}: {
  links: MarketingLink[];
  bitlyConnected: boolean;
}) {
  return (
    <div className="grid gap-5">
      <BuilderForm bitlyConnected={bitlyConnected} />
      <LinkRegistry links={links} />
    </div>
  );
}

function BuilderForm({ bitlyConnected }: { bitlyConnected: boolean }) {
  const [state, formAction] = useActionState(createLink, initialState);
  const [draft, setDraft] = useState({
    baseUrl: DEFAULT_BASE_URL,
    source: "",
    medium: "",
    campaign: "",
    content: "",
    destination: "",
  });

  // The preview is the same function the server stores with, so what the
  // admin sees is what gets saved.
  const preview = useMemo(() => {
    const parsed = linkStandardSchema.safeParse(draft);
    return parsed.success
      ? { url: buildStandardLink(parsed.data), problem: null }
      : { url: null, problem: parsed.error.issues[0]?.message ?? null };
  }, [draft]);

  const update =
    (key: keyof typeof draft) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((current) => ({ ...current, [key]: event.target.value }));

  return (
    <section className={adminPanelClass}>
      <form action={formAction} className="p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block lg:col-span-2">
            <span className={adminLabelClass}>Destination URL</span>
            <input
              name="baseUrl"
              type="url"
              required
              value={draft.baseUrl}
              onChange={update("baseUrl")}
              placeholder={DEFAULT_BASE_URL}
              className={controlClass}
            />
          </label>

          <label className="block">
            <span className={adminLabelClass}>Source (utm_source)</span>
            <select
              name="source"
              required
              value={draft.source}
              onChange={update("source")}
              className={controlClass}
            >
              <option value="">Where the link is posted</option>
              {LINK_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={adminLabelClass}>Medium (utm_medium)</span>
            <select
              name="medium"
              required
              value={draft.medium}
              onChange={update("medium")}
              className={controlClass}
            >
              <option value="">Paid, organic, owned, email, sms or chat</option>
              {LINK_MEDIUMS.map((medium) => (
                <option key={medium} value={medium}>
                  {medium}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={adminLabelClass}>Campaign (utm_campaign)</span>
            <input
              name="campaign"
              type="text"
              required
              value={draft.campaign}
              onChange={update("campaign")}
              placeholder="webinar-sept15"
              className={controlClass}
            />
            <span className="text-ui-text-subtle mt-1 block text-xs">
              The thing being promoted, as a lowercase slug.
            </span>
          </label>

          <label className="block">
            <span className={adminLabelClass}>Content (utm_content)</span>
            <input
              name="content"
              type="text"
              required
              value={draft.content}
              onChange={update("content")}
              placeholder="post id, ad id, video id or message step"
              className={controlClass}
            />
            <span className="text-ui-text-subtle mt-1 block text-xs">
              The specific post, ad, video or message this link lives in.
            </span>
          </label>

          <label className="block">
            <span className={adminLabelClass}>Destination (utm_term)</span>
            <select
              name="destination"
              required
              value={draft.destination}
              onChange={update("destination")}
              className={controlClass}
            >
              <option value="">Where are we sending them?</option>
              {LINK_DESTINATIONS.map((destination) => (
                <option key={destination} value={destination}>
                  {destination} · {DESTINATION_HELP[destination]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={adminLabelClass}>Label (optional)</span>
            <input
              name="label"
              type="text"
              placeholder="IG bio link, Sept webinar"
              className={controlClass}
            />
          </label>
        </div>

        <div className="border-ui-line mt-4 flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="text-ui-text-muted inline-flex items-center gap-2 text-sm">
            <input
              name="shortLink"
              type="checkbox"
              disabled={!bitlyConnected}
              className="size-4"
            />
            Also create a Bitly short link
            {!bitlyConnected ? (
              <span className="text-ui-text-subtle text-xs">
                (Bitly not connected)
              </span>
            ) : null}
          </label>
          <SubmitButton disabled={!preview.url} />
        </div>

        <Preview preview={preview} />
        <Result state={state} />
      </form>
    </section>
  );
}

function Preview({
  preview,
}: {
  preview: { url: string | null; problem: string | null };
}) {
  return (
    <div className="bg-ui-canvas rounded-ui mt-4 px-3 py-2.5">
      <p className={adminEyebrowClass}>Preview</p>
      {preview.url ? (
        <p className="text-ui-text mt-1 text-sm break-all">{preview.url}</p>
      ) : (
        <p className="text-ui-text-subtle mt-1 text-sm">
          {preview.problem ?? "Fill in every field to see the link."}
        </p>
      )}
    </div>
  );
}

function Result({ state }: { state: LinkBuilderActionState }) {
  if (state.status === "idle") return null;
  if (state.status === "error") {
    return (
      <p role="alert" className="text-ui-bad mt-3 text-sm">
        {state.message}
      </p>
    );
  }
  return (
    <div
      role="status"
      className="border-ui-ok/30 bg-ui-ok-fill rounded-ui mt-3 border px-3 py-2.5"
    >
      <p className="text-ui-ok-ink text-sm font-medium">{state.message}</p>
      <CopyRow label="Long link" value={state.url} />
      {state.shortUrl ? (
        <CopyRow label="Short link" value={state.shortUrl} />
      ) : null}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ui-text-muted w-20 shrink-0 text-xs font-semibold uppercase">
        {label}
      </span>
      <code className="text-ui-text min-w-0 flex-1 break-all">{value}</code>
      <button
        type="button"
        className={adminSmallButtonClass}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard can be blocked; the text is selectable beside the button.
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${adminPrimaryButtonClass} whitespace-nowrap`}
    >
      <span aria-hidden="true">
        <AdminIcon icon="plus" />
      </span>
      {pending ? "Saving..." : "Save link"}
    </button>
  );
}

function LinkRegistry({ links }: { links: MarketingLink[] }) {
  return (
    <section className={adminPanelClass} aria-label="Link registry">
      <div className="border-ui-line border-b p-4">
        <h2 className="text-ui-text text-base font-semibold">
          Every link built
        </h2>
        <p className="text-ui-text-muted mt-1 text-sm">
          What is going out, newest first. A link with no clicks yet still
          belongs here.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="divide-ui-line w-full min-w-[56rem] divide-y text-left text-sm">
          <thead className="bg-ui-canvas text-ui-text-subtle text-xs font-semibold uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5">
                Built
              </th>
              <th scope="col" className="px-4 py-2.5">
                Source / medium
              </th>
              <th scope="col" className="px-4 py-2.5">
                Campaign
              </th>
              <th scope="col" className="px-4 py-2.5">
                Content
              </th>
              <th scope="col" className="px-4 py-2.5">
                Destination
              </th>
              <th scope="col" className="px-4 py-2.5">
                Link
              </th>
              <th scope="col" className="px-4 py-2.5">
                By
              </th>
            </tr>
          </thead>
          <tbody className="divide-ui-line bg-ui-surface divide-y">
            {links.length ? (
              links.map((link) => (
                <tr key={link.id}>
                  <td className="text-ui-text-muted px-4 py-2.5 whitespace-nowrap tabular-nums">
                    {link.created_at.slice(0, 10)}
                  </td>
                  <td className="text-ui-text px-4 py-2.5">
                    {link.utm_source}{" "}
                    <span className="text-ui-text-subtle">
                      / {link.utm_medium}
                    </span>
                  </td>
                  <td className="text-ui-text px-4 py-2.5 font-medium">
                    {link.utm_campaign}
                    {link.label ? (
                      <span className="text-ui-text-subtle block text-xs font-normal">
                        {link.label}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-ui-text-muted px-4 py-2.5">
                    {link.utm_content}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-ui-accent bg-ui-accent-soft rounded-ui inline-flex items-center px-2 py-0.5 text-xs font-semibold">
                      {link.utm_term}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <a
                      href={link.bitly_url ?? link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ui-accent block max-w-[20rem] truncate underline-offset-2 hover:underline"
                      title={link.url}
                    >
                      {link.bitly_url ?? link.url}
                    </a>
                  </td>
                  <td className="text-ui-text-subtle px-4 py-2.5 text-xs">
                    {link.created_by}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="text-ui-text-subtle px-4 py-8 text-center text-sm"
                >
                  No links built yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
