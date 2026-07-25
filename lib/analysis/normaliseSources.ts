import type { RetrievedSource } from "@/lib/search/tavily";

type ModelSource = {
  sourceId?: string;
  title?: string;
  publisher?: string;
  type?: string;
  role?: string;
  quality?: string;
  relevance?: string;
  url?: string;
  claimIds?: string[];
};

const validRoles = new Set([
  "Supports",
  "Contradicts",
  "Contextualises",
  "Defines",
  "Verifies",
]);

const validQualities = new Set(["High", "Medium", "Low"]);

function safeRole(value?: string) {
  return validRoles.has(value ?? "") ? value! : "Contextualises";
}

function safeQuality(value?: string) {
  return validQualities.has(value ?? "") ? value! : "Medium";
}

export function normaliseModelSources(
  modelSources: unknown,
  retrieved: RetrievedSource[]
) {
  if (!Array.isArray(modelSources)) return [];

  const byId = new Map(retrieved.map((source) => [source.id, source]));
  const byUrl = new Map(retrieved.map((source) => [source.url, source]));
  const used = new Set<string>();

  return modelSources
    .map((raw): ReturnType<typeof mapSource> => mapSource(raw, byId, byUrl))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => {
      if (used.has(item.url)) return false;
      used.add(item.url);
      return true;
    })
    .slice(0, 6);
}

function mapSource(
  raw: unknown,
  byId: Map<string, RetrievedSource>,
  byUrl: Map<string, RetrievedSource>
) {
  if (!raw || typeof raw !== "object") return null;

  const model = raw as ModelSource;

  const source =
    (model.sourceId ? byId.get(model.sourceId) : undefined) ??
    (model.url ? byUrl.get(model.url) : undefined);

  // Critical trust boundary: if Tavily did not retrieve it, it is not shown.
  if (!source) return null;

  return {
    title: source.title,
    publisher: model.publisher?.trim() || source.publisher,
    type: model.type?.trim() || "Web source",
    role: safeRole(model.role) as
      | "Supports"
      | "Contradicts"
      | "Contextualises"
      | "Defines"
      | "Verifies",
    quality: safeQuality(model.quality) as "High" | "Medium" | "Low",
    relevance:
      model.relevance?.trim() ||
      "Retrieved as potentially relevant evidence for this claim.",
    url: source.url,
    claimIds: Array.isArray(model.claimIds)
      ? model.claimIds.filter((id): id is string => typeof id === "string")
      : (source.claimIds ?? []),
  };
}
