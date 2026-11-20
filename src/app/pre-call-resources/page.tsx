import type { Metadata } from "next";
import { BookedCallConversion } from "@/components/tracking/BookedCallConversion";
import { PreCallResourcesPage } from "@/components/sections/PreCallResourcesPage";
import { preCallMeta } from "@/lib/content/pre-call-resources";

export const metadata: Metadata = {
  title: preCallMeta.title,
  description: preCallMeta.description,
  // noindex keeps it out of search; follow lets the footer-linked page pass
  // link value on to the pages it links to.
  robots: {
    index: false,
    follow: true,
  },
};

export default function PreCallResources() {
  return (
    <>
      <BookedCallConversion />
      <PreCallResourcesPage />
    </>
  );
}
