import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectNavigation } from "../ProjectNavigation";
import { ProjectPhotoManager } from "../ProjectPhotoManager";

export default async function ProjectPhotosPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string }>;
}) {
  const initialProjectId = (await searchParams)?.projectId ?? "";
  const [projects, photos] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ projectNumber: "asc" }],
      select: {
        id: true,
        name: true,
        projectNumber: true,
      },
    }),
    prisma.projectPhoto.findMany({
      include: {
        project: {
          select: {
            name: true,
            projectNumber: true,
          },
        },
      },
      orderBy: [{ uploadedAt: "desc" }],
    }),
  ]);

  return (
    <AppShell
      title="Projekte Fotos"
      description="Projektfotos hochladen, Notizen ergänzen, Metadaten steuern und für Bautagesberichte vormerken."
    >
      <ProjectNavigation active="photos" />

      <ProjectPhotoManager
        initialProjectId={initialProjectId}
        photos={photos.map((photo) => ({
          availableForDailyReports: photo.availableForDailyReports,
          cameraMake: photo.cameraMake,
          cameraModel: photo.cameraModel,
          capturedAt: photo.capturedAt?.toISOString() ?? null,
          fileSizeBytes: photo.fileSizeBytes,
          gpsAddressLabel: photo.gpsAddressLabel,
          gpsCity: photo.gpsCity,
          gpsCountry: photo.gpsCountry,
          gpsHouseNumber: photo.gpsHouseNumber,
          gpsLatitude: photo.gpsLatitude,
          gpsLongitude: photo.gpsLongitude,
          gpsPostcode: photo.gpsPostcode,
          gpsReverseGeocodedAt:
            photo.gpsReverseGeocodedAt?.toISOString() ?? null,
          gpsStreet: photo.gpsStreet,
          id: photo.id,
          imageHeight: photo.imageHeight,
          imageWidth: photo.imageWidth,
          metadataTaken: photo.metadataTaken,
          notes: photo.notes,
          originalFileName: photo.originalFileName,
          projectId: photo.projectId,
          projectName: photo.project.name,
          projectNumber: photo.project.projectNumber,
          publicUrl: photo.publicUrl,
          uploadedAt: photo.uploadedAt.toISOString(),
        }))}
        projects={projects.map((project) => ({
          id: project.id,
          label: `${project.projectNumber} · ${project.name}`,
        }))}
      />
    </AppShell>
  );
}
