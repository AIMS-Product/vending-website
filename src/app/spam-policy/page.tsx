import type { Metadata } from "next";
import { LegalDocument } from "@/components/sections/LegalDocument";
import { FinalCta } from "@/components/sections/FinalCta";
import { spamPolicy } from "@/lib/content/spam-policy";
import { pageOpenGraph } from "@/lib/site";

const TITLE = "Anti-Spam Policy";
const DESCRIPTION =
  "Vendingpreneurs does not send or authorize unsolicited bulk email. How we send commercial email under the CAN-SPAM Act, how to opt out of email and SMS, and how to report abuse.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/spam-policy",
  },
  openGraph: pageOpenGraph(TITLE, DESCRIPTION, "/spam-policy"),
};

export default function SpamPolicyPage() {
  return (
    <>
      <LegalDocument doc={spamPolicy} />
      <FinalCta />
    </>
  );
}
