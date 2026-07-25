import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
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

  // Keep Tavily usage bounded for long statements.
  const searchClaims = claims.slice(0, 5);

  for (const claim of searchClaims) {
    const results = await searchEvidence(claim.text, apiKey);

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

    if (claim.length > 1200) {
      return NextResponse.json(
        { error: "Please keep the claim under 1,200 characters." },
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
    const cached = await findServerCachedAnalysis(currentClaimHash);

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

      await recordAnalysisRun({
        requestId,
        claimHash: currentClaimHash,
        analysisId: cached.id,
        outcome: "server_cache_hit",
        durationMs: Date.now() - startedAt,
        retrievedSourceCount: cached.verification.retrievedSourceCount ?? null,
        citedSourceCount: cached.verification.citedSourceCount ?? null,
        repairAttempted: cached.verification.repairAttempted ?? false,
        providerRetryCount:
          (cached.verification.initialProviderRetryCount ?? 0) +
          (cached.verification.repairProviderRetryCount ?? 0),
        retrievalFallbackAttempted:
          cached.verification.retrievalFallbackAttempted ?? false,
        retrievalQuality: cached.verification.retrievalQuality ?? null,
      });

      return NextResponse.json({
        analysisId: cached.id,
        sharePath: `/analysis/${cached.id}`,
        analysis: cached.analysis,
        verification: cachedVerification,
      });
    }

    failureStage = "rate_limit";
    const rateLimit = await consumeFreshAnalysisLimit(request);
    if (!rateLimit.allowed) {
      await recordAnalysisRun({
        requestId,
        claimHash: currentClaimHash,
        outcome: "error",
        durationMs: Date.now() - startedAt,
        failureStage,
        errorCode: rateLimit.code,
      });

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
    const attribution = parseAttribution(claim.trim());

    // Retrieval should test the proposition itself, not a reporting wrapper
    // such as "Kemi Badenoch says ...".
    const detectedClaims = extractRetrievalClaims(attribution.proposition);

    // Multiple focused Tavily searches, still only one Gemini request.
    failureStage = "evidence_retrieval";
    const retrievedSources = await retrieveForClaims(
      detectedClaims,
      tavilyApiKey
    );

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const prompt = `
You are the analysis engine for "How Sure?", an evidence-backed claim analysis prototype.

ORIGINAL STATEMENT:
"${claim.trim()}"

ATTRIBUTION PARSE:
- Attribution wrapper detected: ${attribution.detected ? "yes" : "no"}
- Attributed speaker/source: ${attribution.attribution ?? "not detected"}
- Proposition being tested: "${attribution.proposition}"

${formatEvidence(detectedClaims, retrievedSources)}

IMPORTANT ABOUT ATTRIBUTION:
- If an attribution wrapper was detected, treat the attributed person/source separately from the proposition.
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
- The trust judgement is about the proposition, not the attribution wrapper.
- "Should I trust this claim?" means: how justified is the proposition by the available evidence?
- "Bottom line" must answer that same question in one short, plain-English sentence.
- If the proposition is mainly subjective/evaluative (for example "too easy", "unfair", "a disaster"), explain that in everyday language.
- Do not substitute "the speaker really said this" for "the claim is supported."
- Write for a general reader with no specialist knowledge.
- Prefer short words and short sentences.
- Avoid academic or technical terms such as "empirical", "evaluative proposition", "substantiated", "factual reality", "epistemic", or "rhetorical certainty" in user-facing prose unless absolutely necessary.
- If a specialist concept is needed, explain it immediately in ordinary language.

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

Produce 2–5 rationale items per score and 2–8 useful annotations.
`;

    failureStage = "initial_generation";
    const initialGeneration = await withProviderRetry(
      () =>
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
        }),
      { maxRetries: 2, baseDelayMs: 900 }
    );

    const response = initialGeneration.value;
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
- Only cite sources supplied above.
- Do not invent URLs, titles, publishers, dates, facts or quotations.
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
    const analysisId = await saveAnalysis({
      claim: claim.trim(),
      claimHash: currentClaimHash,
      analysis: finalAnalysis,
      verification,
    });

    await recordAnalysisRun({
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
    });

    return NextResponse.json({
      analysisId,
      sharePath: `/analysis/${analysisId}`,
      analysis: finalAnalysis,
      verification,
    });
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

    await recordAnalysisRun({
      requestId,
      claimHash: currentClaimHash,
      outcome: "error",
      durationMs: Date.now() - startedAt,
      failureStage,
      errorCode: code,
    });

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
