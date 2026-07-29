import { AdminIcon, type AdminIconName } from "@/components/admin/AdminUi";
import {
  adminCardClass,
  adminPrimaryButtonClass,
} from "@/components/admin/AdminUi";

// P1-7 / I10: replaces the previous always-open form panels. Each library
// gets one compact, operator-friendly summary card with a single primary
// "Add" action that opens the library's drawer.

type LibraryCardProps = {
  icon: AdminIconName;
  name: string;
  purpose: string;
  itemCount: number;
  itemNoun: string;
  addLabel: string;
  onOpen: () => void;
};

export function LibraryCard({
  icon,
  name,
  purpose,
  itemCount,
  itemNoun,
  addLabel,
  onOpen,
}: LibraryCardProps) {
  return (
    <section className={`${adminCardClass} flex flex-col gap-4`}>
      <div className="flex items-start gap-3">
        <span
          className="text-ui-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e9f1ff]"
          aria-hidden="true"
        >
          <AdminIcon icon={icon} />
        </span>
        <div>
          <h2 className="text-ui-text text-base font-semibold">{name}</h2>
          <p className="text-ui-text-subtle mt-1 text-sm">{purpose}</p>
        </div>
      </div>
      <p className="text-ui-text-muted text-sm">
        <span className="text-ui-text text-2xl font-semibold tracking-normal">
          {itemCount}
        </span>{" "}
        {itemNoun}
      </p>
      <button
        type="button"
        className={`${adminPrimaryButtonClass} mt-auto self-start`}
        onClick={onOpen}
      >
        <span aria-hidden="true">
          <AdminIcon icon="plus" />
        </span>
        {addLabel}
      </button>
    </section>
  );
}
