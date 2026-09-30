import {
  renderReplayPage,
  replayMetadata,
} from "@/components/sections/masterclass-replay/ReplayPage";
import type { LeadSearchParams } from "@/lib/lead-attribution";

export const metadata = replayMetadata("meta");

export default function Page({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  return renderReplayPage("meta", searchParams);
}
