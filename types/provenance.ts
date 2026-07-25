export type ProvenanceCandidate = {
  sourceId: string;
  speaker: string;
  sourceTitle: string;
  publisher: string;
  date: string;
  url: string;
  confidence: "High" | "Medium" | "Low";
  explanation: string;
};

export type ProvenanceResult = {
  status: "found" | "uncertain" | "not_found";
  summary: string;
  candidates: ProvenanceCandidate[];
};
