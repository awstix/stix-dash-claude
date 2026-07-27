"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PROJECT_START_ASSESSMENT_SECTIONS } from "@/lib/project-start-checklist";

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function date(formData: FormData, name: string) {
  const value = text(formData, name);
  return value ? new Date(`${value}T00:00:00`) : null;
}

export async function saveProjectStartChecklist(formData: FormData) {
  const id = text(formData, "id");
  const projectId = text(formData, "projectId");
  if (!projectId) throw new Error("Bitte ein Projekt auswählen.");

  const participantIds = formData
    .getAll("participantId")
    .map(String)
    .filter(Boolean);
  const activities = formData.getAll("activity").map(String).filter(Boolean);
  const assessments = Object.fromEntries(
    PROJECT_START_ASSESSMENT_SECTIONS.flatMap((section) =>
      section.questions.map(([number]) => [
        number,
        String(formData.get(`assessment_${number}`) ?? ""),
      ]),
    ),
  );
  const status =
    String(formData.get("submitMode") ?? "") === "FINAL"
      ? "COMPLETED"
      : "DRAFT";
  if (
    status === "COMPLETED" &&
    Object.values(assessments).some((value) => !value)
  ) {
    throw new Error(
      "Zum Abschließen müssen alle 31 LMRA-Punkte bewertet sein.",
    );
  }

  const data = {
    activitiesJson: JSON.stringify(activities),
    assessmentsJson: JSON.stringify(assessments),
    checklistDate: date(formData, "checklistDate") ?? new Date(),
    endDate: date(formData, "endDate"),
    instructionTopics: text(formData, "instructionTopics"),
    otherActivities: text(formData, "otherActivities"),
    presenterName: text(formData, "presenterName"),
    presenterSignatureDataUrl: text(formData, "presenterSignatureDataUrl"),
    projectId,
    responsibleManager: text(formData, "responsibleManager"),
    responsibleMobile: text(formData, "responsibleMobile"),
    responsiblePhone: text(formData, "responsiblePhone"),
    sitePostalCity: text(formData, "sitePostalCity"),
    siteStreet: text(formData, "siteStreet"),
    startDate: date(formData, "startDate"),
    status,
  };

  const checklist = id
    ? await prisma.projectStartChecklist.update({ data, where: { id } })
    : await prisma.projectStartChecklist.create({ data });

  const existingParticipants =
    await prisma.projectStartChecklistParticipant.findMany({
      where: { checklistId: checklist.id },
    });

  await prisma.$transaction(
    participantIds.map((employeeId) => {
      const signatureDataUrl = text(formData, `signature_${employeeId}`);
      const previous = existingParticipants.find(
        (participant) => participant.employeeId === employeeId,
      );
      const instructionDate =
        date(formData, `instructionDate_${employeeId}`) ??
        previous?.instructionDate ??
        data.checklistDate;
      const signatureChanged =
        Boolean(signatureDataUrl) &&
        signatureDataUrl !== previous?.signatureDataUrl;

      return prisma.projectStartChecklistParticipant.upsert({
        create: {
          checklistId: checklist.id,
          companyDepartment: text(
            formData,
            `companyDepartment_${employeeId}`,
          ),
          employeeId,
          instructionDate,
          signatureDataUrl,
          signedAt: signatureDataUrl ? new Date() : null,
        },
        update: {
          companyDepartment: text(
            formData,
            `companyDepartment_${employeeId}`,
          ),
          instructionDate,
          signatureDataUrl: signatureDataUrl ?? previous?.signatureDataUrl,
          signedAt: signatureChanged
            ? new Date()
            : previous?.signedAt ?? (signatureDataUrl ? new Date() : null),
        },
        where: {
          checklistId_employeeId: {
            checklistId: checklist.id,
            employeeId,
          },
        },
      });
    }),
  );

  revalidatePath("/safety/risk-assessments");
  revalidatePath("/safety/risk-assessments/project-start");
  redirect(`/safety/risk-assessments/project-start/${checklist.id}`);
}
