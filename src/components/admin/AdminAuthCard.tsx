import type { ReactNode } from "react";
import {
  adminCardClass,
  adminEyebrowClass,
  adminPageTitleClass,
} from "@/components/admin/AdminUi";
import { cn } from "@/lib/utils";

/**
 * The one frame for every signed-out Studio screen: sign in, forgot
 * password and set password share the canvas ground, the "Vendingpreneurs
 * Studio" eyebrow over the page title, and one centred card. Forgot and set
 * password used a white ground and an "S / Admin CMS" tile until 2026-09-23.
 */
export function AdminAuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      data-admin-ui
      className="bg-ui-canvas flex min-h-screen w-full flex-col items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-sm">
        <header className="mb-5">
          <p className={adminEyebrowClass}>Vendingpreneurs Studio</p>
          <h1 className={`${adminPageTitleClass} mt-1.5`}>{title}</h1>
          {description ? (
            <p className="text-ui-text-muted mt-2 text-sm leading-6">
              {description}
            </p>
          ) : null}
        </header>

        <div className={cn(adminCardClass, "p-5")}>{children}</div>
      </div>
    </section>
  );
}
