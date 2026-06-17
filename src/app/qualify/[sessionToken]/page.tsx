import type { Metadata } from "next";
import { QualificationRuntime } from "@/components/qualification/QualificationRuntime";
import {
  completeQualificationSessionAction,
  saveQualificationAnswerAction,
} from "./actions";
import { getDemoQualificationRuntimeSession } from "@/lib/qualification/demo-runtime";
import { loadQualificationSessionForToken } from "@/lib/services/qualification-sessions";

type Params = { sessionToken: string };

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Qualification",
  robots: { index: false, follow: false },
};

export default async function QualificationPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { sessionToken } = await params;
  const session =
    getDemoQualificationRuntimeSession(sessionToken) ??
    (await loadQualificationSessionForToken({ sessionToken }));

  if (session.status === "unavailable") {
    return (
      <div
        className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16 text-slate-950"
        data-hide-site-header="true"
        data-hide-site-footer="true"
      >
        <p className="text-sm font-semibold text-[#0b63f6]">Vendingpreneurs</p>
        <h1 className="mt-3 text-3xl font-semibold">
          Qualification unavailable
        </h1>
        <p className="mt-4 text-base text-slate-600">
          This qualification link is no longer available. Submit the contact
          form again to continue.
        </p>
      </div>
    );
  }

  return (
    <div data-hide-site-header="true" data-hide-site-footer="true">
      <QualificationRuntime
        session={session}
        sessionToken={sessionToken}
        saveAction={saveQualificationAnswerAction.bind(null, sessionToken)}
        completeAction={completeQualificationSessionAction.bind(
          null,
          sessionToken,
        )}
      />
    </div>
  );
}
