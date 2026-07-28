import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import {
  getGeneralRiskAssessmentTemplate,
  parseGeneralRiskAssessmentAnswers,
} from "@/lib/general-risk-assessments";
import { prisma } from "@/lib/prisma";
import { GeneralRiskAssessmentForm } from "../GeneralRiskAssessmentForm";
import { getGeneralRiskAssessmentFormOptions, iso } from "../form-data";

export default async function GeneralRiskAssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  const [assessment, options] = await Promise.all([
    prisma.generalRiskAssessment.findUnique({
      include: { participants: true },
      where: { id: assessmentId },
    }),
    getGeneralRiskAssessmentFormOptions(),
  ]);
  if (!assessment) notFound();
  const template = getGeneralRiskAssessmentTemplate(assessment.templateKey);
  if (!template) notFound();

  return (
    <AppShell
      description={`${assessment.templateCode} · Rev. ${assessment.templateRevision}`}
      title={`${assessment.templateTitle} bearbeiten`}
    >
      <GeneralRiskAssessmentForm
        {...options}
        initial={{
          answers: parseGeneralRiskAssessmentAnswers(assessment.answersJson),
          assessedEmployeeId: assessment.assessedEmployeeId ?? "",
          assessmentDate: iso(assessment.assessmentDate),
          id: assessment.id,
          instructionTopics: assessment.instructionTopics ?? "",
          location: assessment.location ?? "",
          notes: assessment.notes ?? "",
          participantDates: Object.fromEntries(
            assessment.participants.map((participant) => [
              participant.employeeId,
              iso(participant.instructionDate),
            ]),
          ),
          participantIds: assessment.participants.map(
            (participant) => participant.employeeId,
          ),
          participantSignatures: Object.fromEntries(
            assessment.participants.map((participant) => [
              participant.employeeId,
              participant.signatureDataUrl ?? "",
            ]),
          ),
          presenterName: assessment.presenterName ?? "",
          presenterSignatureDataUrl:
            assessment.presenterSignatureDataUrl ?? "",
          projectId: assessment.projectId ?? "",
          responsibleName: assessment.responsibleName ?? "",
          responsibleSignatureDataUrl:
            assessment.responsibleSignatureDataUrl ?? "",
          validityMonths: assessment.validityMonths,
        }}
        template={template}
      />
    </AppShell>
  );
}
