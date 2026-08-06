import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma.ts";

async function main() {
  const backupDir = path.resolve(process.cwd(), "..", "backups");
  mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(backupDir, `stix-dashboard-backup-${timestamp}.json`);

  const dump = {};
  let totalRows = 0;

  for (const model of Prisma.dmmf.datamodel.models) {
    const delegateName = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    const delegate = prisma[delegateName];
    if (!delegate?.findMany) continue;

    const rows = await delegate.findMany();
    dump[model.name] = rows;
    totalRows += rows.length;
    console.log(`  ${model.name}: ${rows.length} Zeilen`);
  }

  writeFileSync(outputPath, JSON.stringify(dump, null, 2), "utf8");

  console.log(`\nBackup gespeichert: ${outputPath}`);
  console.log(`Insgesamt ${totalRows} Zeilen gesichert.`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
