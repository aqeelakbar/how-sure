import { z } from "zod";

export const sourceSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  type: z.string(),
  role: z.enum([
    "Supports",
    "Contradicts",
    "Contextualises",
    "Defines",
    "Verifies",
  ]),
  quality: z.enum(["High", "Medium", "Low"]),
  relevance: z.string(),
  url: z.string(),
  claimIds: z.array(z.string()).optional().default([]),
});

export const scoreThemeSchema = z.object({
  id: z.enum(["factual", "evidence", "context", "rhetoric"]),
  label: z.string(),
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  rationale: z.array(z.string()).min(2).max(5),
  sources: z.array(sourceSchema).max(6),
});

export const annotationSchema = z.object({
  phrase: z.string(),
  label: z.string(),
  explanation: z.string(),
});

export const claimAnalysisSchema = z.object({
  statement: z.string(),
  detectedClaims: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
      })
    )
    .min(1)
    .max(5),
  speaker: z.string(),
  type: z.string(),
  verdict: z.string(),
  answerHeadline: z.string().optional().default(""),
  verdictSummary: z.string(),
  scoreThemes: z.array(scoreThemeSchema).length(4),
  rhetoricalCertainty: z.number().int().min(0).max(100),
  evidenceCertainty: z.number().int().min(0).max(100),
  certaintyGapSummary: z.string(),

  annotations: z.array(annotationSchema).max(8).default([]),

  defensibleRewrite: z.string(),
  plainEnglish: z.string(),
  bottomLine: z.string(),
});

export type ClaimAnalysisPayload = z.infer<typeof claimAnalysisSchema>;