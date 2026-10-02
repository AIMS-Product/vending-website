"use client";

import dynamic from "next/dynamic";

// ChatWidget renders nothing until its config fetch resolves, so skipping SSR
// changes no markup; it only keeps ~40 KB of chat code out of the initial JS.
const ChatWidget = dynamic(
  () => import("./ChatWidget").then((m) => m.ChatWidget),
  { ssr: false },
);

export function ChatWidgetLoader() {
  return <ChatWidget />;
}
