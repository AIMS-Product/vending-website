"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminAuthorizationError, requireAdmin } from "@/lib/supabase/auth";

export type CacActionState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "conflict"; message: string }
  | { status: "error"; message: string };

const CAC_PATH = "/admin/cac";

/** Blank clears the cell back to "not recorded", which is not the same as zero. */
function optionalNumber(
  raw: FormDataEntryValue | null,
  label: string,
): number | null {
  const text = String(raw ?? "")
    .trim()
    .replace(/[$,]/g, "");
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a number of zero or more, or blank.`);
  }
  return value;
}

function failure(error: unknown): CacActionState {
  if (error instanceof AdminAuthorizationError) {
    return {
      status: "error",
      message: "You do not have permission to edit this.",
    };
  }
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Could not save.",
  };
}

/** One route's input cells. Everything else on the row is derived and cannot be typed. */
export async function saveCacRoute(
  _prev: CacActionState,
  formData: FormData,
): Promise<CacActionState> {
  try {
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw new Error("Missing route id.");
    const spendSource = String(formData.get("spendSource") ?? "manual");
    if (spendSource !== "manual" && spendSource !== "auto") {
      throw new Error("Spend source must be manual or auto.");
    }
    const { error } = await createAdminClient()
      .from("cac_routes")
      .update({
        fixed_monthly_cost: optionalNumber(
          formData.get("fixedMonthlyCost"),
          "Fixed monthly cost",
        ),
        variable_spend: optionalNumber(
          formData.get("variableSpend"),
          "Variable spend",
        ),
        closed_won: optionalNumber(formData.get("closedWon"), "Closed won"),
        march_cac: optionalNumber(formData.get("marchCac"), "March CAC"),
        owner: String(formData.get("owner") ?? "").trim() || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
        spend_source: spendSource,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(CAC_PATH);
    return { status: "saved", message: "Saved." };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Month-level inputs. Leaving days elapsed blank is the point: the tracker then
 * prorates against today instead of whatever somebody last typed.
 */
export async function saveCacMonth(
  _prev: CacActionState,
  formData: FormData,
): Promise<CacActionState> {
  try {
    await requireAdmin();
    const month = String(formData.get("month") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(month)) throw new Error("Missing month.");
    const daysInMonth = optionalNumber(
      formData.get("daysInMonth"),
      "Days in month",
    );
    if (daysInMonth == null) throw new Error("Days in month is required.");
    const { error } = await createAdminClient()
      .from("cac_months")
      .update({
        days_in_month: daysInMonth,
        days_elapsed: optionalNumber(
          formData.get("daysElapsed"),
          "Days elapsed",
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("month", month);
    if (error) throw new Error(error.message);
    revalidatePath(CAC_PATH);
    return { status: "saved", message: "Saved." };
  } catch (error) {
    return failure(error);
  }
}
