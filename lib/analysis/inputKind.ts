export type InputKind = "question" | "assertion";

const QUESTION_START =
  /^(?:who|what|when|where|why|how|is|are|am|was|were|do|does|did|can|could|will|would|should|has|have|had|may|might|must)\b/i;

export function detectInputKind(value: string): InputKind {
  const trimmed = value.trim();

  if (trimmed.endsWith("?")) return "question";
  if (QUESTION_START.test(trimmed)) return "question";

  return "assertion";
}

export function questionFacingVerdict(verdict: string): string {
  switch (verdict) {
    case "Well supported":
      return "Evidence points to yes";
    case "Mostly supported":
      return "The evidence leans yes";
    case "Mixed evidence":
      return "The evidence is mixed";
    case "Not enough evidence":
      return "There isn’t enough evidence to answer confidently";
    case "Mostly opinion":
      return "The question is partly subjective";
    case "Misleading as stated":
      return "The wording overstates what can be established";
    case "Not supported by reliable evidence":
      return "Reliable evidence does not support it";
    case "False":
      return "Evidence points to no";
    default:
      return verdict;
  }
}
