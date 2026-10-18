/**
 * Stamps each table cell with its column header so phones can show rows as
 * stacked cards (header above value) instead of a table cut off at the edge.
 */
export function labelTableCells(html: string): string {
  return html.replace(/<table>[\s\S]*?<\/table>/g, (table) => {
    const labels = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(
      (match) => match[1].replace(/<[^>]+>/g, "").replace(/"/g, "&quot;"),
    );
    return table.replace(/<tr>[\s\S]*?<\/tr>/g, (row) => {
      let column = 0;
      return row.replace(
        /<td(\s[^>]*)?>([\s\S]*?)<\/td>/g,
        (_cell, attrs = "", inner: string) => {
          const label = labels.at(column++) ?? "";
          // Long text takes the full card width; short values sit two a row.
          const wide =
            inner.replace(/<[^>]+>/g, "").length > 24 ? " data-wide" : "";
          return `<td${attrs} data-label="${label}"${wide}>${inner}</td>`;
        },
      );
    });
  });
}

/**
 * Internal briefing (Close conversion rates, competitor notes). Same gate as
 * /masterclass-review: the proxy's /admin gate does not cover this path, so
 * the page checks the session itself and sends anyone else to the login.
 */
