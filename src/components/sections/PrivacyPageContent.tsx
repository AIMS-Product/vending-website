import { FinalCta } from "@/components/sections/FinalCta";
import { LegalDocument } from "@/components/sections/LegalDocument";
import { privacy } from "@/lib/content/privacy";

export function PrivacyPageContent() {
  return (
    <>
      <LegalDocument doc={privacy} />
      <FinalCta />
    </>
  );
}
