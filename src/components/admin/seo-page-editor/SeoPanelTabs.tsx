"use client";

import { useId, useRef, useState, type ReactNode } from "react";

export type SeoPanelTab = {
  id: string;
  label: string;
  content: ReactNode;
};

// Accessible tabs for the SEO panel's scrollable content. Implements the WAI
// tab pattern: roving tabindex, Left/Right/Home/End arrow navigation, and
// aria-controls/aria-labelledby wiring. No focus trap — Tab moves out of the
// tablist to the active panel and onward.
export function SeoPanelTabs({ tabs }: { tabs: SeoPanelTab[] }) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (tabs.length === 0) return null;
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  function focusTab(id: string) {
    setActiveId(id);
    tabRefs.current[id]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const dir = event.key === "ArrowRight" ? 1 : -1;
      const next = (index + dir + tabs.length) % tabs.length;
      focusTab(tabs[next].id);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(tabs[0].id);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs[tabs.length - 1].id);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="SEO panel sections"
        className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === activeTab.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:ring-4 focus-visible:ring-[#0b63f6]/20 focus-visible:outline-none ${
                selected
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* All panels stay mounted; inactive ones are hidden (not unmounted) so
          form fields they contain — schedule, governance, hidden values — are
          never dropped from save/publish (design contract: a collapsed drawer
          must not unmount required hidden values). */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
          hidden={tab.id !== activeTab.id}
          className="focus-visible:outline-none"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
