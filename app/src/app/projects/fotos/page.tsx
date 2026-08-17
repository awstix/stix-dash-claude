import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectNavigation } from "../ProjectNavigation";
import { ProjectPhotoManager } from "../ProjectPhotoManager";
import { getAccessibleProjectIds } from "@/lib/auth-access";

// Photo uploads run a slot+finalize Server Action call per photo (see
// uploadPhotosDirect) - give them enough headroom on slower mobile
// connections instead of the platform default.
export const maxDuration = 120;

export default async function ProjectPhotosPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string }>;
}) {
  const initialProjectId = (await searchParams)?.projectId ?? "";
  const accessibleProjectIds = await getAccessibleProjectIds();
  const projectWhere =
    accessibleProjectIds === null ? undefined : { id: { in: accessibleProjectIds } };
  const contentWhere =
    accessibleProjectIds === null
      ? undefined
      : { projectId: { in: accessibleProjectIds } };
  const [projects, photos] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      orderBy: [{ projectNumber: "asc" }],
      select: {
        id: true,
        name: true,
        projectNumber: true,
      },
    }),
    prisma.projectPhoto.findMany({
      where: contentWhere,
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
          cameraAperture: photo.cameraAperture,
          cameraExposureTime: photo.cameraExposureTime,
          cameraFocalLength: photo.cameraFocalLength,
          cameraIso: photo.cameraIso,
          capturedAt: photo.capturedAt?.toISOString() ?? null,
          fileSizeBytes: photo.fileSizeBytes,
          gpsAddressLabel: photo.gpsAddressLabel,
          gpsCity: photo.gpsCity,
          gpsCountry: photo.gpsCountry,
          gpsHouseNumber: photo.gpsHouseNumber,
          gpsLatitude: photo.gpsLatitude,
          gpsLongitude: photo.gpsLongitude,
          gpsHeading: photo.gpsHeading,
          gpsAltitude: photo.gpsAltitude,
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
          uploadedByName: photo.uploadedByName,
          uploadedByUserId: photo.uploadedByUserId,
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
