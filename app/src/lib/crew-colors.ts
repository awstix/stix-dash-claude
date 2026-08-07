export const defaultCrewColor = "#6b7280";

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** Wandelt einen gespeicherten Farbwert (Hex-Code oder alte Tailwind-Klasse) in
 * einen verwendbaren Hex-Code um. Unbekannte Werte fallen auf Grau zurück. */
export function normalizeCrewColor(value: string | null | undefined): string {
  if (!value) return defaultCrewColor;
  if (isHexColor(value)) return value.toLowerCase();
  return defaultCrewColor;
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
export function buildCrewColorPalette(): string[][] {
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
