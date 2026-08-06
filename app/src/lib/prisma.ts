import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Kleines, festes Verbindungslimit pro Server-Instanz: Supabases Session-
// Pooler erlaubt insgesamt nur 15 Clients, und jede Serverless-Instanz auf
// Vercel würde sonst ihren eigenen vollen Pool aufmachen.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
  max: 3,
});

// Immer global cachen (auch in production): auf Vercel bleibt globalThis
// über warme Serverless-Aufrufe hinweg erhalten, ohne das würde jede
// Anfrage einen neuen PrismaClient samt eigenem Connection-Pool anlegen.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

globalForPrisma.prisma = prisma;
