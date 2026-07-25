import type { RetrievalClaim } from "@/lib/analysis/subclaims";

const STOPWORDS = new Set([
  "the","a","an","and","or","but","is","are","was","were","be","been","being",
  "to","of","in","on","for","with","that","this","it","as","at","by","from",
  "has","have","had","will","would","should","could","can","may","might",
  "says","said","claim","claims","claimed"
]);

function keywords(text: string) {
  return text
    .replace(/[^\p{L}\p{N}%£$.-]+/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !STOPWORDS.has(word.toLowerCase()))
    .slice(0, 18);
}

/**
 * Builds one narrower fallback query without another LLM call.
 *
 * It keeps the claim's highest-information terms and adds source cues that
 * encourage official/statistical results for measurable claims.
 */
export function buildFallbackQuery(claims: RetrievalClaim[]) {
  const terms = claims.flatMap((claim) => keywords(claim.text));
  const unique = [...new Set(terms.map((term) => term.toLowerCase()))];

  const hasNumber = terms.some((term) => /\d/.test(term));
  const hasEconomicTerms = unique.some((term) =>
    ["growth", "gdp", "inflation", "economy", "economic", "migration", "immigration", "spending", "cost"].includes(term)
  );

  const suffix = hasNumber || hasEconomicTerms
    ? "official statistics ONS OECD government data"
    : "official evidence government report research";

  return `${terms.join(" ")} ${suffix}`.trim().slice(0, 390);
}
