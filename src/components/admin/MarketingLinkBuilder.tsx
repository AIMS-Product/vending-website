"use client";

import { useActionState, useRef, useState } from "react";
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
import { CopyButton } from "@/components/admin/CopyButton";
import { MarketingLinkRegistry } from "@/components/admin/MarketingLinkRegistry";
import {
  buildStandardLink,
  LINK_DESTINATIONS,
  LINK_MEDIUMS,
  LINK_SOURCES,
  isShareableLink,
  linkStandardSchema,
  standardSourceFor,
  toContentId,
  toLinkSlug,
  utmTupleKey,
} from "@/lib/analytics/link-standard";
import { FUNNEL_NAMES } from "@/lib/analytics/funnel-names";
import { LINK_PAGES, LINK_PRESETS } from "@/lib/content/link-presets";
import type { RegistryLink } from "@/lib/services/marketing-links";
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

type Draft = {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  destination: string;
  label: string;
  funnelName: string;
  owner: string;
};

const EMPTY_DRAFT: Draft = {
  baseUrl: DEFAULT_BASE_URL,
  source: "",
  medium: "",
  campaign: "",
  content: "",
  destination: "",
  label: "",
  funnelName: "",
  owner: "",
};

export function MarketingLinkBuilder({
  links,
  bitlyConnected,
  statsFailed,
  canSave,
}: {
  links: RegistryLink[];
  bitlyConnected: boolean;
  statsFailed: boolean;
  canSave: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [presetKey, setPresetKey] = useState<string | null>(null);
  const formRef = useRef<HTMLElement>(null);

  // A registry row (or an imported tag) becomes the starting point for a new
  // link: same campaign, new content, sources mapped onto the standard.
  const startFrom = (link: RegistryLink) => {
    setPresetKey(null);
    setDraft({
      baseUrl:
        link.base_url.startsWith("https://") && isShareableLink(link)
          ? link.base_url
          : DEFAULT_BASE_URL,
      source: standardSourceFor(link.utm_source) ?? "",
      medium: isOn(LINK_MEDIUMS, link.utm_medium) ? link.utm_medium : "",
      campaign: toLinkSlug(link.utm_campaign),
      content: toContentId(link.utm_content),
      destination: isOn(LINK_DESTINATIONS, link.utm_term) ? link.utm_term : "",
      label: link.label?.replace(/^Imported[^:]*:\s*/, "") ?? "",
      funnelName: link.funnel_name ?? "",
      owner: link.owner ?? "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <BuilderForm
        ref={formRef}
        draft={draft}
        setDraft={setDraft}
        presetKey={presetKey}
        setPresetKey={setPresetKey}
        links={links}
        bitlyConnected={bitlyConnected}
        canSave={canSave}
      />
      <MarketingLinkRegistry
        links={links}
        statsFailed={statsFailed}
        canSave={canSave}
        onStartFrom={startFrom}
      />
    </div>
  );
}

function BuilderForm({
  ref,
  draft,
  setDraft,
  presetKey,
  setPresetKey,
  links,
  bitlyConnected,
  canSave,
}: {
  ref: React.Ref<HTMLElement>;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  presetKey: string | null;
  setPresetKey: (key: string | null) => void;
  links: RegistryLink[];
  bitlyConnected: boolean;
  canSave: boolean;
}) {
  const [state, formAction] = useActionState(createLink, initialState);
  const preset = LINK_PRESETS.find((item) => item.key === presetKey) ?? null;

  // Previewed with the same cleaning and the same function the server stores
  // with, so what the admin sees is what gets saved.
  const cleaned = {
    ...draft,
    campaign: toLinkSlug(draft.campaign),
    content: toContentId(draft.content),
  };
  const parsed = linkStandardSchema.safeParse(cleaned);
  const preview = parsed.success
    ? { url: buildStandardLink(parsed.data), problem: null }
    : { url: null, problem: parsed.error.issues[0]?.message ?? null };
  const match = parsed.success ? findSameLink(links, cleaned) : null;
  // The link just saved is in the refreshed list too; that is the success
  // message's job, not a duplicate warning.
  const existing =
    match && !(state.status === "saved" && match.url === state.url)
      ? match
      : null;

  const update =
    (key: keyof Draft) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((current) => ({ ...current, [key]: event.target.value }));

  const applyPreset = (key: string) => {
    const next = LINK_PRESETS.find((item) => item.key === key);
    if (!next) return;
    setPresetKey(key);
    setDraft({
      baseUrl: next.baseUrl,
      source: next.source,
      medium: next.medium,
      campaign: next.campaign,
      content: "",
      destination: next.destination,
      label: "",
      funnelName: next.funnel ?? "",
      owner: "",
    });
  };

  return (
    <section ref={ref} className={cn(adminPanelClass, "scroll-mt-4")}>
      <form action={formAction} className="p-4">
        <div>
          <p className={adminEyebrowClass}>Start from</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LINK_PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={presetKey === item.key}
                onClick={() => applyPreset(item.key)}
                className={cn(
                  adminSmallButtonClass,
                  presetKey === item.key &&
                    "border-ui-accent text-ui-accent bg-ui-accent-soft",
                )}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPresetKey(null);
                setDraft(EMPTY_DRAFT);
              }}
              className={cn(adminSmallButtonClass)}
            >
              Blank
            </button>
          </div>
          <p className="text-ui-text-subtle mt-2 text-xs">
            {preset
              ? `${preset.hint} Only the content is left to fill in.`
              : "Pick the kind of link and the fixed fields fill themselves. Or copy any link below with Use as template."}
          </p>
        </div>

        <div className="border-ui-line mt-4 grid gap-4 border-t pt-4 lg:grid-cols-2">
          <label className="block lg:col-span-2">
            <span className={adminLabelClass}>Page it sends people to</span>
            <input
              name="baseUrl"
              type="url"
              required
              list="link-builder-pages"
              value={draft.baseUrl}
              onChange={update("baseUrl")}
              placeholder={DEFAULT_BASE_URL}
              className={controlClass}
            />
            <datalist id="link-builder-pages">
              {LINK_PAGES.map((page) => (
                <option key={page.url} value={page.url}>
                  {page.label}
                </option>
              ))}
            </datalist>
          </label>

          <SelectField
            name="source"
            label="Where it is posted (source)"
            value={draft.source}
            onChange={update("source")}
            placeholder="Pick a platform"
            options={LINK_SOURCES.map((value) => ({ value, label: value }))}
          />
          <SelectField
            name="medium"
            label="How it reaches them (medium)"
            value={draft.medium}
            onChange={update("medium")}
            placeholder="Paid, organic, owned, email, sms or chat"
            options={LINK_MEDIUMS.map((value) => ({ value, label: value }))}
          />

          <TextField
            name="campaign"
            label="Campaign"
            value={draft.campaign}
            onChange={update("campaign")}
            placeholder="mh-podcast, webinar-oct13, vsl"
            help="The thing being promoted. Spaces and capitals are cleaned up for you."
          />
          <TextField
            name="content"
            label="Content"
            value={draft.content}
            onChange={update("content")}
            placeholder={
              preset?.contentHint ?? "post, ad, video, show or message"
            }
            help="The one post, ad, video, show or message this link lives in. A new one gets its own link."
          />

          <SelectField
            name="destination"
            label="What the page asks them to do (term)"
            value={draft.destination}
            onChange={update("destination")}
            placeholder="Where are we sending them?"
            options={LINK_DESTINATIONS.map((value) => ({
              value,
              label: `${value} · ${DESTINATION_HELP[value]}`,
            }))}
          />
          <TextField
            name="label"
            label="Note (optional)"
            value={draft.label}
            onChange={update("label")}
            placeholder="Side Hustle Pro, ep. 212, airs Oct 20"
          />

          <SelectField
            name="funnelName"
            label="Funnel (Close Funnel Name)"
            value={draft.funnelName}
            onChange={update("funnelName")}
            placeholder="Which funnel does this link feed?"
            options={FUNNEL_NAMES.map((value) => ({ value, label: value }))}
          />
          <TextField
            name="owner"
            label="Owner (optional)"
            value={draft.owner}
            onChange={update("owner")}
            placeholder="Mike, Anthony, a setter"
          />
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
          {canSave ? (
            <SubmitButton
              disabled={!preview.url || !draft.funnelName || Boolean(existing)}
            />
          ) : (
            <p className="text-ui-text-subtle text-xs">
              This login can view links but not save them. Copy the preview, or
              ask an admin for an editor login.
            </p>
          )}
        </div>

        <Preview url={preview.url} problem={preview.problem} />
        {existing ? <AlreadyExists link={existing} /> : null}
        <Result state={state} />
      </form>
    </section>
  );
}

function TextField({
  name,
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  help?: string;
}) {
  return (
    <label className="block">
      <span className={adminLabelClass}>{label}</span>
      <input
        name={name}
        type="text"
        required={name !== "label" && name !== "owner"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={controlClass}
      />
      {help ? (
        <span className="text-ui-text-subtle mt-1 block text-xs">{help}</span>
      ) : null}
    </label>
  );
}

function SelectField({
  name,
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className={adminLabelClass}>{label}</span>
      <select
        name={name}
        required
        value={value}
        onChange={onChange}
        className={controlClass}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Preview({
  url,
  problem,
}: {
  url: string | null;
  problem: string | null;
}) {
  return (
    <div className="bg-ui-canvas rounded-ui mt-4 px-3 py-2.5">
      <p className={adminEyebrowClass}>Preview</p>
      {url ? (
        <p className="text-ui-text mt-1 text-sm break-all">{url}</p>
      ) : (
        <p className="text-ui-text-subtle mt-1 text-sm">
          {problem ?? "Fill in every field to see the link."}
        </p>
      )}
    </div>
  );
}

function AlreadyExists({ link }: { link: RegistryLink }) {
  const url = link.bitly_url ?? link.url;
  return (
    <div
      role="status"
      className="border-ui-warn/30 bg-ui-warn-fill rounded-ui mt-3 border px-3 py-2.5"
    >
      <p className="text-ui-warn-ink text-sm font-medium">
        This exact link already exists. Reuse it so its results stay in one
        place, or change the content to make a new one.
        {link.stats
          ? ` So far: ${link.stats.leads} leads, ${link.stats.booked} booked.`
          : ""}
      </p>
      {isShareableLink(link) ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <code className="text-ui-text min-w-0 flex-1 break-all">{url}</code>
          <CopyButton value={url} />
        </div>
      ) : null}
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
      <p className="text-ui-ok-ink text-sm font-medium">
        {state.message} Leads and bookings from it show on its row below.
      </p>
      <CopyRow label="Long link" value={state.url} />
      {state.shortUrl ? (
        <CopyRow label="Short link" value={state.shortUrl} />
      ) : null}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ui-text-muted w-20 shrink-0 text-xs font-semibold uppercase">
        {label}
      </span>
      <code className="text-ui-text min-w-0 flex-1 break-all">{value}</code>
      <CopyButton value={value} />
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

function findSameLink(
  links: RegistryLink[],
  draft: Draft,
): RegistryLink | null {
  const key = utmTupleKey({
    source: draft.source,
    medium: draft.medium,
    campaign: draft.campaign,
    content: draft.content,
    term: draft.destination,
  });
  return (
    links.find(
      (link) =>
        utmTupleKey({
          source: link.utm_source,
          medium: link.utm_medium,
          campaign: link.utm_campaign,
          content: link.utm_content,
          term: link.utm_term,
        }) === key,
    ) ?? null
  );
}

function isOn<T extends string>(
  list: readonly T[],
  value: string | null | undefined,
): value is T {
  return Boolean(value) && list.includes(value as T);
}
