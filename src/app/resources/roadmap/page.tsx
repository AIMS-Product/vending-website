import type { Metadata } from "next";
import {
  CodedLeadMagnetPage,
  leadMagnetMetadata,
} from "@/components/sections/CodedLeadMagnetPage";
import { roadmapLandingPage } from "@/lib/content/lead-magnets";
import type { LeadSearchParams } from "@/lib/lead-attribution";

export const metadata: Metadata = leadMagnetMetadata(roadmapLandingPage);

export default async function RoadmapLandingPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  return (
    <CodedLeadMagnetPage
      page={roadmapLandingPage}
      searchParams={searchParams}
    />
  );
}
