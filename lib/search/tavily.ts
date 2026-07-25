export type RetrievedSource = {
  id: string;
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
  publisher: string;
  claimIds?: string[];
};

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
};

function publisherFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown publisher";
  }
}

/**
 * Tavily currently caps a single search query at 400 characters.
 *
 * We keep the full statement for Gemini analysis, but derive a smaller
 * retrieval query for web search.
 *
 * Strategy:
 * 1. normalise whitespace / quote punctuation
 * 2. keep the whole statement when it already fits
 * 3. for long statements, preserve the beginning and end so we retain
 *    both topic framing and later factual/policy claims
 */
export function buildSearchQuery(claim: string) {
  const normalized = claim
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  if (normalized.length <= 390) {
    return normalized;
  }

  const headLength = 240;
  const tailLength = 130;

  const head = normalized.slice(0, headLength);
  const tail = normalized.slice(-tailLength);

  // Keep comfortably below Tavily's 400-character hard limit.
  return `${head} … ${tail}`.slice(0, 390);
}

export class TavilyError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "TavilyError";
    this.status = status;
  }
}

export async function searchEvidence(
  claim: string,
  apiKey: string
): Promise<RetrievedSource[]> {
  const query = buildSearchQuery(claim);

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      topic: "general",
      max_results: 8,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new TavilyError(
      `Tavily search failed (${response.status}): ${body}`,
      response.status
    );
  }

  const payload = (await response.json()) as {
    results?: TavilyResult[];
  };

  const seen = new Set<string>();

  return (payload.results ?? [])
    .filter(
      (item): item is Required<Pick<TavilyResult, "title" | "url">> & TavilyResult =>
        Boolean(item.title && item.url)
    )
    .filter((item) => {
      if (seen.has(item.url!)) return false;
      seen.add(item.url!);
      return true;
    })
    .slice(0, 8)
    .map((item, index) => ({
      id: `S${index + 1}`,
      title: item.title!,
      url: item.url!,
      content: (item.content ?? "").slice(0, 1600),
      score: item.score,
      publishedDate: item.published_date,
      publisher: publisherFromUrl(item.url!),
    }));
}
