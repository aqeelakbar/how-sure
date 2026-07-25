export type SourceRole =
  | "Supports"
  | "Contradicts"
  | "Contextualises"
  | "Defines"
  | "Verifies";

export type SourceQuality = "High" | "Medium" | "Low";

export type Source = {
  title: string;
  publisher: string;
  type: string;
  role: SourceRole;
  quality: SourceQuality;
  relevance: string;
  url: string;
  claimIds?: string[];
};

export type ScoreTheme = {
  id: string;
  label: string;
  score: number;
  summary: string;
  rationale: string[];
  sources: Source[];
};

export type Annotation = {
  phrase: string;
  label: string;
  explanation: string;
};

export type ClaimAnalysis = {
  statement: string;
  detectedClaims: Array<{
    id: string;
    text: string;
  }>;
  speaker: string;
  type: string;
  verdict: string;
  verdictSummary: string;
  scoreThemes: ScoreTheme[];
  rhetoricalCertainty: number;
  evidenceCertainty: number;
  certaintyGapSummary: string;
  annotations: Annotation[];
  defensibleRewrite: string;
  plainEnglish: string;
  bottomLine: string;
};
