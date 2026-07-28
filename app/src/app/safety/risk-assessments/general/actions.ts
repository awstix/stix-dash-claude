"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  getGeneralRiskAssessmentTemplate,
  type GeneralRiskAssessmentAnswer,
} from "@/lib/general-risk-assessments";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  return value || null;
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Date(`${value}T12:00:00`) : null;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function validityMonthsValue(formData: FormData) {
  const value = Number.parseInt(text(formData, "validityMonths") ?? "12", 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Die Gültigkeit muss mindestens einen Monat betragen.");
  }
  return value;
}

export async function saveGeneralRiskAssessment(formData: FormData) {
  const id = text(formData, "id");
  const templateKey = text(formData, "templateKey");
  const template = templateKey
    ? getGeneralRiskAssessmentTemplate(templateKey)
    : null;
  if (!template) throw new Error("GBU-Vorlage nicht gefunden.");

  const answers: Record<string, GeneralRiskAssessmentAnswer> = {};
  for (const item of template.items) {
    if (item.kind === "heading" || item.kind === "note") continue;
    const status = text(formData, `status_${item.id}`);
    const answerText = text(formData, `text_${item.id}`);
    const usesRealisation =
      template.key === "buero" ||
      template.key === "strassenwalze" ||
      template.key === "tiefbau" ||
      template.key === "asphaltbau";
    const responsible =
      usesRealisation
        ? text(formData, `responsible_${item.id}`)
        : null;
    const implemented =
      usesRealisation &&
      formData.get(`implemented_${item.id}`)?.toString() === "on";
    if (
      status === "YES" ||
      status === "NO" ||
      status === "NOT_APPLICABLE" ||
      answerText ||
      responsible ||
      implemented
    ) {
      answers[item.id] = {
        implemented: implemented || undefined,
        responsible: responsible ?? undefined,
        status:
          status === "YES" ||
          status === "NO" ||
          status === "NOT_APPLICABLE"
            ? status
            : undefined,
        text: answerText ?? undefined,
      };
    }
  }

  const assessmentDate = dateValue(formData, "assessmentDate") ?? new Date();
  const validityMonths = validityMonthsValue(formData);
  const data = {
    answersJson: JSON.stringify(answers),
    assessedEmployeeId: text(formData, "assessedEmployeeId"),
    assessmentDate,
    instructionTopics: text(formData, "instructionTopics"),
    location: text(formData, "location"),
    notes: text(formData, "notes"),
    presenterName: text(formData, "presenterName"),
    presenterSignatureDataUrl: text(
      formData,
      "presenterSignatureDataUrl",
    ),
    projectId: text(formData, "projectId"),
    responsibleName: text(formData, "responsibleName"),
    responsibleSignatureDataUrl: text(
      formData,
      "responsibleSignatureDataUrl",
    ),
    sourcePdfPath: template.sourcePdfPath,
    status: text(formData, "submitMode") === "FINAL" ? "COMPLETED" : "DRAFT",
    templateCode: template.code,
    templateKey: template.key,
    templateRevision: template.revision,
    templateTitle: template.title,
    validityMonths,
    validUntil: addMonths(assessmentDate, validityMonths),
  };

  const assessment = id
    ? await prisma.generalRiskAssessment.update({ data, where: { id } })
    : await prisma.generalRiskAssessment.create({ data });

  const participantIds = Array.from(
    new Set(
      formData
        .getAll("participantId")
        .map((value) => value.toString())
        .filter(Boolean),
    ),
  );
  const previousParticipants =
    await prisma.generalRiskAssessmentParticipant.findMany({
      where: { assessmentId: assessment.id },
    });

  const externalFirstNames = formData.getAll("externalFirstName").map(String);
  const externalLastNames = formData.getAll("externalLastName").map(String);
  const externalCompanies = formData.getAll("externalCompany").map(String);
  const externalDates = formData.getAll("externalInstructionDate").map(String);
  const externalSignatures = formData.getAll("externalSignature").map(String);
  const externalParticipants = externalFirstNames
    .map((firstName, index) => ({
      externalCompany: externalCompanies[index]?.trim() || null,
      externalFirstName: firstName.trim(),
      externalLastName: externalLastNames[index]?.trim() || "",
      instructionDate: externalDates[index]
        ? new Date(`${externalDates[index]}T12:00:00`)
        : data.assessmentDate,
      signatureDataUrl: externalSignatures[index]?.trim() || null,
    }))
    .filter((participant) => participant.externalFirstName || participant.externalLastName);

  await prisma.$transaction([
    prisma.generalRiskAssessmentParticipant.deleteMany({
      where: {
        assessmentId: assessment.id,
        employeeId: { not: null, notIn: participantIds },
      },
    }),
    ...participantIds.map((employeeId) => {
      const previous = previousParticipants.find(
        (participant) => participant.employeeId === employeeId,
      );
      const signatureDataUrl =
        text(formData, `signature_${employeeId}`) ??
        previous?.signatureDataUrl ??
        null;
      return prisma.generalRiskAssessmentParticipant.upsert({
        create: {
          assessmentId: assessment.id,
          companyDepartment: text(
            formData,
            `companyDepartment_${employeeId}`,
          ),
          employeeId,
          instructionDate:
            dateValue(formData, `instructionDate_${employeeId}`) ??
            data.assessmentDate,
          signatureDataUrl,
          signedAt: signatureDataUrl ? new Date() : null,
        },
        update: {
          companyDepartment: text(
            formData,
            `companyDepartment_${employeeId}`,
          ),
          instructionDate:
            dateValue(formData, `instructionDate_${employeeId}`) ??
            previous?.instructionDate ??
            data.assessmentDate,
          signatureDataUrl,
          signedAt: signatureDataUrl
            ? previous?.signedAt ?? new Date()
            : null,
        },
        where: {
          assessmentId_employeeId: {
            assessmentId: assessment.id,
            employeeId,
          },
        },
      });
    }),
    ...externalParticipants.map((participant) =>
      prisma.generalRiskAssessmentParticipant.create({
        data: {
          assessmentId: assessment.id,
          ...participant,
          signedAt: participant.signatureDataUrl ? new Date() : null,
        },
      }),
    ),
  ]);
  const signedParticipants =
    await prisma.generalRiskAssessmentParticipant.findMany({
      select: { employeeId: true, instructionDate: true },
      where: {
        assessmentId: assessment.id,
        employeeId: { not: null },
        signatureDataUrl: { not: null },
      },
    });
  await Promise.all(
    signedParticipants.flatMap((participant) => {
      if (!participant.employeeId) return [];
      const trainingDate = participant.instructionDate ?? assessmentDate;
      return [prisma.employeeTrainingRecord.upsert({
        create: {
          employeeId: participant.employeeId,
          notes: `Automatisch aus Arbeitssicherheit · /safety/risk-assessments/general/${assessment.id}`,
          safetySourceKey: `general-risk:${assessment.id}:${participant.employeeId}`,
          topic: template.title,
          trainingDate,
          type: "Gefährdungsbeurteilung",
          validityMonths,
          validUntil: addMonths(trainingDate, validityMonths),
        },
        update: {
          topic: template.title,
          trainingDate,
          validityMonths,
          validUntil: addMonths(trainingDate, validityMonths),
        },
        where: {
          safetySourceKey: `general-risk:${assessment.id}:${participant.employeeId}`,
        },
      })];
    }),
  );

  revalidatePath("/safety/risk-assessments");
  revalidatePath("/safety/risk-assessments/general");
  if (assessment.projectId) {
    revalidatePath(`/projects/${assessment.projectId}`);
  }
  if (assessment.assessedEmployeeId) {
    revalidatePath(
      `/employees/certificates/${assessment.assessedEmployeeId}`,
    );
  }
  for (const employeeId of participantIds) {
    revalidatePath(`/employees/certificates/${employeeId}`);
  }
  redirect(`/safety/risk-assessments/general/${assessment.id}`);
}
