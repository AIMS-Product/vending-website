"use client";

import {
  adminCardClass,
  adminInputClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import {
  META_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  newsMetaDescription,
} from "@/lib/news/seo-meta";

type NewsSeoCardProps = {
  title: string;
  excerpt: string;
  seoTitle: string;
  metaDescription: string;
  onSeoTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
};

// Optional search fields. Placeholders show what Google gets when they are
// left empty, so the editor can see whether the fallback is good enough.
export function NewsSeoCard({
  title,
  excerpt,
  seoTitle,
  metaDescription,
  onSeoTitleChange,
  onMetaDescriptionChange,
}: NewsSeoCardProps) {
  return (
    <div className={adminCardClass}>
      <h2 className="text-ui-text text-sm font-semibold">Search appearance</h2>
      <p className="text-ui-text-subtle mt-1 text-xs">
        Optional. Left empty, search uses the post title and a trimmed excerpt.
      </p>
      <label className="mt-4 block">
        <SeoLabel
          text="SEO title"
          length={seoTitle.length}
          max={SEO_TITLE_MAX}
        />
        <input
          name="seo_title"
          aria-label="SEO title"
          value={seoTitle}
          maxLength={SEO_TITLE_MAX}
          placeholder={title}
          onChange={(event) => onSeoTitleChange(event.target.value)}
          className={adminInputClass}
        />
      </label>
      <label className="mt-4 block">
        <SeoLabel
          text="Meta description"
          length={metaDescription.length}
          max={META_DESCRIPTION_MAX}
        />
        <textarea
          name="meta_description"
          aria-label="Meta description"
          value={metaDescription}
          maxLength={META_DESCRIPTION_MAX}
          rows={4}
          placeholder={newsMetaDescription({ title, excerpt }) ?? ""}
          onChange={(event) => onMetaDescriptionChange(event.target.value)}
          className={adminTextareaClass}
        />
      </label>
    </div>
  );
}

function SeoLabel({
  text,
  length,
  max,
}: {
  text: string;
  length: number;
  max: number;
}) {
  return (
    <span className="text-ui-text-muted flex justify-between text-sm font-medium">
      {text}
      <span
        aria-live="polite"
        className={`text-xs tabular-nums ${length >= max ? "text-red-600" : "text-ui-text-subtle"}`}
      >
        {length}/{max}
      </span>
    </span>
  );
}
