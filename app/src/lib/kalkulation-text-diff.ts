/** Einfacher wortweiser Diff (LCS-Prinzip) - zeigt den Text eines
 * Vergleichs-LVs, markiert aber, welche Wörter darin NICHT im aktuellen
 * Text vorkommen (zur rot/fett-Hervorhebung von Abweichungen). Nur für
 * kurze Texte gedacht (LV-Langtexte sind ein paar Sätze, kein Fließtext) -
 * die klassische O(n*m)-DP-Tabelle ist dafür schnell genug. */

export type DiffToken = {
  changed: boolean;
  text: string;
};

export function diffWords(currentText: string, otherText: string): DiffToken[] {
  const a = currentText.split(/\s+/).filter(Boolean);
  const b = otherText.split(/\s+/).filter(Boolean);

  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      tokens.push({ changed: false, text: b[j] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      tokens.push({ changed: true, text: b[j] });
      j += 1;
    }
  }
  while (j < b.length) {
    tokens.push({ changed: true, text: b[j] });
    j += 1;
  }

  return tokens;
}
