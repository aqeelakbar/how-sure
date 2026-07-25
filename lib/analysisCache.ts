import type { ClaimAnalysis } from "@/types/claim";

type Verification = {
  status: string;
  label: string;
  detail: string;
  model?: string;
  searchProvider?: string;
  retrievedSourceCount?: number;
  citedSourceCount?: number;
  detectedClaimCount?: number;
  attributionDetected?: boolean;
  proposition?: string;
  qualityStatus?: "passed" | "low";
  qualityIssueCount?: number;
  repairAttempted?: boolean;
  repairSucceeded?: boolean;
  initialProviderRetryCount?: number;
  repairProviderRetryCount?: number;
  retrievalFallbackAttempted?: boolean;
  retrievalFallbackAddedSources?: number;
  localQualityFixes?: Array<{ code: string; message: string }>;
  retrievalQuality?: "none" | "insufficient" | "limited" | "usable";
  initialQualityIssues?: Array<{ code: string; message: string }>;
  finalQualityIssues?: Array<{ code: string; message: string }>;
};

type CachedValue = {
  analysis: ClaimAnalysis;
  verification: Verification;
};

type CacheEntry = CachedValue & {
  key: string;
  createdAt: number;
};

const STORAGE_KEY = "how-sure.analysis-cache.v6-3-resilience";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 50;

function normalizeClaim(claim: string) {
  return claim
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .toLocaleLowerCase("en");
}

function readEntries(): CacheEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();

    return parsed.filter(
      (entry): entry is CacheEntry =>
        Boolean(entry) &&
        typeof entry.key === "string" &&
        typeof entry.createdAt === "number" &&
        now - entry.createdAt < TTL_MS
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: CacheEntry[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_ENTRIES))
    );
  } catch {
    // Cache failure should never prevent analysis.
  }
}

export function getCachedAnalysis(claim: string): CachedValue | null {
  const key = normalizeClaim(claim);
  const entries = readEntries();
  const match = entries.find((entry) => entry.key === key);

  // Opportunistically remove expired entries.
  writeEntries(entries);

  if (!match) return null;

  return {
    analysis: match.analysis,
    verification: match.verification,
  };
}

export function setCachedAnalysis(claim: string, value: CachedValue) {
  const key = normalizeClaim(claim);
  const entries = readEntries().filter((entry) => entry.key !== key);

  writeEntries([
    {
      key,
      createdAt: Date.now(),
      ...value,
    },
    ...entries,
  ]);
}
