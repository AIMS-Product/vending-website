import type { Metadata } from "next";
import {
  bookingMetadata,
  renderBookingPage,
} from "@/components/sections/booking-page";
import type { LeadSearchParams } from "@/lib/lead-attribution";

export const metadata: Metadata = bookingMetadata("booking-t5-socials");

export default function Page({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  return renderBookingPage("booking-t5-socials", searchParams);
}
