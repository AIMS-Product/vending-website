import type { Metadata } from "next";
import { Stub } from "@/components/site/Stub";

export const metadata: Metadata = {
  title: "Apply",
  description:
    "Apply to the Vending Accelerator Program — mentorship and tools to launch a profitable vending business.",
};

export default function ApplyPage() {
  return (
    <Stub
      title="Apply to the Vending Accelerator"
      body="The application form lands here in Slice 4. For now, please email us via the contact page."
    />
  );
}
