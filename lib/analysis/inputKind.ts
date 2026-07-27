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
      return "Yes, the evidence supports that";
    case "Mostly supported":
      return "Mostly yes";
    case "Mixed evidence":
      return "Not strictly true";
    case "Not enough evidence":
      return "There isn’t enough evidence to answer confidently";
    case "Mostly opinion":
      return "There isn’t an objective yes-or-no answer";
    case "Misleading as stated":
      return "Not as simply as the question suggests";
    case "Not supported by reliable evidence":
      return "No reliable evidence supports that";
    case "False":
      return "No, the evidence points the other way";
    default:
      return verdict;
  }
}
