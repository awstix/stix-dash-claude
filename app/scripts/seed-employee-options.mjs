import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const options = [
  // Status
  ["employee_status", "active", "Aktiv", 10],
  ["employee_status", "inactive", "Inaktiv", 20],
  ["employee_status", "left", "Ausgetreten", 30],

  // Firmen
  ["employee_company", "stix_goethe", "Stix Goethe", 10],
  ["employee_company", "mainpark", "Mainpark", 20],

  // Abteilungen
  ["employee_department", "buero", "Büro", 10],
  ["employee_department", "tiefbau", "Tiefbau", 20],
  ["employee_department", "fuhrpark", "Fuhrpark / LKW", 30],
  ["employee_department", "werkstatt", "Werkstatt", 40],
  ["employee_department", "immobilien", "Immobilien", 50],

  // Geschlecht
  ["employee_gender", "female", "weiblich", 10],
  ["employee_gender", "male", "männlich", 20],
  ["employee_gender", "diverse", "divers", 30],
  ["employee_gender", "not_specified", "keine Angabe", 40],

  // Berufsbezeichnungen / Mitarbeitergruppen
  ["employee_position", "buero_abrechnung", "Büro Abrechnung", 10],
  ["employee_position", "azubi_tiefbaufacharbeiter_in", "Azubi Tiefbaufacharbeiter*in", 20],
  ["employee_position", "bauhelfer_in", "Bauhelfer*in", 30],
  ["employee_position", "buero_bauleiter_in", "Büro Bauleiter*in", 40],
  ["employee_position", "buero_bauzeichner_in", "Büro Bauzeichner*in", 50],
  ["employee_position", "buero_buchhaltung_buerofachkraft", "Büro Buchhaltung / Bürofachkraft", 60],
  ["employee_position", "chef_in", "Chef*in", 70],
  ["employee_position", "disponent_in", "Disponent*in", 80],
  ["employee_position", "buero_dualer_student_in", "Büro Duale*r Student*in", 90],
  ["employee_position", "facharbeiter_in", "Facharbeiter*in", 100],
  ["employee_position", "immobilien", "Immobilien", 110],
  ["employee_position", "kanalfacharbeiter_in", "Kanalfacharbeiter*in", 120],
  ["employee_position", "buero_buchhaltung", "Büro Buchhaltung", 130],
  ["employee_position", "buero_kalkulation", "Büro Kalkulation", 140],
  ["employee_position", "buero_personal", "Büro Personal", 150],
  ["employee_position", "werkstatt", "Werkstatt", 160],
  ["employee_position", "lkw_fahrer_in", "LKW Fahrer*in", 170],
  ["employee_position", "maschinist_in", "Maschinist*in", 180],
  ["employee_position", "strassenbauer_in", "Straßenbauer*in", 190],
  ["employee_position", "strassenbau_vorarbeiter_in", "Straßenbau Vorarbeiter*in", 200],
  ["employee_position", "buero_technische_leitung", "Büro Technische Leitung", 210],
  ["employee_position", "vermessungstechniker_in", "Vermessungstechniker*in", 220],
  ["employee_position", "vorarbeiter_in", "Vorarbeiter*in", 230],
  ["employee_position", "werkstatt_metallbau", "Werkstatt Metallbau", 240],
];

for (const [groupKey, value, label, sortOrder] of options) {
  await prisma.adminOption.upsert({
    where: {
      groupKey_value: {
        groupKey,
        value,
      },
    },
    update: {
      label,
      sortOrder,
      isActive: true,
    },
    create: {
      groupKey,
      value,
      label,
      sortOrder,
      isActive: true,
    },
  });
}

await prisma.$disconnect();

console.log("Mitarbeiter-Auswahllisten wurden angelegt.");