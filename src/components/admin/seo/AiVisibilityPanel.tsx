import { AdminBar, adminPanelClass } from "@/components/admin/AdminUi";
import { ChannelLogo } from "@/components/admin/ChannelLogo";
import type { SeoAi, SeoKeywords } from "@/lib/services/seo-command-center";
import { n } from "./shared";

/*
 * Where VP shows up in AI answers, one cell per engine: how many answers
 * cite the site, as a share of what was checked. Google's AI Overview leads
 * because it is the AEO win condition; the engines from the weekly panel
 * follow. Who gets cited instead sits under the cells as chips.
 */

const pct = (count: number, of: number) =>
  of ? `${Math.round((count / of) * 100)}%` : "n/a";

function EngineCell({
  logo,
  label,
  count,
  of,
  noun,
  detail,
  day,
}: {
  logo: string;
  label: string;
  count: number;
  of: number;
  noun: string;
  detail: string;
  day: string | null;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <p className="text-ui-text flex items-center gap-2 text-[0.8125rem] font-medium">
        <ChannelLogo label={logo} />
        <span className="truncate" title={label}>
          {label}
        </span>
      </p>
      <p className="mt-2 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-ui-text text-2xl leading-none font-semibold tracking-[-0.02em]">
          {n(count)}
        </span>
        <span className="text-ui-text-muted text-xs">
          of {n(of)} {noun} ({pct(count, of)})
        </span>
      </p>
      <div className="mt-2.5">
        <AdminBar share={of ? count / of : 0} />
      </div>
      <p className="text-ui-text-subtle mt-2 text-xs tabular-nums">
        {detail}
        {day ? ` · checked ${day}` : ""}
      </p>
    </div>
  );
}

export function AiVisibilityPanel({
  data,
  aeo,
  lastPull,
}: {
  data: SeoAi | { missing: true };
  aeo: SeoKeywords["aeo"];
  lastPull: string | null;
}) {
  const engines = "missing" in data ? [] : data.engines;
  return (
    <section aria-labelledby="ai-answers">
      <h2 id="ai-answers" className="text-ui-text mb-3 text-sm font-semibold">
        Does AI cite vendingpreneurs.com?
      </h2>
      <div
        className={`${adminPanelClass} divide-ui-line grid divide-y sm:grid-cols-2 sm:divide-x lg:grid-cols-3 xl:grid-cols-5 xl:divide-y-0`}
      >
        <EngineCell
          logo="Google"
          label="Google AI Overview"
          count={aeo.citeSite}
          of={aeo.withOverview}
          noun="overviews"
          detail={`${n(aeo.youtubeOnly)} cite VP YouTube only · ${n(aeo.checked)} primary keywords`}
          day={lastPull}
        />
        {engines.map((e) =>
          e.engine === "youtube" ? (
            <EngineCell
              key={e.engine}
              logo="YouTube"
              label={e.label}
              count={e.top10}
              of={e.checked}
              noun="searches"
              detail="a VP video in the top 10"
              day={e.day}
            />
          ) : (
            <EngineCell
              key={e.engine}
              logo={e.engine === "ai_mode" ? "Google" : "ChatGPT"}
              label={e.label}
              count={e.citesSite}
              of={e.checked}
              noun="answers"
              detail={`names VP in ${n(e.mentionsVp)} · cites VP YouTube in ${n(e.citesYoutube)}`}
              day={e.day}
            />
          ),
        )}
      </div>
      {"missing" in data ? (
        <p className="text-ui-text-muted mt-2 text-xs">
          AI Mode, ChatGPT and YouTube checks are not set up: paste
          20260930121000_seo_ai_checks.sql (APPLY-IN-SQL-EDITOR.md section 9).
        </p>
      ) : engines.length === 0 ? (
        <p className="text-ui-text-muted mt-2 text-xs">
          No AI Mode, ChatGPT or YouTube checks yet; the first run is Monday.
        </p>
      ) : null}
      {"missing" in data || data.topHosts.length === 0 ? null : (
        <div className="mt-3">
          <p className="text-ui-text-subtle mb-1.5 text-xs">
            Cited instead, across AI Mode and ChatGPT
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {data.topHosts.map((h) => (
              <li
                key={h.host}
                className="border-ui-line bg-ui-surface rounded-ui text-ui-text-muted border px-2 py-0.5 text-xs tabular-nums"
              >
                <span className="text-ui-text">{h.host}</span> {h.count}
              </li>
            ))}
          </ul>
        </div>
      )}
      {"missing" in data || data.gaps.length === 0 ? null : (
        <details className="group mt-3">
          <summary className="text-ui-accent cursor-pointer text-xs font-medium">
            {data.gaps.length} answers cite others and never name VP
          </summary>
          <ul className="divide-ui-line border-ui-line mt-2 divide-y border-t text-xs">
            {data.gaps.map((g) => (
              <li
                key={`${g.engine}-${g.query}`}
                className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4"
              >
                <span className="text-ui-text">{g.query}</span>
                <span className="text-ui-text-muted">
                  {engines.find((e) => e.engine === g.engine)?.label ??
                    g.engine}
                  : {g.hosts.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
