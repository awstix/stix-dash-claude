import type { MatchCandidate } from "@/lib/kalkulation-matching";

export type LineItemForMatching = {
  lineItemId: string;
  rawText: string;
  unit: string | null;
  quantity: number | null;
  candidates: MatchCandidate[];
};

export type AiMatchResult = {
  lineItemId: string;
  chosenPositionId: string | null;
  confidence: number;
  reasoning: string;
};

export interface AiProvider {
  key: "anthropic" | "openai" | "gemini";
  label: string;
  defaultModel: string;
  matchBatch(args: {
    apiKey: string;
    model: string;
    items: LineItemForMatching[];
  }): Promise<AiMatchResult[]>;
}

function buildPrompt(items: LineItemForMatching[]): string {
  const payload = items.map((item) => ({
    lineItemId: item.lineItemId,
    rawText: item.rawText,
    unit: item.unit,
    quantity: item.quantity,
    candidates: item.candidates.map((candidate) => ({
      positionId: candidate.positionId,
      code: candidate.code,
      title: candidate.title,
      unit: candidate.unit,
      kennwertKonflikt: candidate.criticalTokenMismatch,
    })),
  }));

  return [
    "Du gleichst Positionen aus deutschen Leistungsverzeichnissen (Bauwesen) gegen einen Positionskatalog ab.",
    "Wähle für jede Position unter \"lineItemId\" die beste Kandidaten-ID aus der jeweils mitgelieferten \"candidates\"-Liste, oder null wenn keine wirklich passt.",
    "Bei abweichenden technischen Kennwerten (z. B. DN100 vs. DN150, C25/30 vs. C30/37, unterschiedliche Maße/Mengen) niemals raten - im Zweifel null wählen. Ein Kandidat mit \"kennwertKonflikt: true\" darf nur gewählt werden, wenn du sicher bist, dass der Konflikt keine echte Abweichung ist.",
    "Erfinde niemals eine positionId, die nicht in der jeweiligen candidates-Liste der Position steht.",
    "Antworte AUSSCHLIESSLICH mit einem JSON-Objekt exakt in dieser Form, ohne Erklärtext davor oder danach, ohne Markdown-Codeblock:",
    '{"matches": [{"lineItemId": "...", "chosenPositionId": "..." oder null, "confidence": Zahl zwischen 0 und 1, "reasoning": "kurz, max. 20 Wörter, Deutsch"}]}',
    "Für jede Position aus der Eingabe genau ein Eintrag im matches-Array, in derselben Reihenfolge.",
    "",
    "Positionen:",
    JSON.stringify(payload),
  ].join("\n");
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Manche Modelle liefern trotz Anweisung einen Markdown-Codeblock -
    // den ```json ... ``` Rahmen abschneiden und erneut versuchen.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    return JSON.parse(fenced[1]);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("KI-Antwort enthielt kein gültiges JSON.");
}

function parseMatches(text: string, items: LineItemForMatching[]): AiMatchResult[] {
  const parsed = extractJsonObject(text);
  const matches = (parsed as { matches?: unknown[] })?.matches;
  if (!Array.isArray(matches)) {
    throw new Error("KI-Antwort hatte nicht das erwartete Format ({ matches: [...] }).");
  }

  const validPositionIdsByItem = new Map(
    items.map((item) => [item.lineItemId, new Set(item.candidates.map((c) => c.positionId))]),
  );

  return matches
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry): AiMatchResult => {
      const lineItemId = String(entry.lineItemId ?? "");
      const rawChosenId = entry.chosenPositionId;
      const validIds = validPositionIdsByItem.get(lineItemId);
      const chosenPositionId =
        typeof rawChosenId === "string" && validIds?.has(rawChosenId) ? rawChosenId : null;
      const confidenceRaw = Number(entry.confidence);

      return {
        lineItemId,
        chosenPositionId,
        confidence: Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : 0,
        reasoning: typeof entry.reasoning === "string" ? entry.reasoning.slice(0, 300) : "",
      };
    })
    .filter((entry) => validPositionIdsByItem.has(entry.lineItemId));
}

const anthropicProvider: AiProvider = {
  key: "anthropic",
  label: "Anthropic (Claude)",
  defaultModel: "claude-sonnet-5",
  async matchBatch({ apiKey, model, items }) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: buildPrompt(items) }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`Anthropic-API-Fehler (Status ${response.status}): ${await response.text()}`);
    }

    const body = (await response.json()) as { content?: { text?: string }[] };
    const text = body.content?.[0]?.text ?? "";
    return parseMatches(text, items);
  },
};

const openaiProvider: AiProvider = {
  key: "openai",
  label: "OpenAI",
  defaultModel: "gpt-4o-mini",
  async matchBatch({ apiKey, model, items }) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: buildPrompt(items) }],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI-API-Fehler (Status ${response.status}): ${await response.text()}`);
    }

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    return parseMatches(text, items);
  },
};

const geminiProvider: AiProvider = {
  key: "gemini",
  label: "Google Gemini",
  defaultModel: "gemini-2.5-flash",
  async matchBatch({ apiKey, model, items }) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(items) }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini-API-Fehler (Status ${response.status}): ${await response.text()}`);
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parseMatches(text, items);
  },
};

const providers: Record<string, AiProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
};

export const AI_PROVIDER_OPTIONS = Object.values(providers).map((provider) => ({
  key: provider.key,
  label: provider.label,
  defaultModel: provider.defaultModel,
}));

export function getAiProvider(key: string): AiProvider {
  const provider = providers[key];
  if (!provider) throw new Error(`Unbekannter KI-Anbieter: ${key}`);
  return provider;
}
