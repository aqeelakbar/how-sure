import type { ClaimAnalysisPayload } from "@/lib/claimSchema";
import type { RetrievedSource } from "@/lib/search/tavily";

export type QualityIssue = {
  code: string;
  message: string;
};

const EXPECTED_LABELS: Record<string, string> = {
  factual: "Based on facts",
  evidence: "Evidence quality",
  context: "Enough context",
  rhetoric: "Fair wording",
};

const JARGON = [
  "empirical",
  "epistemic",
  "evaluative proposition",
  "factual reality",
  "rhetorical certainty",
  "unsubstantiated",
];

export const ALLOWED_VERDICTS = [
  "Well supported",
  "Mostly supported",
  "Mixed evidence",
  "Not enough evidence",
  "Mostly opinion",
  "Misleading as stated",
  "Not supported by reliable evidence",
  "False",
] as const;

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function containsAttributionLeak(
  text: string,
  attribution: string | null,
  proposition: string
) {
  if (!attribution) return false;

  const name = attribution.toLocaleLowerCase("en");
  const propositionLower = proposition.toLocaleLowerCase("en");

  // If the person/source is actually part of the proposition, mentioning them
  // is legitimate. Otherwise provenance should not drive the judgement.
  if (propositionLower.includes(name)) return false;

  return text.toLocaleLowerCase("en").includes(name);
}

export function checkAnalysisQuality({
  analysis,
  attribution,
  proposition,
  retrievedSources,
}: {
  analysis: ClaimAnalysisPayload;
  attribution: string | null;
  proposition: string;
  retrievedSources: RetrievedSource[];
}): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (wordCount(analysis.bottomLine) > 26) {
    issues.push({
      code: "bottom_line_too_long",
      message: "Bottom line is too long for a general reader.",
    });
  }

  if (wordCount(analysis.verdict) > 6) {
    issues.push({
      code: "verdict_too_long",
      message: "Verdict should be a short, scannable phrase.",
    });
  }

  if (
    !ALLOWED_VERDICTS.includes(
      analysis.verdict as (typeof ALLOWED_VERDICTS)[number]
    )
  ) {
    issues.push({
      code: "verdict_vocabulary",
      message:
        `Verdict must use one of the approved plain-English labels: ${ALLOWED_VERDICTS.join(", ")}.`,
    });
  }


  const judgementText = [
    analysis.type,
    analysis.verdictSummary,
    analysis.bottomLine,
    analysis.scoreThemes.find((theme) => theme.id === "factual")?.summary ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("en");

  const looksLikeNonTestableValueJudgement =
    (judgementText.includes("value judgement") ||
      judgementText.includes("value judgment") ||
      judgementText.includes("subjective") ||
      analysis.type.toLocaleLowerCase("en").includes("value")) &&
    (judgementText.includes("cannot be verified") ||
      judgementText.includes("cannot be proven") ||
      judgementText.includes("cannot be proved") ||
      judgementText.includes("cannot be measured") ||
      judgementText.includes("not measurable") ||
      judgementText.includes("not testable") ||
      analysis.type.toLocaleLowerCase("en").includes("value"));

  if (looksLikeNonTestableValueJudgement && analysis.verdict !== "Mostly opinion") {
    issues.push({
      code: "value_judgement_verdict_mismatch",
      message:
        'A mainly non-testable value judgement must use the verdict "Mostly opinion", not an evidence-insufficiency verdict.',
    });
  }

  const userFacingText = [
    analysis.verdict,
    analysis.verdictSummary,
    analysis.plainEnglish,
    analysis.bottomLine,
    analysis.certaintyGapSummary,
    ...analysis.scoreThemes.flatMap((theme) => [
      theme.summary,
      ...theme.rationale,
    ]),
  ].join(" ");

  const generatedProse = [
    analysis.verdictSummary,
    analysis.plainEnglish,
    analysis.bottomLine,
    analysis.certaintyGapSummary,
    ...analysis.scoreThemes.flatMap((theme) => [
      theme.summary,
      ...theme.rationale,
      ...theme.sources.map((source) => source.relevance),
    ]),
  ].join(" ");

  if (generatedProse.includes("—")) {
    issues.push({
      code: "em_dash_style",
      message:
        "User-facing generated prose should avoid em dashes. Use a comma or full stop instead.",
    });
  }

  for (const term of JARGON) {
    if (userFacingText.toLocaleLowerCase("en").includes(term)) {
      issues.push({
        code: "jargon",
        message: `User-facing wording contains avoidable jargon: "${term}".`,
      });
      break;
    }
  }

  for (const field of [
    ["verdict", analysis.verdict],
    ["verdict summary", analysis.verdictSummary],
    ["plain English", analysis.plainEnglish],
    ["bottom line", analysis.bottomLine],
  ] as const) {
    if (containsAttributionLeak(field[1], attribution, proposition)) {
      issues.push({
        code: "attribution_leak",
        message: `${field[0]} talks about the attributed speaker/source instead of judging the proposition.`,
      });
    }
  }


  const plainEnglishLower = analysis.plainEnglish.toLocaleLowerCase("en");
  const forbiddenPlainEnglishPatterns = [
    /\bnews (?:reports|coverage|records)\b/,
    /\bsources? (?:confirm|verify|show|report)\b/,
    /\bpolitical opinion\b/,
    /\bfactual (?:claim|statement|fact)\b/,
    /\b(?:can(?:not|'t)|cannot) be (?:proved|proven|verified|disproved)\b/,
    /\byou can trust that\b/,
    /\btreat this as\b/,
  ];

  if (forbiddenPlainEnglishPatterns.some((pattern) => pattern.test(plainEnglishLower))) {
    issues.push({
      code: "plain_english_repeats_judgement",
      message:
        '“What this means” repeats verdict/verification language instead of adding a new interpretive distinction. Explain an assumption, standard, undefined term, comparison or limitation without discussing attribution, factuality or whether the claim is provable.',
    });
  }

  const factualTheme = analysis.scoreThemes.find((theme) => theme.id === "factual");
  const evidenceTheme = analysis.scoreThemes.find((theme) => theme.id === "evidence");
  const contextTheme = analysis.scoreThemes.find((theme) => theme.id === "context");
  const rhetoricTheme = analysis.scoreThemes.find((theme) => theme.id === "rhetoric");

  if (attribution && !proposition.toLocaleLowerCase("en").includes(attribution.toLocaleLowerCase("en"))) {
    const attributionLower = attribution.toLocaleLowerCase("en");
    const factualText = [factualTheme?.summary ?? "", ...(factualTheme?.rationale ?? [])].join(" ").toLocaleLowerCase("en");
    if (factualText.includes(attributionLower) || /\b(?:said|says|claimed|claims|asserted|asserts|reported|reporting|speech|quote)\b/.test(factualText)) {
      issues.push({
        code: "factual_theme_attribution_leak",
        message: '“Based on facts” must assess only the underlying proposition’s verifiability/support, not the speaker, reporting or authenticity of the quote.',
      });
    }

    const rhetoricText = [rhetoricTheme?.summary ?? "", ...(rhetoricTheme?.rationale ?? [])].join(" ").toLocaleLowerCase("en");
    if (rhetoricText.includes(attributionLower) || /\b(?:attributes?|reporting|speaker|politician)\b/.test(rhetoricText)) {
      issues.push({
        code: "wording_theme_wrapper_leak",
        message: '“Fair wording” must analyse only the wording of the underlying proposition, not the neutral reporting/attribution wrapper.',
      });
    }
  }

  if (evidenceTheme) {
    const evidenceText = [evidenceTheme.summary, ...evidenceTheme.rationale].join(" ").toLocaleLowerCase("en");
    const leadsOnAttribution = /^(?:reliable |reputable |multiple )?(?:news|reporting|coverage|sources?).{0,60}(?:confirm|verify|report)/i.test(evidenceText.trim());
    const statesLimit = /\b(?:does not|do not|cannot|can't|doesn't|do not independently|only establishes?|mainly establishes?|does not establish)\b/.test(evidenceText);
    if (leadsOnAttribution && !statesLimit) {
      issues.push({
        code: "evidence_theme_attribution_as_support",
        message: '“Evidence quality” leads with attribution evidence as if it supported the proposition. State what the evidence establishes about the proposition and, where relevant, that attribution/context evidence does not establish it.',
      });
    }
  }

  const ids = new Set(analysis.scoreThemes.map((theme) => theme.id));

  for (const required of ["factual", "evidence", "context", "rhetoric"]) {
    if (!ids.has(required as "factual" | "evidence" | "context" | "rhetoric")) {
      issues.push({
        code: "missing_score",
        message: `Missing required score theme: ${required}.`,
      });
    }
  }

  for (const theme of analysis.scoreThemes) {
    if (EXPECTED_LABELS[theme.id] !== theme.label) {
      issues.push({
        code: "score_label",
        message: `${theme.id} should use the plain-English label "${EXPECTED_LABELS[theme.id]}".`,
      });
    }

    const uniqueUrls = new Set(theme.sources.map((source) => source.url));
    if (uniqueUrls.size !== theme.sources.length) {
      issues.push({
        code: "duplicate_sources",
        message: `${theme.label} contains duplicate source URLs.`,
      });
    }

    if (
      (theme.id === "factual" || theme.id === "evidence") &&
      theme.score >= 55 &&
      theme.sources.length === 0 &&
      retrievedSources.length > 0
    ) {
      issues.push({
        code: "unsupported_high_score",
        message: `${theme.label} is relatively high but cites no retrieved evidence.`,
      });
    }
  }

  if (analysis.verdict === "False") {
    const contradictionCount = analysis.scoreThemes
      .flatMap((theme) => theme.sources)
      .filter((source) => source.role === "Contradicts").length;

    if (contradictionCount === 0) {
      issues.push({
        code: "false_without_contradiction",
        message:
          'Verdict "False" requires at least one cited source that directly contradicts the claim. If the problem is missing or unreliable data, use "Not supported by reliable evidence" instead.',
      });
    }
  }

  for (const annotation of analysis.annotations) {
    if (!analysis.statement.includes(annotation.phrase)) {
      issues.push({
        code: "annotation_not_exact",
        message: `Annotation phrase is not an exact substring of the original statement: "${annotation.phrase}".`,
      });
      break;
    }
  }

  if (analysis.evidenceCertainty >= 60 && retrievedSources.length === 0) {
    issues.push({
      code: "evidence_without_sources",
      message: "Evidence support is high even though no web sources were retrieved.",
    });
  }

  const judgementSources = analysis.scoreThemes
    .flatMap((theme) => theme.sources)
    .filter((source) => source.role !== "Verifies");

  const evidenceLanguage = /\b(evidence shows|evidence suggests|research shows|research suggests|official (?:figures|data|statistics) show|sources show)\b/i;

  if (
    evidenceLanguage.test(analysis.certaintyGapSummary) &&
    judgementSources.length === 0
  ) {
    issues.push({
      code: "confidence_summary_without_sources",
      message:
        "The Claim vs evidence explanation makes an evidence-based statement but provides no judgement source the user can inspect.",
    });
  }

  return issues;
}
