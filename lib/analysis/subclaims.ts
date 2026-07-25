export type RetrievalClaim = {
  id: string;
  text: string;
};

const HARD_MAX = 5;
const MIN_LENGTH = 18;

function clean(text: string) {
  return text
    .trim()
    .replace(/^[“"'‘’]+|[”"'‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.?!;,:]+$/g, "")
    .trim();
}

function splitLongClause(text: string) {
  const candidates = text
    .split(/\s+(?:and|but|while|whereas|because|so that|which means|therefore|yet)\s+/i)
    .map(clean)
    .filter((item) => item.length >= MIN_LENGTH);

  return candidates.length > 1 ? candidates : [clean(text)];
}

/**
 * Lightweight local segmentation for retrieval.
 *
 * This deliberately avoids a second LLM request, preserving the user's
 * free Gemini quota. Gemini still receives the full original statement
 * and can interpret/refine the meaning in the main analysis call.
 */
export function extractRetrievalClaims(statement: string): RetrievalClaim[] {
  const normalized = statement
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ");

  const sentenceChunks = normalized
    .split(/(?<=[.!?;])\s+|\s+-\s+|\s+—\s+/)
    .map(clean)
    .filter((item) => item.length >= MIN_LENGTH);

  const expanded = sentenceChunks.flatMap((chunk) =>
    chunk.length > 180 ? splitLongClause(chunk) : [chunk]
  );

  const unique: string[] = [];

  for (const item of expanded) {
    const value = clean(item);
    if (!value) continue;

    const key = value.toLocaleLowerCase("en");

    if (!unique.some((existing) => existing.toLocaleLowerCase("en") === key)) {
      unique.push(value);
    }

    if (unique.length >= HARD_MAX) break;
  }

  if (unique.length === 0 && normalized.length >= MIN_LENGTH) {
    unique.push(clean(normalized.slice(0, 390)));
  }

  // A single short statement is still one legitimate testable claim.
  return unique.map((text, index) => ({
    id: `C${index + 1}`,
    text,
  }));
}
