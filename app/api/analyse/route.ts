import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { after, NextResponse } from "next/server";
import { claimAnalysisSchema } from "@/lib/claimSchema";
import { extractJson } from "@/lib/ai/json";
import {
  searchEvidence,
  TavilyError,
  type RetrievedSource,
} from "@/lib/search/tavily";
import { normaliseModelSources } from "@/lib/analysis/normaliseSources";
import {
  extractRetrievalClaims,
  type RetrievalClaim,
} from "@/lib/analysis/subclaims";
import { parseAttribution } from "@/lib/analysis/attribution";
import { detectInputKind } from "@/lib/analysis/inputKind";
import { checkAnalysisQuality } from "@/lib/analysis/qualityCheck";
import { applyLocalQualityFixes } from "@/lib/analysis/localQualityFixes";
import { withProviderRetry } from "@/lib/ai/providerRetry";
import { buildFallbackQuery } from "@/lib/search/fallbackQuery";
import { isDatabaseConfigured } from "@/lib/db";
import {
  findServerCachedAnalysis,
  hashClaim,
  saveAnalysis,
} from "@/lib/serverPersistence";
import { consumeFreshAnalysisLimit } from "@/lib/rateLimit";
import { newRequestId, recordAnalysisRun } from "@/lib/observability";
import { MODEL_NAME as MODEL, PIPELINE_VERSION } from "@/lib/version";
import type { Verification } from "@/types/verification";

function isQuotaError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown API error";

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;

  return (
    status === 429 ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("generate_content_free_tier_requests") ||
    message.toLowerCase().includes("quota exceeded")
  );
}

async function retrieveForClaims(
  claims: RetrievalClaim[],
  apiKey: string
): Promise<RetrievedSource[]> {
  const sourceMap = new Map<string, RetrievedSource>();

  // Keep Tavily usage bounded for long statements, but run independent
  // searches concurrently instead of waiting for each one in sequence.
  const searchClaims = claims.slice(0, 5);
  const searches = await Promise.allSettled(
    searchClaims.map(async (claim) => ({
      claim,
      results: await searchEvidence(claim.text, apiKey),
    }))
  );

  const successfulSearches = searches.filter(
    (
      result
    ): result is PromiseFulfilledResult<{
      claim: RetrievalClaim;
      results: RetrievedSource[];
    }> => result.status === "fulfilled"
  );

  // Preserve the previous failure behaviour when every search fails, while
  // allowing useful partial evidence when only one subclaim search fails.
  if (successfulSearches.length === 0) {
    const firstFailure = searches.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected"
    );
    throw firstFailure?.reason ?? new Error("Evidence retrieval failed.");
  }

  for (const search of successfulSearches) {
    const { claim, results } = search.value;

    for (const result of results) {
      const existing = sourceMap.get(result.url);

      if (existing) {
        const ids = new Set([...(existing.claimIds ?? []), claim.id]);
        existing.claimIds = [...ids];

        // Keep the stronger Tavily relevance score if both searches found it.
        if (
          typeof result.score === "number" &&
          (typeof existing.score !== "number" || result.score > existing.score)
        ) {
          existing.score = result.score;
        }

        continue;
      }

      sourceMap.set(result.url, {
        ...result,
        claimIds: [claim.id],
      });
    }
  }

  return [...sourceMap.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 16)
    .map((source, index) => ({
      ...source,
      id: `S${index + 1}`,
    }));
}

function formatEvidence(
  detectedClaims: RetrievalClaim[],
  sources: RetrievedSource[]
) {
  const claimText = detectedClaims
    .map((claim) => `${claim.id}: ${claim.text}`)
    .join("\n");

  const sourceText = sources.length
    ? sources
        .map(
          (source) => `
[${source.id}]
RETRIEVED FOR CLAIMS: ${(source.claimIds ?? []).join(", ") || "Unspecified"}
TITLE: ${source.title}
PUBLISHER / DOMAIN: ${source.publisher}
URL: ${source.url}
PUBLISHED: ${source.publishedDate ?? "Not supplied"}
SEARCH RELEVANCE: ${source.score ?? "Not supplied"}
EXTRACT:
${source.content || "No extract supplied"}
`.trim()
        )
        .join("\n\n---\n\n")
    : "NO EXTERNAL SOURCES WERE RETRIEVED.";

  return `
DETECTED RETRIEVAL CLAIMS:
${claimText}

RETRIEVED SOURCES:
${sourceText}
`.trim();
}


function normaliseAndParseAnalysis({
  raw,
  claim,
  detectedClaims,
  attributionName,
  retrievedSources,
}: {
  raw: Record<string, any>;
  claim: string;
  detectedClaims: RetrievalClaim[];
  attributionName: string | null;
  retrievedSources: RetrievedSource[];
}) {
  raw.detectedClaims = detectedClaims;

  if (attributionName) {
    raw.speaker = attributionName;
  }

  if (Array.isArray(raw.scoreThemes)) {
    raw.scoreThemes = raw.scoreThemes.map(
      (theme: Record<string, unknown>) => ({
        ...theme,
        sources: normaliseModelSources(
          theme.sources,
          retrievedSources
        ),
      })
    );
  }

  return claimAnalysisSchema.parse({
    ...raw,
    statement: claim.trim(),
    detectedClaims,
  });
}

export async function POST(request: Request) {
  const requestId = newRequestId();
  const startedAt = Date.now();
  let cacheLookupMs = 0;
  let retrievalMs = 0;
  let generationMs = 0;
  let persistenceMs = 0;
  let failureStage = "request";
  let currentClaimHash: string | null = null;

  try {
    failureStage = "request_parse";
    const { claim } = await request.json();

    if (typeof claim !== "string" || claim.trim().length < 8) {
      return NextResponse.json(
        { error: "Please provide a longer claim to analyse." },
        { status: 400 }
      );
    }

    if (claim.length > 500) {
      return NextResponse.json(
        { error: "Please keep the claim to 500 characters or fewer." },
        { status: 400 }
      );
    }

    failureStage = "database_configuration";
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        {
          code: "database_not_configured",
          error:
            "DATABASE_URL is not configured. V3 needs PostgreSQL for shared analyses, server caching, and API protection.",
        },
        { status: 500 }
      );
    }

    currentClaimHash = hashClaim(claim);

    failureStage = "server_cache_lookup";
    const cacheLookupStartedAt = Date.now();
    const cached = await findServerCachedAnalysis(currentClaimHash);
    cacheLookupMs = Date.now() - cacheLookupStartedAt;

    if (cached) {
      const cachedVerification: Verification = {
        ...cached.verification,
        status: "server_cache_hit",
        label: "Server-cached analysis",
        detail:
          "Loaded from the shared server cache. No new AI or web-search request was made.",
        cache: "server",
        pipelineVersion: PIPELINE_VERSION,
      };

      after(() =>
        recordAnalysisRun({
          requestId,
          claimHash: currentClaimHash,
          analysisId: cached.id,
          outcome: "server_cache_hit",
          durationMs: Date.now() - startedAt,
          retrievedSourceCount:
            cached.verification.retrievedSourceCount ?? null,
          citedSourceCount: cached.verification.citedSourceCount ?? null,
          repairAttempted: cached.verification.repairAttempted ?? false,
          providerRetryCount:
            (cached.verification.initialProviderRetryCount ?? 0) +
            (cached.verification.repairProviderRetryCount ?? 0),
          retrievalFallbackAttempted:
            cached.verification.retrievalFallbackAttempted ?? false,
          retrievalQuality: cached.verification.retrievalQuality ?? null,
        })
      );

      return NextResponse.json(
        {
          analysisId: cached.id,
          sharePath: `/analysis/${cached.id}`,
          analysis: cached.analysis,
          verification: cachedVerification,
        },
        {
          headers: {
            "Server-Timing": `cache;dur=${cacheLookupMs}, total;dur=${Date.now() - startedAt}`,
          },
        }
      );
    }

    failureStage = "rate_limit";
    const rateLimit = await consumeFreshAnalysisLimit(request);
    if (!rateLimit.allowed) {
      after(() =>
        recordAnalysisRun({
          requestId,
          claimHash: currentClaimHash,
          outcome: "error",
          durationMs: Date.now() - startedAt,
          failureStage,
          errorCode: rateLimit.code,
        })
      );

      return NextResponse.json(
        { code: rateLimit.code, stage: failureStage, error: rateLimit.message },
        { status: 429 }
      );
    }

    failureStage = "configuration";
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const tavilyApiKey = process.env.TAVILY_API_KEY;

    if (!geminiApiKey) {
      return NextResponse.json(
        {
          code: "gemini_not_configured",
          error: "GEMINI_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    if (!tavilyApiKey) {
      return NextResponse.json(
        {
          code: "search_not_configured",
          error:
            "TAVILY_API_KEY is not configured. Add it to .env.local to enable evidence-backed analysis.",
        },
        { status: 500 }
      );
    }

    failureStage = "claim_parsing";
    const inputKind = detectInputKind(claim.trim());
    const attribution = parseAttribution(claim.trim());

    // Retrieval should test the proposition itself, not a reporting wrapper
    // such as "Kemi Badenoch says ...".
    const detectedClaims = extractRetrievalClaims(attribution.proposition);

    // Multiple focused Tavily searches, still only one Gemini request.
    failureStage = "evidence_retrieval";
    const retrievalStartedAt = Date.now();
    const retrievedSources = await retrieveForClaims(
      detectedClaims,
      tavilyApiKey
    );
    retrievalMs = Date.now() - retrievalStartedAt;

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const prompt = `
You are the analysis engine for "How Sure?", an evidence-backed claim analysis prototype.

ORIGINAL INPUT:
"${claim.trim()}"

INPUT TYPE:
- ${inputKind === "question" ? "Question" : "Assertion"}

ATTRIBUTION PARSE:
- Attribution wrapper detected: ${attribution.detected ? "yes" : "no"}
- Attributed speaker/source: ${attribution.attribution ?? "not detected"}
- Proposition being tested: "${attribution.proposition}"

${formatEvidence(detectedClaims, retrievedSources)}


IMPORTANT ABOUT QUESTIONS:
- When INPUT TYPE is Question, the user is asking How Sure? to answer something. Do NOT analyse or judge the question as though the user asserted it as fact.
- Infer the proposition or propositions that would need to be investigated to answer the question, and test those against the evidence.
- Keep the original question wording intact in statement and annotations.
- The internal verdict MUST still use one of the approved verdict labels because the application quality checks depend on them.
- verdictSummary and bottomLine MUST answer the user's question directly in plain language.
- verdictSummary should begin with the substantive answer or distinction, not with meta-language such as "the evidence is mixed", "the sources are mixed", or "there is mixed evidence".
- For yes/no questions, prefer formulations such as "Yes, but…", "No, not in the broad sense…", "Mostly yes…", or "There is not enough evidence to answer confidently", depending on what the evidence supports.
- Do not describe the question itself as true, false, misleading, cautious, leading or overclaiming.
- Wording analysis is secondary for questions. Only flag wording when a vague, loaded, undefined or evaluative term materially prevents a precise answer.
- For questions, annotations should be sparse and only identify wording that genuinely changes the answer. Do not annotate neutral qualifiers or ordinary grammatical phrasing.
- rhetoricalCertainty and certaintyGapSummary are retained for schema compatibility, but they are not shown as a question-scoring interface.
- The four score themes remain the same because they explain how answerable the underlying issue is and how strong the evidence is.

IMPORTANT ABOUT ATTRIBUTION:
- If an attribution wrapper was detected, treat the attributed person/source separately from the proposition.
- Reporting wrappers such as “X says/claims/asserts that …” are provenance. The words after the reporting verb are the default judgement target.
- The evidence score for the proposition must not change merely because a speaker name was included in a reporting wrapper.
- Attribution belongs to provenance, not to the trust judgement.
- DO NOT use confirmation that the speaker said something as evidence that the underlying proposition is true.
- DO NOT make verdict, verdictSummary, plainEnglish or bottomLine about whether the statement was accurately attributed.
- verdict, verdictSummary, scoreThemes, rhetoricalCertainty, evidenceCertainty, certaintyGapSummary, defensibleRewrite, plainEnglish and bottomLine must evaluate the PROPOSITION BEING TESTED.
- Only mention the named person inside those fields when the person is actually part of the proposition itself.
- The speaker may still matter for provenance and surrounding context.
- If the named person is the subject of the proposition itself, keep them inside the substantive claim.

IMPORTANT ABOUT DETECTED CLAIMS:
- The C1/C2/etc items above were generated locally as retrieval units.
- They are search aids, not unquestionable semantic truth.
- You may simplify their wording in explanations, but the final JSON must preserve
  the exact detectedClaims array supplied below.
- Use claim IDs when explaining which evidence relates to which part of the statement.

TRUST RULES:
1. You may ONLY cite sources from the retrieved source set.
2. NEVER invent a URL, title, publisher, quotation, statistic, date, or source.
3. Each source object MUST include sourceId using one of the supplied S-IDs.
4. Copy the corresponding URL exactly.
5. Each cited source should include claimIds identifying which detected claims it bears on.
6. A search result being relevant does NOT mean it supports the claim.
7. Do not treat several articles repeating the same assertion as independent proof.
8. Prefer primary/official and academic evidence over commentary when judging quality.
9. annotation.phrase MUST be an exact substring from the original statement.
10. If an attribution wrapper is explicitly present, use that attribution as the speaker. Otherwise do not infer a speaker from wording alone; use "Source not provided".
11. If the evidence for one detected claim is weak but another is strong, say so explicitly rather than averaging away the difference.
12. certaintyGapSummary must be understandable on its own. If it says that evidence, research, official figures, data or sources show something, that statement must be supported by at least one source attached to the factual, evidence or context score. Do not rely only on a Verifies/provenance source.

SOURCE ROLES:
- Supports
- Contradicts
- Contextualises
- Defines
- Verifies

SOURCE QUALITY:
- High: primary official, legislation/court material, strong academic research, authoritative statistics, or similarly direct evidence.
- Medium: reputable journalism, professional body, credible secondary analysis, established reference source.
- Low: weakly sourced commentary, advocacy without supporting evidence, low-transparency publication, or limited evidential value.

JUDGEMENT TARGET:
- The analysis target is the proposition, not the attribution wrapper.
- For an assertion, "Should I trust this claim?" means: how justified is the proposition by the available evidence?
- For a question, answer what the evidence suggests about the investigated proposition. Do not treat the interrogative sentence itself as a factual assertion.
- "Bottom line" must answer the relevant assertion or question in one short, plain-English sentence.
- If the core proposition is mainly subjective, evaluative, moral or value-based and cannot be resolved by observable evidence as stated, use the verdict "Mostly opinion". Do NOT use "Not enough evidence" for a proposition that is inherently non-testable as phrased; that label is only for testable claims where the available evidence is insufficient.
- plainEnglish has a DIFFERENT job from verdictSummary and bottomLine. It is rendered as “What this means” and must give the reader a NEW interpretive distinction to carry forward when interpreting, sharing or repeating the statement.
- In plainEnglish, NEVER repeat or paraphrase the verdict, verdictSummary or bottomLine. Do NOT mention the verdict category; whether the statement is opinion, factual, verifiable, supported, true, false, proved/disproved; evidence sufficiency; reporting, news coverage, sources, attribution; or whether the speaker said it.
- Do not use phrases such as “treat this as”, “you can trust that”, “news reports confirm”, “political opinion”, “factual claim”, or “cannot be proven”.
- Instead, explain one concrete interpretive distinction: the standard being applied, an undefined term, an assumption, a comparison, or a limitation. Focus on what the proposition presupposes or leaves undefined, not on whether it is correct.
- Write plainEnglish as 1–2 short sentences. Prefer concrete wording tied to the claim itself. Example pattern: “The statement uses X as its standard for Y. It does not provide a neutral or agreed measure for Z.” Do not copy this example verbatim.
- If the proposition is mainly subjective/evaluative (for example "too easy", "unfair", "a disaster"), explain that in everyday language.
- Do not substitute "the speaker really said this" for "the claim is supported."
- Write for a general reader with no specialist knowledge.
- Prefer short words and short sentences.
- Avoid em dashes (—) in user-facing generated prose. Prefer a comma or full stop instead.
- Avoid academic or technical terms such as "empirical", "evaluative proposition", "substantiated", "factual reality", "epistemic", or "rhetorical certainty" in user-facing prose unless absolutely necessary.
- If a specialist concept is needed, explain it immediately in ordinary language.

WHY CONTENT RULES:
- The four scoreThemes summaries are the default on-page explanations. Each summary must be ONE short sentence, ideally 10–18 words. Lead with the finding; do not describe the scoring process.
- Each scoreTheme rationale must contain exactly TWO concise findings. Each item should be one sentence, ideally 10–20 words.
- Each dimension has a STRICT editorial remit. Do not use one dimension to answer another dimension's question.
- Based on facts = VERIFIABILITY OF THE UNDERLYING PROPOSITION ONLY. Never mention the speaker, reporting, whether the quote is authentic, or that the statement was made. State whether the proposition can be checked against observable facts or measurable evidence and, if testable, how well it is supported.
- For Based on facts rationale ONLY: rationale[0] = WHAT WE FOUND (whether the underlying proposition is objectively testable as stated); rationale[1] = WHY IT MATTERS (state exactly what measurable definition, criterion, comparison rule or test is missing or present, and explain how that limits what evidence can establish). The second item MUST stay on testability. Do not discuss political stance, policy preference, rights being established, the speaker, motives, attribution, or whether a concept is legally recognised. If sources only define terms mentioned in the argument, explain that definitions do not create an objective test for the central proposition. Do not repeat the same point in both.
- Evidence quality = WHAT THE EVIDENCE ESTABLISHES ABOUT THE UNDERLYING PROPOSITION. Lead with the evidential limit or strength for the proposition itself. Do not treat reputable reporting of a quotation as support for the proposition. If available sources mainly establish attribution or context, say that they do not independently establish the proposition. Mention attribution only when needed to explain this limitation, never as the main finding.
- For Evidence quality rationale ONLY: rationale[0] = WHAT WE FOUND (describe the role the displayed evidence actually plays for the underlying proposition. If the visible sources mainly define terms, add context, or verify attribution, say that plainly instead of generalising about other evidence); rationale[1] = WHY IT MATTERS (explain what those sources can and cannot establish about the proposition). Keep both items tightly traceable to the source cards shown, and focus on evidential quality, directness, relevance and independence. Do not repeat the Based on facts testability judgement.
- Enough context = INTERPRETIVE CONTEXT OF THE UNDERLYING PROPOSITION. Ignore the reporting wrapper. Identify the specific qualifier, definition, timeframe, comparison, surrounding passage or alternative explanation that materially changes interpretation, and state why it matters.
- For Enough context rationale ONLY: rationale[0] = WHAT WE FOUND (state the actual contextual detail present or missing in the submitted statement itself, not the publication, outlet or place where the context came from; avoid generic phrases such as “broader debate” or “more context is needed”); rationale[1] = WHY IT MATTERS (explain exactly how that missing or present detail changes, narrows or qualifies the meaning of the underlying proposition). Keep both items concrete and claim-specific. Do not repeat factual testability or evidence-quality findings.
- For Enough context source cards ONLY: each source relevance sentence must name the specific contextual detail that source supplies for this claim (for example an omitted example, qualifier, definition, timeframe or surrounding passage). Do not describe only the general political setting or publication context unless that setting itself materially changes interpretation. The relevance text must visibly support the Enough context rationale shown on the left.
- For Enough context, do not name a publication, outlet, article or source in the rationale unless that exact source is displayed in the Enough context source cards. Prefer describing the contextual detail itself rather than where it came from.
- Fair wording = LANGUAGE OF THE UNDERLYING PROPOSITION ONLY. Ignore neutral reporting phrases such as “X says/claims/asserts that”. Analyse whether the proposition itself is precise, proportionate, loaded, absolute, vague or undefined. Never infer the speaker's motive or intention.
- For Fair wording rationale ONLY: rationale[0] = WHAT WE FOUND (identify the specific word, phrase or construction in the underlying proposition that affects precision, neutrality, scope or strength; quote only short wording from the proposition when useful); rationale[1] = WHY IT MATTERS (explain how that wording changes interpretation by naming the undefined standard, broadened scope, categorical framing or other concrete language effect). Keep both items about language only. Do not call a policy stance an "absolute principle" unless the proposition literally uses absolute language. Do not discuss truth, evidence quality, missing context, attribution, motive or political intent.
- Fair wording relies primarily on textual analysis of the proposition itself. Do NOT attach external sources merely because they define concepts mentioned in the statement or provide general background. Attach a source only when it is genuinely necessary to establish the exact wording or clarify a disputed term whose meaning is central to the wording assessment. Language analysis remains the primary evidence mode for Fair wording even when a reference source is attached.
- ANNOTATIONS power both Statement Anatomy and the Fair wording “Language analysis” panel. Each annotation explanation must describe WHAT THE SELECTED WORDING IS DOING linguistically or rhetorically: for example, defining a comparison standard, broadening scope, using categorical language, leaving a term undefined, adding a qualifier, or intensifying certainty. Do NOT explain whether the selected phrase is factual, true, false, supported, verifiable or opinion-based. For wording-focused annotations, use ONLY these label types when applicable: "Value judgement", "Undefined term", "Vague term", "Categorical wording", "Absolute wording", "Broad scope", "Broad generalisation", "Loaded framing", "Evaluative wording", "Comparison standard", or "Qualifier". Prioritise concrete wording signals in the underlying proposition. Do NOT create wording annotations for neutral semantic categories such as "Legal concepts", "Policy topic", "Political context", or general subject matter. Do not spend annotations on neutral attribution wrappers unless attribution itself is genuinely important to understanding the statement.
- Keep attribution evidence separate from evidence for the proposition. Reporting that confirms a person said something may verify attribution, but it does NOT support the truth of the underlying proposition. Say this distinction explicitly when relevant.
- Do not repeat the same finding across multiple dimensions. If a point belongs to one remit, keep it there.
- Prefer concrete wording over abstract commentary. Avoid phrases such as "political philosophy", "conventional principles", "contentious proposal" or "societal norms" when simpler wording is available.
- A source role of "Verifies" means it verifies a factual detail such as attribution, wording, date or occurrence. Never imply that "Verifies" means the underlying proposition has been proven true.

SCORING — ALL FOUR DISPLAY SCORES USE HIGHER = BETTER:
- Based on facts: how well the proposition itself is supported by the retrieved evidence. Higher means the claim is better supported.
- Evidence quality: how reliable, direct, relevant and independent the available evidence is for judging the claim, WHETHER THAT EVIDENCE SUPPORTS OR CONTRADICTS THE CLAIM. A false claim can still have a high Evidence quality score when strong evidence clearly disproves it.
- Enough context: how complete the statement is. Higher means fewer important qualifiers, definitions, timeframes or alternative explanations are missing.
- Fair wording: how balanced and neutral the wording is. Higher means fairer, less loaded wording.
- rhetoricalCertainty: how confident or absolute the statement sounds.
- evidenceCertainty: how strongly the available evidence SUPPORTS THE PROPOSITION ITSELF. This is different from Evidence quality. Strong contradictory evidence can mean high Evidence quality but low evidenceCertainty.

RETURN ONE JSON OBJECT ONLY.

Preserve these detected claims exactly:
${JSON.stringify(detectedClaims)}

Use exactly this shape:

{
  "statement": "string",
  "detectedClaims": [
    { "id": "C1", "text": "string" }
  ],
  "speaker": "string",
  "type": "string",
  "verdict": "string",
  "verdictSummary": "string",
  "scoreThemes": [
    {
      "id": "factual",
      "label": "Based on facts",
      "score": 0,
      "summary": "string",
      "rationale": ["string", "string"],
      "sources": [
        {
          "sourceId": "S1",
          "title": "exact supplied title",
          "publisher": "human-readable publisher",
          "type": "Official | Academic | Journalism | Reference | Professional | Other",
          "role": "Supports | Contradicts | Contextualises | Defines | Verifies",
          "quality": "High | Medium | Low",
          "relevance": "why this source matters",
          "url": "exact supplied URL",
          "claimIds": ["C1"]
        }
      ]
    },
    {
      "id": "evidence",
      "label": "Evidence quality",
      "score": 0,
      "summary": "string",
      "rationale": ["string", "string"],
      "sources": []
    },
    {
      "id": "context",
      "label": "Enough context",
      "score": 0,
      "summary": "string",
      "rationale": ["string", "string"],
      "sources": []
    },
    {
      "id": "rhetoric",
      "label": "Fair wording",
      "score": 0,
      "summary": "string",
      "rationale": ["string", "string"],
      "sources": []
    }
  ],
  "rhetoricalCertainty": 0,
  "evidenceCertainty": 0,
  "certaintyGapSummary": "string",
  "annotations": [
    {
      "phrase": "exact substring from statement",
      "label": "string",
      "explanation": "string"
    }
  ],
  "defensibleRewrite": "string",
  "plainEnglish": "string",
  "bottomLine": "string"
}

Produce exactly 2 rationale items per score and 2–8 useful annotations.
`;

    failureStage = "initial_generation";
    const generationStartedAt = Date.now();
    const initialGeneration = await withProviderRetry(
      () =>
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        }),
      { maxRetries: 2, baseDelayMs: 900 }
    );

    const response = initialGeneration.value;
    generationMs = Date.now() - generationStartedAt;
    const initialProviderRetryCount = initialGeneration.retryCount;

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    failureStage = "initial_json_parse";
    const raw = JSON.parse(extractJson(response.text));

    failureStage = "initial_schema_validation";
    let finalAnalysis = normaliseAndParseAnalysis({
      raw,
      claim,
      detectedClaims,
      attributionName:
        attribution.detected && attribution.attribution
          ? attribution.attribution
          : null,
      retrievedSources,
    });

    failureStage = "local_quality_fixes";
    const localFixResult = applyLocalQualityFixes(finalAnalysis);
    finalAnalysis = localFixResult.analysis;
    const localQualityFixes = localFixResult.fixes;

    failureStage = "initial_quality_check";
    let qualityIssues = checkAnalysisQuality({
      analysis: finalAnalysis,
      attribution: attribution.attribution,
      proposition: attribution.proposition,
      retrievedSources,
    });

    const initialQualityIssues = qualityIssues.map((issue) => ({
      code: issue.code,
      message: issue.message,
    }));

    let repairAttempted = false;
    let repairSucceeded = false;
    let repairProviderRetryCount = 0;

    // Only substantive issues remain here. Simple verdict vocabulary, score
    // labels, duplicate source cleanup and known jargon are fixed locally first.
    if (qualityIssues.length > 0) {
      repairAttempted = true;

      const repairPrompt = `
You are repairing a previous How Sure? analysis that failed deterministic quality checks.

ORIGINAL STATEMENT:
"${claim.trim()}"

PROPOSITION BEING TESTED:
"${attribution.proposition}"

ATTRIBUTION:
${attribution.attribution ?? "Source not provided"}

DETECTED CLAIMS:
${JSON.stringify(detectedClaims)}

RETRIEVED EVIDENCE:
${formatEvidence(detectedClaims, retrievedSources)}

PREVIOUS ANALYSIS:
${JSON.stringify(finalAnalysis)}

QUALITY FAILURES:
${qualityIssues.map((issue, index) => `${index + 1}. ${issue.message}`).join("\n")}

REPAIR RULES:
- Return the full JSON object again, not a patch.
- Correct every listed failure.
- Judge the proposition, not whether the quote was correctly attributed.
- Treat “X says/claims/asserts that …” as attribution/provenance; assess the proposition after the reporting verb unless the proposition itself is explicitly about whether X said or did something.
- Use plain English for a general reader.
- Verdict should normally be 2–5 words.
- Bottom line must be one short sentence, ideally 12–22 words.
- Keep score labels exactly:
  factual = "Based on facts"
  evidence = "Evidence quality"
  context = "Enough context"
  rhetoric = "Fair wording"
- Higher scores must always mean better.
- Evidence quality measures the quality of evidence available to judge the claim, regardless of whether that evidence supports or contradicts it.
- evidenceCertainty measures how strongly the evidence supports the proposition.
- Use exactly one approved verdict:
  "Well supported", "Mostly supported", "Mixed evidence", "Not enough evidence",
  "Mostly opinion", "Misleading as stated", "Not supported by reliable evidence", or "False".
- Use "False" only when cited evidence directly contradicts the claim. If reliable data simply does not establish the claim, use "Not supported by reliable evidence".
- If the proposition is mainly subjective, evaluative, moral or value-based and is not objectively testable as stated, the verdict MUST be "Mostly opinion". Do not use "Not enough evidence" for inherently non-testable value judgements.
- plainEnglish / “What this means” must add a NEW interpretive distinction, not repeat or paraphrase the verdict, verdictSummary or bottomLine.
- In plainEnglish, NEVER mention the verdict category; whether the statement is opinion, factual, verifiable, supported, true, false, proved/disproved; evidence sufficiency; reporting, news coverage, sources, attribution; or whether the speaker said it. Avoid phrases such as “treat this as”, “you can trust that”, “news reports confirm”, “political opinion”, “factual claim”, and “cannot be proven”.
- Explain instead ONE concrete interpretive distinction: the standard being applied, an undefined term, an assumption, a comparison or a limitation. State what the proposition presupposes or leaves undefined, not whether it is correct. Keep it concrete and claim-specific.
- Only cite sources supplied above.
- Do not invent URLs, titles, publishers, dates, facts or quotations.
- Keep every scoreTheme summary to one short sentence (ideally 10–18 words).
- Give exactly two concise rationale items per scoreTheme, ideally 10–20 words each.
- Keep the four dimensions strictly separate: Based on facts = verifiability; Evidence quality = what the evidence establishes; Enough context = context that changes interpretation; Fair wording = the language itself.
- Do not repeat the same finding across dimensions.
- Separate attribution verification from evidence supporting the proposition. A source confirming who said something does not prove the proposition true.
- For Based on facts, discuss ONLY the underlying proposition's verifiability and factual support. Never mention the speaker, reporting or whether the quote is authentic.
- For Based on facts rationale ONLY: item 1 must state WHAT WE FOUND about whether the underlying proposition is objectively testable as stated; item 2 must state WHY THAT MATTERS by naming the missing or present measurable definition, criterion, comparison rule or test and explaining how it limits what evidence can establish. Item 2 MUST stay on testability: do not discuss political stance, policy preference, established rights, the speaker, motives, attribution, or whether a concept is legally recognised. If the sources only define terms, say that definitions do not provide an objective test for the central proposition. Keep the two items distinct.
- For Evidence quality, lead with what the evidence establishes about the underlying proposition. If sources mainly verify attribution/context, explicitly state that this does not establish the proposition.
- For Evidence quality rationale ONLY: item 1 must describe the role the displayed sources actually play for the proposition; if they mainly define terms, add context or verify attribution, say that plainly. Item 2 must explain what those sources can and cannot establish about the proposition. Both items must map directly to the source cards shown and focus on reliability, directness, relevance and independence. Do not repeat the Based on facts testability judgement.
- For Fair wording, analyse ONLY the wording of the underlying proposition, ignoring the reporting wrapper; do not infer intent or motive.
- For Fair wording rationale ONLY: item 1 must identify the specific word, phrase or construction affecting precision, neutrality, scope or strength; item 2 must explain how that wording changes interpretation by naming the undefined standard, broadened scope, categorical framing or other concrete language effect. Do not call a policy stance an "absolute principle" unless the proposition literally uses absolute language. Keep both items about language only, with no truth, evidence, context, attribution or motive analysis.
- Fair wording relies primarily on textual analysis rather than external sources. Do NOT cite sources merely because they define concepts mentioned in the statement or provide general background. Cite a source only when it is genuinely necessary to establish the exact wording or clarify a disputed term whose meaning is central to the wording assessment.
- For wording-focused annotations used in Statement Anatomy and Language analysis, each explanation must describe what the selected wording is doing linguistically or rhetorically. Do not explain whether the phrase is factual, true, false, supported, verifiable or opinion-based. Use only these label types when applicable: "Value judgement", "Undefined term", "Vague term", "Categorical wording", "Absolute wording", "Broad scope", "Broad generalisation", "Loaded framing", "Evaluative wording", "Comparison standard", or "Qualifier". Do not use neutral semantic labels such as "Legal concepts", "Policy topic", "Political context", or general subject matter.
- For Enough context, analyse ONLY context that changes interpretation of the underlying proposition and explain why it matters.
- For Enough context rationale ONLY: item 1 must state the actual contextual detail present or missing in the submitted statement itself, not the publication, outlet or place where the context came from; item 2 must explain exactly how that detail changes, narrows or qualifies interpretation. Avoid generic references to a “broader debate” or saying only that “more context is needed”. Keep both items concrete and claim-specific, and do not repeat factual-testability or evidence-quality findings.
- For Enough context source cards ONLY: each relevance sentence must identify the specific contextual detail that source contributes to interpreting this claim, and it must directly support the rationale shown. Do not describe only the general political or publication setting unless that setting materially changes the claim’s meaning.
- For Enough context, do not name a publication, outlet, article or source in the rationale unless that exact source is displayed in that theme's source cards. Prefer the contextual detail itself.
- Avoid em dashes (—) in user-facing generated prose. Prefer commas or full stops.
- annotation.phrase must be an exact substring of the original statement.
- Preserve detectedClaims exactly as supplied.
- defensibleRewrite must be an empty string.

Return JSON only, using exactly the same shape as the previous analysis.
`;

      failureStage = "repair_generation";
      const repairGeneration = await withProviderRetry(
        () =>
          ai.models.generateContent({
            model: MODEL,
            contents: repairPrompt,
            config: {
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MEDIUM,
              },
            },
          }),
        { maxRetries: 2, baseDelayMs: 900 }
      );
      const repairResponse = repairGeneration.value;
      repairProviderRetryCount = repairGeneration.retryCount;

      if (repairResponse.text) {
        try {
          failureStage = "repair_json_parse";
          const repairedRaw = JSON.parse(extractJson(repairResponse.text));

          failureStage = "repair_schema_validation";

          const repairedParsed = normaliseAndParseAnalysis({
            raw: repairedRaw,
            claim,
            detectedClaims,
            attributionName:
              attribution.detected && attribution.attribution
                ? attribution.attribution
                : null,
            retrievedSources,
          });

          const repairedLocalFixes = applyLocalQualityFixes(repairedParsed);
          const repairedAnalysis = repairedLocalFixes.analysis;

          failureStage = "repair_quality_check";
          const repairedIssues = checkAnalysisQuality({
            analysis: repairedAnalysis,
            attribution: attribution.attribution,
            proposition: attribution.proposition,
            retrievedSources,
          });

          if (repairedIssues.length < qualityIssues.length) {
            finalAnalysis = repairedAnalysis;
            qualityIssues = repairedIssues;
            localQualityFixes.push(...repairedLocalFixes.fixes);
          }

          repairSucceeded = repairedIssues.length === 0;
        } catch (repairError) {
          console.warn("Repair response could not be used:", repairError);
        }
      }
    }

    let uniqueSources = new Set(
      finalAnalysis.scoreThemes.flatMap((theme) =>
        theme.sources.map((source) => source.url)
      )
    );

    let retrievalFallbackAttempted = false;
    let retrievalFallbackAddedSources = 0;

    if (retrievedSources.length > 0 && uniqueSources.size === 0) {
      failureStage = "retrieval_fallback";
      retrievalFallbackAttempted = true;

      try {
        const fallbackQuery = buildFallbackQuery(detectedClaims);
        const fallbackResults = await searchEvidence(fallbackQuery, tavilyApiKey);

        const existingUrls = new Set(retrievedSources.map((source) => source.url));
        const freshFallback = fallbackResults.filter(
          (source) => !existingUrls.has(source.url)
        );

        if (freshFallback.length > 0) {
          retrievalFallbackAddedSources = freshFallback.length;

          const mergedSources = [
            ...retrievedSources,
            ...freshFallback.map((source) => ({
              ...source,
              claimIds: detectedClaims.map((claim) => claim.id),
            })),
          ]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, 16)
            .map((source, index) => ({
              ...source,
              id: `S${index + 1}`,
            }));

          const fallbackPrompt = `
You are re-evaluating a claim because the first retrieval pass produced sources
but none were useful enough to cite.

ORIGINAL STATEMENT:
"${claim.trim()}"

PROPOSITION:
"${attribution.proposition}"

DETECTED CLAIMS:
${JSON.stringify(detectedClaims)}

RETRIEVED EVIDENCE AFTER ONE TARGETED FALLBACK SEARCH:
${formatEvidence(detectedClaims, mergedSources)}

Use the same scoring, verdict vocabulary, source rules, and plain-English rules
as the original analysis.

Return the full JSON analysis object only.
`;

          const fallbackGeneration = await withProviderRetry(
            () =>
              ai.models.generateContent({
                model: MODEL,
                contents: fallbackPrompt,
                config: {
                  thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                  },
                },
              }),
            { maxRetries: 2, baseDelayMs: 900 }
          );

          if (fallbackGeneration.value.text) {
            const fallbackRaw = JSON.parse(
              extractJson(fallbackGeneration.value.text)
            );

            const fallbackParsed = normaliseAndParseAnalysis({
              raw: fallbackRaw,
              claim,
              detectedClaims,
              attributionName:
                attribution.detected && attribution.attribution
                  ? attribution.attribution
                  : null,
              retrievedSources: mergedSources,
            });

            const fallbackLocal = applyLocalQualityFixes(fallbackParsed);
            const fallbackIssues = checkAnalysisQuality({
              analysis: fallbackLocal.analysis,
              attribution: attribution.attribution,
              proposition: attribution.proposition,
              retrievedSources: mergedSources,
            });

            const fallbackCited = new Set(
              fallbackLocal.analysis.scoreThemes.flatMap((theme) =>
                theme.sources.map((source) => source.url)
              )
            );

            if (
              fallbackCited.size > uniqueSources.size &&
              fallbackIssues.length === 0
            ) {
              finalAnalysis = fallbackLocal.analysis;
              qualityIssues = [];
              localQualityFixes.push(...fallbackLocal.fixes);
              uniqueSources = fallbackCited;

              retrievedSources.splice(
                0,
                retrievedSources.length,
                ...mergedSources
              );
            }
          }
        }
      } catch (fallbackError) {
        console.warn("Retrieval fallback failed:", fallbackError);
      }
    }

    const retrievalQuality =
      retrievedSources.length === 0
        ? "none"
        : uniqueSources.size === 0
          ? "insufficient"
          : uniqueSources.size === 1
            ? "limited"
            : "usable";

    const lowConfidence = qualityIssues.length > 0;

    const verification: Verification = {
      status: lowConfidence
        ? "quality_checked_low_confidence"
        : repairAttempted
          ? "quality_checked_repaired"
          : "quality_checked",
      label: lowConfidence
        ? "Low confidence assessment"
        : repairAttempted
          ? "Quality checked · Repaired"
          : "Quality checked analysis",
      detail: lowConfidence
        ? `The analysis still failed ${qualityIssues.length} consistency check${qualityIssues.length === 1 ? "" : "s"} after one repair attempt. Treat this result with extra caution.`
        : retrievalQuality === "insufficient"
          ? `Search found ${retrievedSources.length} source${retrievedSources.length === 1 ? "" : "s"}, but none were useful enough to cite for this claim.`
          : repairAttempted
            ? `A substantive consistency issue was detected and automatically repaired before this result was shown. ${retrievedSources.length} unique source${retrievedSources.length === 1 ? "" : "s"} retrieved · ${uniqueSources.size} cited.`
            : `${detectedClaims.length} claim${detectedClaims.length === 1 ? "" : "s"} checked · ${retrievedSources.length} unique source${retrievedSources.length === 1 ? "" : "s"} retrieved · ${uniqueSources.size} cited.`,
      model: MODEL,
      searchProvider: "Tavily",
      detectedClaimCount: detectedClaims.length,
      attributionDetected: attribution.detected,
      proposition: attribution.proposition,
      retrievedSourceCount: retrievedSources.length,
      citedSourceCount: uniqueSources.size,
      qualityStatus: lowConfidence ? "low" : "passed",
      qualityIssueCount: qualityIssues.length,
      repairAttempted,
      repairSucceeded,
      initialProviderRetryCount,
      repairProviderRetryCount,
      retrievalFallbackAttempted,
      retrievalFallbackAddedSources,
      localQualityFixes,
      retrievalQuality,
      initialQualityIssues,
      finalQualityIssues: qualityIssues.map((issue) => ({
        code: issue.code,
        message: issue.message,
      })),
      pipelineVersion: PIPELINE_VERSION,
      cache: "fresh",
    };

    failureStage = "persistence";
    const persistenceStartedAt = Date.now();
    const analysisId = await saveAnalysis({
      claim: claim.trim(),
      claimHash: currentClaimHash,
      analysis: finalAnalysis,
      verification,
    });
    persistenceMs = Date.now() - persistenceStartedAt;

    after(() =>
      recordAnalysisRun({
      requestId,
      claimHash: currentClaimHash,
      analysisId,
      outcome: "success",
      durationMs: Date.now() - startedAt,
      retrievedSourceCount: retrievedSources.length,
      citedSourceCount: uniqueSources.size,
      repairAttempted,
      providerRetryCount:
        initialProviderRetryCount + repairProviderRetryCount,
        retrievalFallbackAttempted,
        retrievalQuality,
      })
    );

    return NextResponse.json(
      {
        analysisId,
        sharePath: `/analysis/${analysisId}`,
        analysis: finalAnalysis,
        verification,
      },
      {
        headers: {
          "Server-Timing": [
            `cache;dur=${cacheLookupMs}`,
            `retrieval;dur=${retrievalMs}`,
            `generation;dur=${generationMs}`,
            `persistence;dur=${persistenceMs}`,
            `total;dur=${Date.now() - startedAt}`,
          ].join(", "),
        },
      }
    );
  } catch (error) {
    console.error("Analyse claim error:", error);

    let status = 500;
    let code = "analysis_failed";
    let message = "The claim could not be analysed. Please try again.";

    if (error instanceof TavilyError) {
      if (error.status === 429) {
        status = 429;
        code = "search_quota_reached";
        message =
          "The web-search allowance has been reached. Existing shared analyses still work, but new evidence searches are temporarily unavailable.";
      } else {
        status = 502;
        code = "search_failed";
        message =
          "Live evidence search failed, so the claim was not analysed. Please try again.";
      }
    } else if (isQuotaError(error)) {
      status = 429;
      code = "ai_quota_reached";
      message =
        "The AI allowance has been reached. Existing shared analyses still work; new claims can be analysed again when capacity is available.";
    }

    after(() =>
      recordAnalysisRun({
        requestId,
        claimHash: currentClaimHash,
        outcome: "error",
        durationMs: Date.now() - startedAt,
        failureStage,
        errorCode: code,
      })
    );

    const detail = error instanceof Error ? error.message : "Unknown analysis error";

    return NextResponse.json(
      {
        code,
        stage: failureStage,
        error: message,
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      { status }
    );
  }
}
