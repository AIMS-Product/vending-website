import type { Metadata } from "next";
import {
  contactCloneMetadata,
  renderContactClonePage,
} from "@/components/sections/contact-clone-page";
import type { LeadSearchParams } from "@/lib/lead-attribution";

export const metadata: Metadata = contactCloneMetadata();

export default function Page({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  return renderContactClonePage("booking-partner", searchParams);
}
