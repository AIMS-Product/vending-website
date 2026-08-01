import type { Metadata } from "next";
import {
  CodedLeadMagnetPage,
  leadMagnetMetadata,
} from "@/components/sections/CodedLeadMagnetPage";
import { roadmapThankYouPage } from "@/lib/content/lead-magnets";
import type { LeadSearchParams } from "@/lib/lead-attribution";

export const metadata: Metadata = leadMagnetMetadata(roadmapThankYouPage);

export default async function RoadmapThankYouPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  return (
    <CodedLeadMagnetPage
      page={roadmapThankYouPage}
      searchParams={searchParams}
    />
  );
}
