import { AppShell } from "@/components/AppShell";
import { getGeneralRiskAssessmentTemplate } from "@/lib/general-risk-assessments";
import { GeneralRiskAssessmentForm } from "../GeneralRiskAssessmentForm";
import { getGeneralRiskAssessmentFormOptions } from "../form-data";

export default async function NewGeneralRiskAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    employeeId?: string;
    projectId?: string;
    template?: string;
  }>;
}) {
  const {
    employeeId = "",
    projectId = "",
    template: templateKey = "tiefbau",
  } = await searchParams;
  const template =
    getGeneralRiskAssessmentTemplate(templateKey) ??
    getGeneralRiskAssessmentTemplate("tiefbau")!;
  const options = await getGeneralRiskAssessmentFormOptions();
  const project = options.projects.find((item) => item.id === projectId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell
      description={`${template.code} · Rev. ${template.revision}`}
      title={`${template.title} ausfüllen`}
    >
      <GeneralRiskAssessmentForm
        {...options}
        initial={{
          answers: {},
          assessedEmployeeId: employeeId,
          assessmentDate: today,
          instructionTopics: "",
          location: "",
          notes: "",
          participantDates: {},
          participantIds: employeeId ? [employeeId] : [],
          participantSignatures: {},
          presenterName: project?.constructionManager ?? "",
          presenterSignatureDataUrl: "",
          projectId,
          responsibleName: project?.constructionManager ?? "",
          responsibleSignatureDataUrl: "",
        }}
        template={template}
      />
    </AppShell>
  );
}
