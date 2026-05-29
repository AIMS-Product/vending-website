import { describe, expect, it } from "vitest";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { buildResourceLeadFormAttribution } from "./resource-lead-attribution";

const baseAttribution: LeadAttribution = {
  source_path: "/resources/start-vending?utm_source=google",
  landing_path: "/resources/start-vending",
  referrer: "https://www.google.com/",
  source_page_id: "spoofed-page-id",
  source_page_slug: "spoofed-slug",
  target_keyword: "spoofed keyword",
  source_block_id: "spoofed_block",
  source_cta_tracking_name: "spoofed_cta",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "spring",
  utm_term: "vending route",
  utm_content: "hero",
};

describe("buildResourceLeadFormAttribution", () => {
  it("preserves request attribution while forcing the actual page and lead form identity", () => {
    const attribution = buildResourceLeadFormAttribution({
      baseAttribution,
      page: {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "start-vending",
        target_keyword: "start vending business",
      },
      block: {
        id: "block_lead",
        props: { trackingName: "resource_lead_form" },
      },
    });

    expect(attribution).toEqual({
      ...baseAttribution,
      source_page_id: "11111111-1111-4111-8111-111111111111",
      source_page_slug: "start-vending",
      target_keyword: "start vending business",
      source_block_id: "block_lead",
      source_cta_tracking_name: "resource_lead_form",
    });
  });

  it("uses the resource path as source and landing attribution when no request attribution exists", () => {
    const attribution = buildResourceLeadFormAttribution({
      page: {
        id: "22222222-2222-4222-8222-222222222222",
        slug: "route-planning",
        target_keyword: null,
      },
      block: {
        id: "block_form",
        props: { trackingName: "route_planning_form" },
      },
    });

    expect(attribution).toMatchObject({
      source_path: "/resources/route-planning",
      landing_path: "/resources/route-planning",
      source_page_id: "22222222-2222-4222-8222-222222222222",
      source_page_slug: "route-planning",
      target_keyword: "",
      source_block_id: "block_form",
      source_cta_tracking_name: "route_planning_form",
      referrer: "",
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      utm_term: "",
      utm_content: "",
    });
    expect(attribution).toEqual({
      source_path: "/resources/route-planning",
      landing_path: "/resources/route-planning",
      referrer: "",
      source_page_id: "22222222-2222-4222-8222-222222222222",
      source_page_slug: "route-planning",
      target_keyword: "",
      source_block_id: "block_form",
      source_cta_tracking_name: "route_planning_form",
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      utm_term: "",
      utm_content: "",
    });
  });
});
