import { adminCardClass } from "@/components/admin/AdminUi";
import type { SeoAi } from "@/lib/services/seo-command-center";

const pct = (n: number, of: number) =>
  of ? `${Math.round((n / of) * 100)}%` : "n/a";

export function AiVisibilityPanel({
  data,
}: {
  data: SeoAi | { missing: true };
}) {
  if ("missing" in data) {
    return (
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          AI answers and YouTube
        </h2>
        <p className="text-ui-text-muted mt-2 text-sm">
          Not set up: paste 20260930121000_seo_ai_checks.sql
          (APPLY-IN-SQL-EDITOR.md section 9).
        </p>
      </section>
    );
  }
  return (
    <section className={adminCardClass}>
      <h2 className="text-ui-text text-sm font-semibold">
        AI answers and YouTube
      </h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Weekly: Google AI Mode for every primary keyword, ChatGPT for a
        26-prompt panel, YouTube search for VP videos. Monthly: answers in
        DataForSEO&apos;s LLM index that cite vendingpreneurs.com.
      </p>
      {data.engines.length === 0 ? (
        <p className="text-ui-text-muted mt-3 text-sm">
          No checks yet; the first run is Monday.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ui-text-muted text-left text-xs">
                <th className="py-1.5 pr-3 font-medium">Engine</th>
                <th className="py-1.5 pr-3 font-medium">Checked</th>
                <th className="py-1.5 pr-3 text-right font-medium">Queries</th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  Cite the site
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  Cite VP YouTube
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">Name VP</th>
                <th className="py-1.5 text-right font-medium">
                  VP video top 10
                </th>
              </tr>
            </thead>
            <tbody>
              {data.engines.map((e) => (
                <tr key={e.engine} className="border-ui-line border-t">
                  <td className="text-ui-text py-1.5 pr-3">{e.label}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{e.day}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {e.checked}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {e.citesSite} ({pct(e.citesSite, e.checked)})
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {e.citesYoutube}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {e.mentionsVp}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {e.engine === "youtube" ? e.top10 : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.topHosts.length > 0 ? (
        <p className="text-ui-text-muted mt-3 text-xs">
          Most cited by AI Mode and ChatGPT:{" "}
          {data.topHosts.map((h) => `${h.host} (${h.count})`).join(", ")}
        </p>
      ) : null}
      {data.gaps.length > 0 ? (
        <details className="mt-3">
          <summary className="text-ui-text cursor-pointer text-sm">
            {data.gaps.length} answers that cite others and never name VP
          </summary>
          <ul className="text-ui-text-muted mt-2 space-y-1 text-xs">
            {data.gaps.map((g) => (
              <li key={`${g.engine}-${g.query}`}>
                <span className="text-ui-text">{g.query}</span> ({g.engine}):{" "}
                {g.hosts.join(", ")}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
