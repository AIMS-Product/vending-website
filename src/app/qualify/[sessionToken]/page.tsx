import type { Metadata } from "next";
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
  const session = await loadQualificationSessionForToken({ sessionToken });

  if (session.status === "unavailable") {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16 text-slate-950">
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

  const currentQuestion =
    session.questions.find(
      (question) => question.id === session.currentQuestionId,
    ) ?? session.questions[0];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16 text-slate-950">
      <p className="text-sm font-semibold text-[#0b63f6]">Vendingpreneurs</p>
      <h1 className="mt-3 text-3xl font-semibold">Qualification</h1>
      {currentQuestion ? (
        <section className="mt-8">
          <p className="text-sm text-slate-500">
            Question{" "}
            {Math.max(
              1,
              session.questions.findIndex(
                (question) => question.id === currentQuestion.id,
              ) + 1,
            )}{" "}
            of {session.questions.length}
          </p>
          <h2 className="mt-3 text-2xl font-semibold">
            {currentQuestion.label}
          </h2>
          {currentQuestion.helpText ? (
            <p className="mt-2 text-base text-slate-600">
              {currentQuestion.helpText}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="mt-8">
          <h2 className="text-2xl font-semibold">Ready to submit</h2>
          <p className="mt-2 text-base text-slate-600">
            Your qualification answers are ready to complete.
          </p>
        </section>
      )}
    </div>
  );
}
