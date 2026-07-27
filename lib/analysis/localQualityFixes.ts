import type { ClaimAnalysisPayload } from "@/lib/claimSchema";
import { ALLOWED_VERDICTS } from "@/lib/analysis/qualityCheck";

export type LocalQualityFix = {
  code: string;
  message: string;
};

const SCORE_LABELS: Record<string, string> = {
  factual: "Based on facts",
  evidence: "Evidence quality",
  context: "Enough context",
  rhetoric: "Fair wording",
};

function replaceAllInsensitive(value: string, search: string, replacement: string) {
  return value.replace(new RegExp(search, "gi"), replacement);
}

function simplifyText(value: string) {
  let next = value;

  const replacements: Array<[string, string]> = [
    ["unsubstantiated", "not backed by enough evidence"],
    ["empirical evidence", "real-world evidence"],
    ["empirical", "real-world"],
    ["epistemic", "evidence"],
    ["evaluative proposition", "opinion"],
    ["factual reality", "fact"],
    ["rhetorical certainty", "how certain the wording sounds"],
  ];

  for (const [from, to] of replacements) {
    next = replaceAllInsensitive(next, from, to);
  }

  return next;
}

function evidenceQualityScore(analysis: ClaimAnalysisPayload) {
  return (
    analysis.scoreThemes.find((theme) => theme.id === "evidence")?.score ?? 0
  );
}


function isNonTestableValueJudgement(analysis: ClaimAnalysisPayload) {
  const haystack = [
    analysis.type,
    analysis.verdictSummary,
    analysis.bottomLine,
    analysis.scoreThemes.find((theme) => theme.id === "factual")?.summary ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("en");

  const valueSignals = [
    "value judgement",
    "value judgment",
    "subjective",
    "moral judgement",
    "moral judgment",
    "political opinion",
    "opinion",
  ];
  const nonTestableSignals = [
    "cannot be objectively",
    "cannot be verified",
    "cannot be proven",
    "cannot be proved",
    "not objectively measurable",
    "not measurable",
    "cannot be measured",
    "not testable",
    "non-testable",
  ];

  return (
    valueSignals.some((signal) => haystack.includes(signal)) &&
    (nonTestableSignals.some((signal) => haystack.includes(signal)) ||
      analysis.type.toLocaleLowerCase("en").includes("value"))
  );
}

function canonicalVerdict(analysis: ClaimAnalysisPayload) {
  const current = analysis.verdict.trim();

  // An inherently non-testable value judgement is an opinion-classification
  // problem, not an evidence-volume problem. This guard intentionally runs
  // before the approved-vocabulary early return.
  if (isNonTestableValueJudgement(analysis)) {
    return "Mostly opinion";
  }

  if (
    ALLOWED_VERDICTS.includes(
      current as (typeof ALLOWED_VERDICTS)[number]
    )
  ) {
    return current;
  }

  const value = current.toLocaleLowerCase("en");
  const type = analysis.type.toLocaleLowerCase("en");

  // Order matters: "unsupported" contains "supported".
  if (
    value.includes("opinion") ||
    value.includes("subjective") ||
    value.includes("value judgement") ||
    value.includes("value judgment") ||
    value.includes("political slogan") ||
    type.includes("opinion") ||
    type.includes("subjective")
  ) {
    return "Mostly opinion";
  }

  if (
    value.includes("unsubstantiated") ||
    value.includes("unsupported") ||
    value.includes("unverified") ||
    value.includes("not verified") ||
    value.includes("not established") ||
    value.includes("insufficient evidence") ||
    value.includes("not enough evidence")
  ) {
    return evidenceQualityScore(analysis) >= 50
      ? "Not supported by reliable evidence"
      : "Not enough evidence";
  }

  if (
    value.includes("misleading") ||
    value.includes("needs context") ||
    value.includes("missing context")
  ) {
    return "Misleading as stated";
  }

  if (
    value.includes("completely false") ||
    value.includes("false claim") ||
    value === "false" ||
    value.includes("incorrect")
  ) {
    return "False";
  }

  if (
    value.includes("mixed") ||
    value.includes("conflicting")
  ) {
    return "Mixed evidence";
  }

  if (
    value.includes("mostly supported") ||
    value.includes("broadly supported") ||
    value.includes("partly supported") ||
    value.includes("largely supported") ||
    value.includes("broadly accurate") ||
    value.includes("mostly accurate") ||
    value.includes("partly accurate") ||
    value.includes("plausible") ||
    value.includes("reasonable policy argument")
  ) {
    return "Mostly supported";
  }

  if (
    value.includes("well supported") ||
    value.includes("strongly supported") ||
    value.includes("strong support") ||
    value.includes("supported by official figures") ||
    value.includes("supported by official data") ||
    value.includes("verified") ||
    value === "true" ||
    value.includes("accurate")
  ) {
    return "Well supported";
  }

  return current;
}

function dedupeSources<T extends { url: string }>(sources: T[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

/**
 * Applies only deterministic, meaning-preserving fixes.
 *
 * This is intentionally conservative. Anything that requires judgement about
 * evidence or meaning is left for the quality gate and, if necessary, one AI
 * repair attempt.
 */
export function applyLocalQualityFixes(
  analysis: ClaimAnalysisPayload
): {
  analysis: ClaimAnalysisPayload;
  fixes: LocalQualityFix[];
} {
  const fixes: LocalQualityFix[] = [];
  const next = structuredClone(analysis);

  const verdict = canonicalVerdict(next);
  if (verdict !== next.verdict) {
    fixes.push({
      code: "verdict_normalised",
      message: `Mapped verdict "${next.verdict}" to "${verdict}".`,
    });
    next.verdict = verdict;
  }

  const fields: Array<keyof Pick<
    ClaimAnalysisPayload,
    "verdictSummary" | "plainEnglish" | "bottomLine" | "certaintyGapSummary"
  >> = [
    "verdictSummary",
    "plainEnglish",
    "bottomLine",
    "certaintyGapSummary",
  ];

  for (const field of fields) {
    const cleaned = simplifyText(next[field]);
    if (cleaned !== next[field]) {
      fixes.push({
        code: "plain_language_cleanup",
        message: `Simplified wording in ${field}.`,
      });
      next[field] = cleaned;
    }
  }

  next.scoreThemes = next.scoreThemes.map((theme) => {
    const expectedLabel = SCORE_LABELS[theme.id];
    const cleanedSummary = simplifyText(theme.summary);
    const cleanedRationale = theme.rationale.map(simplifyText);
    const uniqueSources = dedupeSources(theme.sources);

    if (expectedLabel && theme.label !== expectedLabel) {
      fixes.push({
        code: "score_label_normalised",
        message: `Mapped ${theme.id} label to "${expectedLabel}".`,
      });
    }

    if (
      cleanedSummary !== theme.summary ||
      cleanedRationale.some((item, index) => item !== theme.rationale[index])
    ) {
      fixes.push({
        code: "plain_language_cleanup",
        message: `Simplified wording in ${expectedLabel ?? theme.label}.`,
      });
    }

    if (uniqueSources.length !== theme.sources.length) {
      fixes.push({
        code: "duplicate_sources_removed",
        message: `Removed duplicate evidence from ${expectedLabel ?? theme.label}.`,
      });
    }

    return {
      ...theme,
      label: expectedLabel ?? theme.label,
      summary: cleanedSummary,
      rationale: cleanedRationale,
      sources: uniqueSources,
    };
  });

  return {
    analysis: next,
    fixes,
  };
}
