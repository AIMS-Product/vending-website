import type { Metadata } from "next";
import { Stub } from "@/components/site/Stub";

export const metadata: Metadata = {
  title: "Contact Us",
};

export default function ContactPage() {
  return (
    <Stub title="Contact Us" body="The contact form lands here in Slice 4." />
  );
}
