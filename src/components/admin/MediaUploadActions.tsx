"use client";

import { useEffect, useRef, useState } from "react";
import { AdminIcon, adminPrimaryButtonClass } from "@/components/admin/AdminUi";
import {
  AddMediaModal,
  BulkUploadModal,
} from "@/components/admin/MediaLibraryManager";

export function MediaUploadActions() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  return (
    <>
      <div ref={menuRef} className="relative inline-flex shrink-0">
        <button
          type="button"
          className={`${adminPrimaryButtonClass} rounded-r-none border-r border-[#0952c9] pr-3`}
          onClick={() => {
            setMenuOpen(false);
            setUploadOpen(true);
          }}
        >
          <span aria-hidden="true">
            <AdminIcon icon="upload" />
          </span>
          Upload media
        </button>
        <button
          type="button"
          aria-label="More upload options"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className={`${adminPrimaryButtonClass} rounded-l-none px-2.5`}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m6 9 6 6 6-6"
            />
          </svg>
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute top-full right-0 z-30 mt-2 w-44 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950"
              onClick={() => {
                setMenuOpen(false);
                setUploadOpen(true);
              }}
            >
              <AdminIcon icon="plus" />
              Single upload
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950"
              onClick={() => {
                setMenuOpen(false);
                setBulkUploadOpen(true);
              }}
            >
              <AdminIcon icon="upload" />
              Bulk upload
            </button>
          </div>
        ) : null}
      </div>

      {uploadOpen ? (
        <AddMediaModal onClose={() => setUploadOpen(false)} />
      ) : null}
      {bulkUploadOpen ? (
        <BulkUploadModal onClose={() => setBulkUploadOpen(false)} />
      ) : null}
    </>
  );
}
