"use client";

import { useState } from "react";
import type { ProvenanceResult } from "@/types/provenance";

type Props = { claim: string; speaker: string };

function knownSpeaker(speaker: string) {
  const s = speaker.trim().toLowerCase();
  return Boolean(
    speaker.trim() &&
      s !== "unknown / not provided" &&
      s !== "source not provided"
  );
}

export function ProvenancePanel({ claim, speaker }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProvenanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function findSource() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Source search failed.");
      }

      setResult(payload.provenance);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The source could not be checked."
      );
    } finally {
      setLoading(false);
    }
  }

  if (knownSpeaker(speaker)) {
    return (
      <aside className="context-row provenance-panel provenance-panel--known">
        <div className="context-row-label">
          <p className="section-label">Quote provenance</p>
        </div>

        <div className="context-row-content">
          <div className="provenance-known-row">
            <strong>{speaker}</strong>
            <span>Attributed in the submitted text</span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="context-row provenance-panel">
      <div className="context-row-label">
        <p className="section-label">Quote provenance</p>
      </div>

      <div className="context-row-content">
        <div className="provenance-header">
          <div className="provenance-unknown-row">
            <strong>Source not provided</strong>
            <span>Attribution is not inferred from wording alone.</span>
          </div>

          <button
            className="secondary-action"
            onClick={findSource}
            disabled={loading}
          >
            {loading ? "Searching…" : "Find original source"}
          </button>
        </div>

        {error && <p className="provenance-error">{error}</p>}

        {result && (
          <div className="provenance-result">
          <div className="provenance-summary">
            <span>{result.status.replace("_", " ")}</span>
            <p>{result.summary}</p>
          </div>

          {result.candidates.length > 0 && (
            <div className="provenance-candidates">
              {result.candidates.map((c) => (
                <article
                  key={`${c.sourceId}-${c.url}`}
                  className="provenance-candidate"
                >
                  <div className="provenance-candidate-top">
                    <strong>{c.speaker}</strong>
                    <span>{c.confidence} confidence</span>
                  </div>

                  <p className="provenance-source-title">{c.sourceTitle}</p>

                  <div className="provenance-meta">
                    <span>{c.publisher}</span>
                    <span>{c.date}</span>
                  </div>

                  <p>{c.explanation}</p>

                  <a href={c.url} target="_blank" rel="noreferrer">
                    Open source ↗
                  </a>
                </article>
              ))}
            </div>
          )}
          </div>
        )}
      </div>
    </aside>
  );
}
