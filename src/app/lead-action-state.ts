export type PublicLeadActionState =
  | { status: "idle"; message?: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; message: string; leadId: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export const initialLeadActionState: PublicLeadActionState = {
  status: "idle",
};
