import * as XLSX from "xlsx";
import { inflateRawSync } from "zlib";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date | null) {
  if (!date) return "";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getTrainingState(validUntil: Date | null) {
  if (!validUntil) return "ohne Ablauf";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 60);

  if (validUntil < today) return "abgelaufen";
  if (validUntil <= soon) return "läuft bald ab";
  return "gültig";
}

type TrainingRecordForValidity = {
  createdAt?: Date;
  topic?: string;
  trainingDate: Date | null;
  validUntil: Date | null;
};

type TrainingValidityLevel =
  | "validMoreThan50"
  | "validMoreThan25"
  | "validLessThan25"
  | "expired"
  | "withoutExpiry";

type StyledCell = XLSX.CellObject & {
  s?: Record<string, unknown>;
};

const MATRIX_STYLE_IDS = {
  header: 1,
  validMoreThan50: 2,
  validMoreThan25: 3,
  validLessThan25: 4,
  expired: 5,
  withoutExpiry: 6,
} as const satisfies Record<TrainingValidityLevel | "header", number>;

function getTrainingValidityLevel(
  record: TrainingRecordForValidity,
): TrainingValidityLevel {
  if (!record.validUntil) return "withoutExpiry";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validUntil = new Date(record.validUntil);
  validUntil.setHours(0, 0, 0, 0);

  if (validUntil < today) return "expired";

  if (record.trainingDate) {
    const trainingDate = new Date(record.trainingDate);
    trainingDate.setHours(0, 0, 0, 0);

    const totalRuntime = validUntil.getTime() - trainingDate.getTime();
    if (totalRuntime > 0) {
      const remainingRuntime = validUntil.getTime() - today.getTime();
      const remainingRatio = remainingRuntime / totalRuntime;

      if (remainingRatio > 0.5) return "validMoreThan50";
      if (remainingRatio > 0.25) return "validMoreThan25";
      return "validLessThan25";
    }
  }

  const remainingDays = Math.ceil(
    (validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (remainingDays > 180) return "validMoreThan50";
  if (remainingDays > 90) return "validMoreThan25";
  return "validLessThan25";
}

function getTrainingValidityLabel(level: TrainingValidityLevel) {
  switch (level) {
    case "validMoreThan50":
      return "gültig >50%";
    case "validMoreThan25":
      return "gültig >25%";
    case "validLessThan25":
      return "gültig <25%";
    case "expired":
      return "abgelaufen";
    case "withoutExpiry":
      return "ohne Ablauf";
  }
}

function getTrainingCellStyle(level: TrainingValidityLevel) {
  switch (level) {
    case "validMoreThan50":
      return {
        fill: { fgColor: { rgb: "C6EFCE" }, patternType: "solid" },
        font: { color: { rgb: "006100" }, bold: true },
      };
    case "validMoreThan25":
      return {
        fill: { fgColor: { rgb: "FFF2CC" }, patternType: "solid" },
        font: { color: { rgb: "7F6000" }, bold: true },
      };
    case "validLessThan25":
      return {
        fill: { fgColor: { rgb: "FCE4D6" }, patternType: "solid" },
        font: { color: { rgb: "9C5700" }, bold: true },
      };
    case "expired":
      return {
        fill: { fgColor: { rgb: "FFC7CE" }, patternType: "solid" },
        font: { color: { rgb: "9C0006" }, bold: true },
      };
    case "withoutExpiry":
      return {
        fill: { fgColor: { rgb: "E7E6E6" }, patternType: "solid" },
        font: { color: { rgb: "666666" }, bold: true },
      };
  }
}

function applyCellStyle(
  sheet: XLSX.WorkSheet,
  rowIndex: number,
  columnIndex: number,
  style: Record<string, unknown>,
) {
  const address = XLSX.utils.encode_cell({
    c: columnIndex,
    r: rowIndex,
  });

  const cell = sheet[address] as StyledCell | undefined;
  if (!cell) return;

  cell.s = {
    ...(cell.s ?? {}),
    ...style,
  };
}

function getCellRef(rowIndex: number, columnIndex: number) {
  return XLSX.utils.encode_cell({
    c: columnIndex,
    r: rowIndex,
  });
}

function getStyleIdForLevel(level: TrainingValidityLevel) {
  return MATRIX_STYLE_IDS[level];
}

function makeStyledXlsx(
  buffer: Buffer,
  stylesBySheet: Record<string, Map<string, number>>,
) {
  const entries = readZipEntries(buffer);
  const styleEntry = entries.find((entry) => entry.name === "xl/styles.xml");

  if (styleEntry) {
    styleEntry.data = Buffer.from(createWorkbookStylesXml(), "utf8");
  }

  for (const [sheetPath, cellStyles] of Object.entries(stylesBySheet)) {
    const sheetEntry = entries.find((entry) => entry.name === sheetPath);
    if (!sheetEntry) continue;

    let xml = sheetEntry.data.toString("utf8");
    for (const [cellRef, styleId] of cellStyles.entries()) {
      xml = applyCellStyleToWorksheetXml(xml, cellRef, styleId);
    }
    sheetEntry.data = Buffer.from(xml, "utf8");
  }

  return writeZipEntries(entries);
}

function applyCellStyleToWorksheetXml(
  xml: string,
  cellRef: string,
  styleId: number,
) {
  const escapedRef = cellRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cellRegex = new RegExp(`<c\\b([^>]*)\\br="${escapedRef}"([^>]*)>`);

  return xml.replace(cellRegex, (_match, before: string, after: string) => {
    const attributes = `${before} r="${cellRef}"${after}`.replace(
      /\s+s="[^"]*"/g,
      "",
    );
    return `<c${attributes} s="${styleId}">`;
  });
}

function createWorkbookStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="111827"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="006100"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="7F6000"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="9C5700"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="9C0006"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F3F4F6"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="C6EFCE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2CC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FCE4D6"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFC7CE"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="5" fillId="6" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleMedium4"/>
</styleSheet>`;
}

type ZipEntry = {
  data: Buffer;
  name: string;
};

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Ungültige XLSX-Zentralstruktur.");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart =
      localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
    const data =
      compressionMethod === 8
        ? inflateRawSync(compressedData)
        : Buffer.from(compressedData);

    entries.push({
      data,
      name,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Ungültige XLSX-Datei.");
}

function writeZipEntries(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + entry.data.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_value, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function matchesMatrixStatus(
  record: TrainingRecordForValidity,
  matrixStatus: string,
) {
  const level = getTrainingValidityLevel(record);

  if (matrixStatus === "valid") {
    return (
      level === "validMoreThan50" ||
      level === "validMoreThan25" ||
      level === "validLessThan25"
    );
  }

  return level === matrixStatus;
}

function getRecordActualityTime(record: {
  createdAt: Date;
  trainingDate: Date | null;
  validUntil: Date | null;
}) {
  return (
    record.trainingDate?.getTime() ??
    record.validUntil?.getTime() ??
    record.createdAt.getTime()
  );
}

function getLatestTrainingRecords<
  TRecord extends {
    createdAt: Date;
    topic: string;
    trainingDate: Date | null;
    validUntil: Date | null;
  },
>(records: TRecord[]) {
  const latestByTopic = new Map<string, TRecord>();

  for (const record of records) {
    const key = record.topic.trim().toLowerCase();
    const current = latestByTopic.get(key);

    if (!current || getRecordActualityTime(record) > getRecordActualityTime(current)) {
      latestByTopic.set(key, record);
    }
  }

  return Array.from(latestByTopic.values()).sort((a, b) =>
    a.topic.localeCompare(b.topic, "de"),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode")?.trim() ?? "";
  const matrixCompany = url.searchParams.get("matrixCompany")?.trim() ?? "";
  const matrixDepartment =
    url.searchParams.get("matrixDepartment")?.trim() ?? "";
  const matrixQuery =
    url.searchParams.get("matrixQuery")?.trim().toLowerCase() ?? "";
  const matrixStatus = url.searchParams.get("matrixStatus")?.trim() ?? "";
  const employees = await prisma.employee.findMany({
    where: {
      statusValue: "active",
    },
    include: {
      trainingRecords: {
        orderBy: [{ topic: "asc" }, { validUntil: "desc" }],
      },
    },
    orderBy: [{ companyLabel: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
  const latestTrainingRecordsByEmployeeId = new Map(
    employees.map((employee) => [
      employee.id,
      getLatestTrainingRecords(employee.trainingRecords),
    ]),
  );
  const exportEmployees = employees.filter((employee) => {
    if (matrixCompany && employee.companyLabel !== matrixCompany) return false;
    if (matrixDepartment && employee.departmentLabel !== matrixDepartment) {
      return false;
    }

    if (matrixQuery) {
      const searchableText = [
        employee.companyLabel,
        employee.departmentLabel,
        employee.firstName,
        employee.lastName,
        ...(latestTrainingRecordsByEmployeeId.get(employee.id) ?? []).map(
          (record) => record.topic,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(matrixQuery)) return false;
    }

    if (matrixStatus) {
      return (latestTrainingRecordsByEmployeeId.get(employee.id) ?? []).some((record) =>
        matchesMatrixStatus(record, matrixStatus),
      );
    }

    return true;
  });
  const trainingTopics = await prisma.employeeTrainingRecord.findMany({
    distinct: ["topic"],
    orderBy: [{ topic: "asc" }],
    select: {
      topic: true,
    },
  });
  const workbook = XLSX.utils.book_new();
  const employeesForWorkbook = mode === "due" ? employees : exportEmployees;
  const dueRows = employees
    .flatMap((employee) =>
      (latestTrainingRecordsByEmployeeId.get(employee.id) ?? [])
        .map((record) => {
          const state = getTrainingState(record.validUntil);
          return {
            Abteilung: employee.departmentLabel ?? "",
            Firma: employee.companyLabel ?? "",
            Nachname: employee.lastName,
            Schulung: record.topic,
            Status: state,
            Vorname: employee.firstName,
            "gültig bis": formatDate(record.validUntil),
            validUntil: record.validUntil,
          };
        })
        .filter(
          (row) => row.Status === "abgelaufen" || row.Status === "läuft bald ab",
        ),
    )
    .sort((a, b) => {
      if (!a.validUntil && !b.validUntil) return 0;
      if (!a.validUntil) return 1;
      if (!b.validUntil) return -1;
      return a.validUntil.getTime() - b.validUntil.getTime();
    });

  if (mode === "due") {
    const dueSheet = XLSX.utils.json_to_sheet(
      dueRows.map((row) => ({
        Abteilung: row.Abteilung,
        Firma: row.Firma,
        Nachname: row.Nachname,
        Schulung: row.Schulung,
        Status: row.Status,
        Vorname: row.Vorname,
        "gültig bis": row["gültig bis"],
      })),
      {
        header: [
          "Status",
          "Firma",
          "Abteilung",
          "Vorname",
          "Nachname",
          "Schulung",
          "gültig bis",
        ],
      },
    );
    dueSheet["!cols"] = [
      { wch: 18 },
      { wch: 22 },
      { wch: 24 },
      { wch: 20 },
      { wch: 22 },
      { wch: 50 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(workbook, dueSheet, "Fälligkeiten");

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    return new Response(buffer, {
      headers: {
        "Content-Disposition":
          'attachment; filename="mitarbeiterzertifikate-faelligkeiten.xlsx"',
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  }

  const shortRows = employeesForWorkbook.map((employee) => ({
    Firma: employee.companyLabel ?? "",
    Abteilung: employee.departmentLabel ?? "",
    Vorname: employee.firstName,
    Nachname: employee.lastName,
    Schulungen: (latestTrainingRecordsByEmployeeId.get(employee.id) ?? [])
      .map((record) => `${record.topic}${record.validUntil ? ` bis ${formatDate(record.validUntil)}` : ""}`)
      .join("; "),
    "bald fällig / abgelaufen": (
      latestTrainingRecordsByEmployeeId.get(employee.id) ?? []
    )
      .filter((record) => {
        const state = getTrainingState(record.validUntil);
        return state === "abgelaufen" || state === "läuft bald ab";
      })
      .map((record) => record.topic)
      .join("; "),
  }));
  const shortSheet = XLSX.utils.json_to_sheet(shortRows, {
    header: [
      "Firma",
      "Abteilung",
      "Vorname",
      "Nachname",
      "Schulungen",
      "bald fällig / abgelaufen",
    ],
  });

  shortSheet["!cols"] = [
    { wch: 22 },
    { wch: 24 },
    { wch: 20 },
    { wch: 22 },
    { wch: 80 },
    { wch: 50 },
  ];

  XLSX.utils.book_append_sheet(workbook, shortSheet, "Kurzliste");

  const matrixRows = employeesForWorkbook.map((employee) => {
    const row: Record<string, string> = {
      Firma: employee.companyLabel ?? "",
      Abteilung: employee.departmentLabel ?? "",
      Vorname: employee.firstName,
      Nachname: employee.lastName,
    };

    for (const topic of trainingTopics) {
      const record = (latestTrainingRecordsByEmployeeId.get(employee.id) ?? []).find(
        (item) => item.topic === topic.topic,
      );

      if (!record) {
        row[topic.topic] = "";
      } else if (matrixStatus && !matchesMatrixStatus(record, matrixStatus)) {
        row[topic.topic] = "";
      } else {
        const dateLabel = record.validUntil
          ? formatDate(record.validUntil)
          : "ohne Ablauf";
        row[topic.topic] = `${dateLabel} · ${getTrainingValidityLabel(
          getTrainingValidityLevel(record),
        )}`;
      }
    }

    return row;
  });
  const matrixHeaders = [
    "Firma",
    "Abteilung",
    "Vorname",
    "Nachname",
    ...trainingTopics.map((topic) => topic.topic),
  ];
  const matrixSheet = XLSX.utils.json_to_sheet(matrixRows, {
    header: matrixHeaders,
  });
  const matrixCellStyles = new Map<string, number>();

  matrixSheet["!cols"] = matrixHeaders.map((header, index) => ({
    wch: index < 4 ? 22 : Math.min(34, Math.max(14, header.length + 2)),
  }));

  matrixSheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: matrixHeaders.length - 1, r: employeesForWorkbook.length },
    }),
  };

  for (let columnIndex = 0; columnIndex < matrixHeaders.length; columnIndex += 1) {
    matrixCellStyles.set(getCellRef(0, columnIndex), MATRIX_STYLE_IDS.header);
    applyCellStyle(matrixSheet, 0, columnIndex, {
      fill: { fgColor: { rgb: "F3F4F6" }, patternType: "solid" },
      font: { color: { rgb: "111827" }, bold: true },
    });
  }

  employeesForWorkbook.forEach((employee, employeeIndex) => {
    trainingTopics.forEach((topic, topicIndex) => {
      const record = (latestTrainingRecordsByEmployeeId.get(employee.id) ?? []).find(
        (item) => item.topic === topic.topic,
      );

      if (!record) return;
      if (matrixStatus && !matchesMatrixStatus(record, matrixStatus)) return;
      matrixCellStyles.set(
        getCellRef(employeeIndex + 1, topicIndex + 4),
        getStyleIdForLevel(getTrainingValidityLevel(record)),
      );

      applyCellStyle(
        matrixSheet,
        employeeIndex + 1,
        topicIndex + 4,
        getTrainingCellStyle(getTrainingValidityLevel(record)),
      );
    });
  });

  XLSX.utils.book_append_sheet(
    workbook,
    matrixSheet,
    safeSheetName("Kreuztabelle"),
  );

  const legendRows = [
    { Status: "gültig >50%", Bedeutung: "Mehr als 50% der Laufzeit übrig" },
    { Status: "gültig >25%", Bedeutung: "Mehr als 25% der Laufzeit übrig" },
    { Status: "gültig <25%", Bedeutung: "Weniger als 25% der Laufzeit übrig" },
    { Status: "abgelaufen", Bedeutung: "Gültigkeit ist abgelaufen" },
  ];
  const legendSheet = XLSX.utils.json_to_sheet(legendRows, {
    header: ["Status", "Bedeutung"],
  });
  const legendCellStyles = new Map<string, number>();
  legendSheet["!cols"] = [{ wch: 18 }, { wch: 42 }];
  ([
    "validMoreThan50",
    "validMoreThan25",
    "validLessThan25",
    "expired",
  ] as TrainingValidityLevel[]).forEach((level, index) => {
    legendCellStyles.set(getCellRef(index + 1, 0), getStyleIdForLevel(level));
    applyCellStyle(legendSheet, index + 1, 0, getTrainingCellStyle(level));
  });

  XLSX.utils.book_append_sheet(workbook, legendSheet, "Legende");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    cellStyles: true,
    type: "buffer",
  });
  const styledBuffer = makeStyledXlsx(buffer, {
    "xl/worksheets/sheet2.xml": matrixCellStyles,
    "xl/worksheets/sheet3.xml": legendCellStyles,
  });

  return new Response(styledBuffer, {
    headers: {
      "Content-Disposition":
        'attachment; filename="mitarbeiterzertifikate-export.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
