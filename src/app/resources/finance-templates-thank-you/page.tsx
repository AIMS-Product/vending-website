import type { Metadata } from "next";
import {
  CodedLeadMagnetPage,
  leadMagnetMetadata,
} from "@/components/sections/CodedLeadMagnetPage";
import { financeTemplatesThankYouPage } from "@/lib/content/lead-magnets";
import type { LeadSearchParams } from "@/lib/lead-attribution";

export const metadata: Metadata = leadMagnetMetadata(
  financeTemplatesThankYouPage,
);

export default async function FinanceTemplatesThankYouPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  return (
    <CodedLeadMagnetPage
      page={financeTemplatesThankYouPage}
      searchParams={searchParams}
    />
  );
}
