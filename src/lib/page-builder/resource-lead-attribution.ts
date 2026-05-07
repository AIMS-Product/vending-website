import type { LeadAttribution } from "@/lib/lead-attribution";

type ResourceLeadPage = {
  id: string;
  slug: string;
  target_keyword: string | null;
};

type ResourceLeadBlock = {
  id: string;
  props: {
    trackingName: string;
  };
};

export function buildResourceLeadFormAttribution({
  baseAttribution,
  page,
  block,
}: {
  baseAttribution?: LeadAttribution;
  page: ResourceLeadPage;
  block: ResourceLeadBlock;
}): LeadAttribution {
  const landingPath = `/resources/${page.slug}`;

  return {
    ...(baseAttribution ?? emptyResourceLeadAttribution(landingPath)),
    source_page_id: page.id,
    source_page_slug: page.slug,
    target_keyword: page.target_keyword ?? "",
    source_block_id: block.id,
    source_cta_tracking_name: block.props.trackingName,
  };
}

function emptyResourceLeadAttribution(landingPath: string): LeadAttribution {
  return {
    source_path: landingPath,
    landing_path: landingPath,
    referrer: "",
    source_page_id: "",
    source_page_slug: "",
    target_keyword: "",
    source_block_id: "",
    source_cta_tracking_name: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
  };
}
