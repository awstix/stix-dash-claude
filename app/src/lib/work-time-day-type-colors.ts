// Historisch gewachsene, feste Farbnamen (früher als Tailwind-Klassen hinterlegt).
// Bleiben als Zuordnung erhalten, damit bestehende Planzeiten ihre Farbe behalten –
// neue Planzeiten speichern direkt einen Hex-Code in colorKey.
const legacyColorHexByKey: Record<string, string> = {
  amber: "#d97706",
  blue: "#2563eb",
  gray: "#6b7280",
  green: "#16a34a",
  orange: "#ea580c",
  pink: "#db2777",
  red: "#dc2626",
  slate: "#475569",
  teal: "#0d9488",
  violet: "#7c3aed",
};

export const defaultWorkTimeDayTypeColor = "#6b7280";

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** Wandelt einen gespeicherten colorKey (alter Farbname ODER Hex-Code) in einen
 * verwendbaren Hex-Code um. Unbekannte Werte fallen auf Grau zurück. */
export function normalizeWorkTimeDayTypeColor(value: string | null | undefined): string {
  if (!value) return defaultWorkTimeDayTypeColor;
  if (isHexColor(value)) return value.toLowerCase();
  return legacyColorHexByKey[value] ?? defaultWorkTimeDayTypeColor;
}

/** Lesbare Textfarbe (schwarz/weiß) je nach Helligkeit des Hintergrunds. */
function contrastTextColor(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

export function getWorkTimeDayTypeColor(value: string | null | undefined) {
  const backgroundColor = normalizeWorkTimeDayTypeColor(value);
  return { backgroundColor, color: contrastTextColor(backgroundColor) };
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(color * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** 10x10-Farbmuster: 9 Buntton-Spalten (voller Kreis) + 1 Graustufen-Spalte,
 * je 10 Zeilen von hell nach dunkel/kräftig – insgesamt 100 frei wählbare Farben. */
export function buildWorkTimeDayTypeColorPalette(): string[][] {
  const rows: string[][] = [];
  const lightnessSteps = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36, 0.28, 0.2];
  const hueCount = 9;

  for (const lightness of lightnessSteps) {
    const row: string[] = [];
    for (let hueIndex = 0; hueIndex < hueCount; hueIndex += 1) {
      const hue = (hueIndex * 360) / hueCount;
      row.push(hslToHex(hue, 0.65, lightness));
    }
    row.push(hslToHex(0, 0, lightness));
    rows.push(row);
  }
  return rows;
}
