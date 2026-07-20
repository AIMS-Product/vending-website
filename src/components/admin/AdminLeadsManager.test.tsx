import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminLeadDetailView, AdminLeadsManager } from "./AdminLeadsManager";
import type {
  AdminLeadDetail,
  AdminLeadListItem,
} from "@/lib/services/lead-admin";

vi.mock("@/app/admin/leads/actions", () => ({
  retryCloseSyncEvent: vi.fn(),
  deleteLead: vi.fn(),
}));

const lead: AdminLeadListItem = {
  id: "lead_1",
  fullName: "Jane Buyer",
  email: "buyer@example.com",
  phone: "555-0101",
  lifecycleStatus: "qualification_pending",
  qualificationStatus: "in_progress",
  closeSyncStatus: "failed",
  closeSyncLastError: "Close API key is not configured.",
  sourcePath: "/resources/vending-machine-cost",
  landingPath: "/resources/vending-machine-cost",
  sourcePageSlug: "vending-machine-cost",
  sourceBlockId: "lead_block_1",
  sourceCtaTrackingName: "hero-lead-form",
  vpSessionId: "vp-session-1",
  firstLandingPath: "/resources/vending-machine-cost",
  latestLandingPath: "/apply",
  clickedHref: "/apply",
  paidPlatform: "google_ads",
  paidSourceKey: "google_ads:camp-1:group-1:ad-1",
  campaignId: "camp-1",
  adsetId: null,
  adGroupId: "group-1",
  groupId: "group-1",
  adId: "ad-1",
  gclid: "gclid-1",
  fbclid: null,
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "starter-kit",
  experimentKey: "pricing-page",
  variantKey: "hero-a",
  createdAt: "2026-06-17T09:00:00.000Z",
  latestCloseSyncEvent: {
    id: "event_1",
    status: "failed",
    eventType: "lead_create_or_update",
    lastError: "Close API key is not configured.",
    nextRetryAt: "2026-06-17T09:05:00.000Z",
    syncedAt: null,
  },
};

const detail: AdminLeadDetail = {
  ...lead,
  message: null,
  stateRegion: "SA",
  businessStage: null,
  budget: null,
  timeline: null,
  qualificationSummary: { state_market: "SA" },
  sessions: [
    {
      id: "session_1",
      status: "in_progress",
      answerCount: 1,
      currentQuestionId: "budget",
      normalizedSummary: { state_market: "SA" },
      experimentKey: "pricing-page",
      variantKey: "hero-a",
      startedAt: "2026-06-17T09:00:00.000Z",
      completedAt: null,
      staleAt: "2026-06-24T09:00:00.000Z",
      expiresAt: "2026-07-17T09:00:00.000Z",
    },
  ],
  answers: [
    {
      id: "answer_1",
      questionId: "state",
      questionLabel: "Which state or market are you focused on?",
      questionType: "state_region",
      normalizedRole: "state_market",
      displayValue: "SA",
      answeredAt: "2026-06-17T09:02:00.000Z",
    },
  ],
  closeSyncEvents: [
    {
      id: "event_1",
      status: "failed",
      eventType: "lead_create_or_update",
      lastError: "Close API key is not configured.",
      nextRetryAt: "2026-06-17T09:05:00.000Z",
      syncedAt: null,
    },
  ],
};

describe("AdminLeadsManager", () => {
  it("renders lead identity, lifecycle, sync state, source attribution, and filters", () => {
    const html = renderToStaticMarkup(
      <AdminLeadsManager
        leads={[lead]}
        activeLifecycleStatus="all"
        activeCloseSyncStatus="all"
      />,
    );

    expect(html).toContain("Jane Buyer");
    expect(html).toContain("buyer@example.com");
    expect(html).toContain("Qualification pending");
    expect(html).toContain("Failed");
    expect(html).toContain("/resources/vending-machine-cost");
    expect(html).toContain("pricing-page");
    expect(html).toContain("hero-a");
    expect(html).toContain("Failed sync");
    expect(html).toContain('href="/admin/leads/lead_1"');
  });

  it("does not render CSV, dashboards, reports, or A/B winner UI", () => {
    const html = renderToStaticMarkup(
      <AdminLeadsManager
        leads={[lead]}
        activeLifecycleStatus="all"
        activeCloseSyncStatus="all"
      />,
    );

    expect(html).not.toContain("CSV");
    expect(html).not.toContain("Dashboard");
    expect(html).not.toContain("Winner");
    expect(html).not.toContain("Attribution report");
  });
});

describe("AdminLeadDetailView", () => {
  it("renders qualification answer snapshots and retry controls", () => {
    const html = renderToStaticMarkup(<AdminLeadDetailView lead={detail} />);

    expect(html).toContain("Which state or market are you focused on?");
    expect(html).toContain("SA");
    expect(html).toContain("Close API key is not configured.");
    expect(html).toContain("Retry sync");
    expect(html).toContain("pricing-page");
    expect(html).toContain("hero-a");
    expect(html).toContain("vp-session-1");
    expect(html).toContain("google_ads:camp-1:group-1:ad-1");
    expect(html).toContain("gclid-1");
  });

  it("does not nest a second main or complementary landmark inside AdminShell (I2)", () => {
    const html = renderToStaticMarkup(<AdminLeadDetailView lead={detail} />);

    expect(html).not.toMatch(/<main[\s>]/);
    expect(html).not.toMatch(/<aside[\s>]/);
  });

  it("groups ad-tech fields under a plain-language heading with technical terms secondary (I6b)", () => {
    const html = renderToStaticMarkup(<AdminLeadDetailView lead={detail} />);

    expect(html).toContain("Where this lead came from");
    expect(html).toContain("Campaign source");
    expect(html).toContain("(utm_source)");
    expect(html).toContain("Google click ID");
    expect(html).toContain("(GCLID)");
    expect(html).toContain("Facebook click ID");
    expect(html).toContain("(FBCLID)");
  });

  it("renders a plain-language permanently-failed label for dead_letter Close sync status (I6a)", () => {
    const deadLetterDetail: AdminLeadDetail = {
      ...detail,
      closeSyncStatus: "dead_letter",
      closeSyncEvents: [
        {
          id: "event_2",
          status: "dead_letter",
          eventType: "lead_create_or_update",
          lastError: "Close API key is not configured.",
          nextRetryAt: null,
          syncedAt: null,
        },
      ],
    };
    const html = renderToStaticMarkup(
      <AdminLeadDetailView lead={deadLetterDetail} />,
    );

    expect(html).toContain("Permanently failed");
    expect(html).toContain(
      "We stopped retrying after repeated failures — needs manual attention.",
    );
    expect(html).not.toContain("Dead letter");
  });
});

describe("AdminLeadsManager sync issues banner (I7)", () => {
  it("renders a prominent alert banner with a jump link when sync failures exist", () => {
    const html = renderToStaticMarkup(
      <AdminLeadsManager
        leads={[lead]}
        activeLifecycleStatus="all"
        activeCloseSyncStatus="all"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("stuck because Close");
    expect(html).toContain('href="#sync-issues-table"');
    expect(html).toContain("Fix now");
    expect(html).toContain('id="sync-issues-table"');
  });

  it("renders no banner when there are zero sync failures", () => {
    const healthyLead: AdminLeadListItem = {
      ...lead,
      closeSyncStatus: "synced",
      closeSyncLastError: null,
      latestCloseSyncEvent: null,
    };
    const html = renderToStaticMarkup(
      <AdminLeadsManager
        leads={[healthyLead]}
        activeLifecycleStatus="all"
        activeCloseSyncStatus="all"
      />,
    );

    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Fix now");
  });

  it("uses the permanently-failed filter label instead of dead letter jargon", () => {
    const html = renderToStaticMarkup(
      <AdminLeadsManager
        leads={[lead]}
        activeLifecycleStatus="all"
        activeCloseSyncStatus="all"
      />,
    );

    expect(html).toContain("Permanently failed");
    expect(html).not.toContain("Dead letter");
  });
});
