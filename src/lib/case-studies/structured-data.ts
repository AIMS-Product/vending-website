import type { CaseStudy } from "@/lib/services/case-studies";
import { absoluteUrl } from "@/lib/site";

type StructuredDataInput = Pick<
  CaseStudy,
  | "slug"
  | "title"
  | "member_name"
  | "excerpt"
  | "youtube_video_id"
  | "cover_url"
  | "published_at"
>;

/**
 * VideoObject only.
 *
 * These pages are video-first, and VideoObject is the schema that actually
 * earns a rich result for them. We deliberately do NOT emit Review or
 * AggregateRating: the revenue figures are self-reported and unaudited, and
 * marking them up as ratings would be a structured-data claim we cannot
 * stand behind.
 */
export function caseStudyStructuredData(caseStudy: StructuredDataInput) {
  if (!caseStudy.youtube_video_id) return null;

  const thumbnail =
    caseStudy.cover_url ??
    `https://i.ytimg.com/vi/${caseStudy.youtube_video_id}/maxresdefault.jpg`;

  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${caseStudy.member_name}: ${caseStudy.title}`,
    description: caseStudy.excerpt ?? caseStudy.title,
    thumbnailUrl: [thumbnail],
    uploadDate: caseStudy.published_at ?? undefined,
    embedUrl: `https://www.youtube.com/embed/${caseStudy.youtube_video_id}`,
    contentUrl: `https://www.youtube.com/watch?v=${caseStudy.youtube_video_id}`,
    url: absoluteUrl(`/case-studies/${caseStudy.slug}`),
    publisher: {
      "@type": "Organization",
      name: "Vendingpreneurs",
      url: absoluteUrl("/"),
    },
  };
}
