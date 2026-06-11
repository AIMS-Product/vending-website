import { redirect } from "next/navigation";

// The v2 design was promoted to the homepage. Keep the old preview URL
// working for anyone still holding the /home-v2 link.
export default function HomeV2Preview() {
  redirect("/");
}
