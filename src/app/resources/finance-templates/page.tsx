import type { Metadata } from "next";
import {
  CodedLeadMagnetPage,
  leadMagnetMetadata,
} from "@/components/sections/CodedLeadMagnetPage";
import { financeTemplatesLandingPage } from "@/lib/content/lead-magnets";
import type { LeadSearchParams } from "@/lib/lead-attribution";

export const metadata: Metadata = leadMagnetMetadata(
  financeTemplatesLandingPage,
);

export default async function FinanceTemplatesLandingPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  return (
    <CodedLeadMagnetPage
      page={financeTemplatesLandingPage}
      searchParams={searchParams}
    />
  );
}
