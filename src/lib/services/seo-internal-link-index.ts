import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  collectPageInternalLinks,
  flattenBlocks,
  pageContentSchema,
  resourcePathForSlug,
  richTextDocumentPlainText,
  type PageBlock,
  type PageContent,
  type PageInternalLink,
} from "@/lib/page-builder/blocks";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type InternalLinkIndexClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: InternalLinkIndexClient;
};

type InternalLinkIndexRow = {
  id: string;
  slug: string;
  title: string;
  target_keyword: string | null;
  meta_description: string | null;
  published_content: unknown;
  updated_at: string;
};

type InternalLinkTarget = {
  pageId: string;
  slug: string;
  path: string;
  title: string;
  targetKeyword: string | null;
  summary: string;
  headings: string[];
  outgoingInternalLinks: PageInternalLink[];
  updatedAt: string;
};

export type ListInternalLinkTargetsOptions = {
  currentPageId?: string | null;
  currentPath?: string | null;
};

const INTERNAL_LINK_INDEX_FIELDS =
  "id, slug, title, target_keyword, meta_description, published_content, updated_at" as const;

export async function adminListInternalLinkTargets(
  options: ListInternalLinkTargetsOptions = {},
  deps: ServiceDeps = {},
) {
  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("seo_pages")
    .select(INTERNAL_LINK_INDEX_FIELDS)
    .eq("status", "published")
    .eq("noindex", false)
    .eq("sitemap_enabled", true);

  if (error) {
    throw new Error("Could not build internal link index.", { cause: error });
  }

  return (data ?? []).flatMap((row) => {
    const target = targetFromRow(row as InternalLinkIndexRow);
    if (!target) return [];
    if (target.pageId === options.currentPageId) return [];
    if (target.path === options.currentPath) return [];
    return [target];
  });
}

function targetFromRow(row: InternalLinkIndexRow): InternalLinkTarget | null {
  const content = pageContentSchema.safeParse(row.published_content);
  if (!content.success) return null;

  const path = resourcePathForSlug(row.slug);
  return {
    pageId: row.id,
    slug: row.slug,
    path,
    title: row.title,
    targetKeyword: row.target_keyword,
    summary: row.meta_description || firstVisibleText(content.data),
    headings: extractHeadings(content.data),
    outgoingInternalLinks: collectPageInternalLinks(content.data),
    updatedAt: row.updated_at,
  };
}

function extractHeadings(content: PageContent) {
  const headings: string[] = [];
  for (const block of flattenBlocks(content)) {
    headings.push(...headingsForBlock(block));
  }
  return uniqueNonEmpty(headings).slice(0, 12);
}

function headingsForBlock(block: PageBlock) {
  if (block.type === "hero") return [block.props.heading];
  if (block.type === "rich_text") {
    return [
      block.props.heading,
      ...block.props.body.nodes.flatMap((node) =>
        node.type === "heading" ? [node.text] : [],
      ),
    ];
  }
  if (block.type === "faq") {
    return [
      block.props.heading,
      ...block.props.items.map((item) => item.question),
    ];
  }
  if (block.type === "card_grid") {
    return [
      block.props.heading,
      ...block.props.cards.map((card) => card.title),
    ];
  }
  if (block.type === "proof") return [block.props.eyebrow];
  if (block.type === "lead_form") return [block.props.heading];
  if (block.type === "video") return [block.props.title];
  return [];
}

function firstVisibleText(content: PageContent) {
  const parts: string[] = [];
  for (const block of flattenBlocks(content)) {
    if (block.type === "hero") {
      const { heading, body } = block.props;
      parts.push(heading, body);
    }
    if (block.type === "rich_text") {
      const { heading, body } = block.props;
      parts.push(heading, richTextDocumentPlainText(body));
    }
    if (block.type === "faq") {
      const { heading, items } = block.props;
      parts.push(
        heading,
        ...items.flatMap((item) => [item.question, item.answer]),
      );
    }
    if (block.type === "card_grid") {
      const { heading, cards } = block.props;
      parts.push(heading, ...cards.flatMap((card) => [card.title, card.body]));
    }
    if (block.type === "proof") {
      const { body, name, context } = block.props;
      parts.push(body, name, context);
    }
    if (block.type === "lead_form") {
      const { heading, body } = block.props;
      parts.push(heading, body);
    }
    if (block.type === "video") {
      const { title, caption } = block.props;
      parts.push(title, caption);
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 240);
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (value == null) continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
