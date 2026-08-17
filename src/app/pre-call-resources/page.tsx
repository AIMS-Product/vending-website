import type { Metadata } from "next";
import { PreCallResourcesPage } from "@/components/sections/PreCallResourcesPage";
import { preCallMeta } from "@/lib/content/pre-call-resources";

export const metadata: Metadata = {
  title: preCallMeta.title,
  description: preCallMeta.description,
  robots: {
    index: false,
    follow: false,
  },
};

export default function PreCallResources() {
  return <PreCallResourcesPage />;
}
