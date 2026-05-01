import type { Metadata } from "next";
import { Stub } from "@/components/site/Stub";

export const metadata: Metadata = {
  title: "News",
};

export default function NewsPage() {
  return <Stub title="News" />;
}
