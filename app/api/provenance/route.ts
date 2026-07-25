import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { extractJson } from "@/lib/ai/json";
import { searchEvidence, TavilyError } from "@/lib/search/tavily";
import type { ProvenanceResult } from "@/types/provenance";

const MODEL = "gemini-3.6-flash";

function buildQuery(claim: string) {
  const normalized = claim.trim().replace(/\s+/g, " ");
  if (normalized.length <= 300) return `"${normalized}"`;
  const first = normalized.slice(0, 150);
  const middleStart = Math.max(0, Math.floor(normalized.length / 2) - 70);
  const middle = normalized.slice(middleStart, middleStart + 140);
  return `"${first}" "${middle}"`.slice(0, 390);
}

export async function POST(request: Request) {
  try {
    const { claim } = await request.json();

    if (typeof claim !== "string" || claim.trim().length < 8) {
      return NextResponse.json({ error: "Please provide a longer quote." }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const tavilyKey = process.env.TAVILY_API_KEY;

    if (!geminiKey || !tavilyKey) {
      return NextResponse.json(
        { error: "Gemini and Tavily API keys are required." },
        { status: 500 }
      );
    }

    const retrieved = await searchEvidence(buildQuery(claim), tavilyKey);

    if (!retrieved.length) {
      const result: ProvenanceResult = {
        status: "not_found",
        summary: "No likely original source was found in the retrieved results.",
        candidates: [],
      };
      return NextResponse.json({ provenance: result });
    }

    const sourceText = retrieved.map((s) => `
[${s.id}]
TITLE: ${s.title}
PUBLISHER: ${s.publisher}
URL: ${s.url}
PUBLISHED: ${s.publishedDate ?? "Not supplied"}
EXTRACT: ${s.content}
`).join("\n---\n");

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `
Identify the likely provenance of this quote:

"${claim.trim()}"

SEARCH RESULTS:
${sourceText}

Rules:
- Use only supplied sources.
- Never invent a speaker, date, source, or URL.
- Prefer direct transcripts, official speeches, interviews, parliamentary records, first-party posts, or contemporaneous reporting.
- A page repeating the quote is not automatically the original source.
- sourceId must match a supplied ID.
- url must exactly match the retrieved URL.
- Return status found, uncertain, or not_found.
- Return at most 3 candidates.

Return JSON only:
{
  "status": "found | uncertain | not_found",
  "summary": "string",
  "candidates": [
    {
      "sourceId": "S1",
      "speaker": "string",
      "sourceTitle": "string",
      "publisher": "string",
      "date": "string",
      "url": "string",
      "confidence": "High | Medium | Low",
      "explanation": "string"
    }
  ]
}
`,
    });

    if (!response.text) throw new Error("Empty provenance response.");

    const raw = JSON.parse(extractJson(response.text)) as ProvenanceResult;
    const byId = new Map(retrieved.map((s) => [s.id, s]));

    const candidates = Array.isArray(raw.candidates)
      ? raw.candidates
          .map((c) => {
            const source = byId.get(c.sourceId);
            if (!source) return null;

            return {
              ...c,
              sourceTitle: source.title,
              publisher: c.publisher || source.publisher,
              url: source.url,
              date: c.date || source.publishedDate || "Not provided",
            };
          })
          .filter(Boolean)
          .slice(0, 3)
      : [];

    return NextResponse.json({
      provenance: {
        status:
          raw.status === "found" || raw.status === "uncertain" || raw.status === "not_found"
            ? raw.status
            : candidates.length
              ? "uncertain"
              : "not_found",
        summary: raw.summary || "Attribution remains uncertain.",
        candidates,
      },
    });
  } catch (error) {
    console.error("Provenance search error:", error);

    if (error instanceof TavilyError && error.status === 429) {
      return NextResponse.json(
        { error: "The free web-search allowance has been reached." },
        { status: 429 }
      );
    }

    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: number }).status
        : undefined;

    if (status === 429) {
      return NextResponse.json(
        { error: "The free AI allowance has been reached." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "The original source could not be checked right now." },
      { status: 500 }
    );
  }
}
