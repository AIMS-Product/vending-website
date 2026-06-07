import { listPublishedPosts } from "@/lib/services/news";
import { publicConfig } from "@/lib/config";

export const revalidate = 300;

export async function GET() {
  const posts = await listPublishedPosts({ limit: 50 });
  const siteUrl = publicConfig.siteUrl.replace(/\/$/, "");
  const updated = posts[0]?.published_at ?? new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Vendingpreneurs News</title>
    <link>${siteUrl}/news</link>
    <description>Vending industry insights, location strategies, and program updates from Vendingpreneurs.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/news/feed.xml" rel="self" type="application/rss+xml" />
${posts.map((post) => renderItem(post, siteUrl)).join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=300, stale-while-revalidate=86400",
    },
  });
}

type FeedPost = Awaited<ReturnType<typeof listPublishedPosts>>[number];

function renderItem(post: FeedPost, siteUrl: string) {
  const url = `${siteUrl}/news/${post.slug}`;
  const pubDate = post.published_at
    ? new Date(post.published_at).toUTCString()
    : undefined;

  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ""}
      ${
        post.excerpt
          ? `<description>${escapeXml(post.excerpt)}</description>`
          : ""
      }
    </item>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
