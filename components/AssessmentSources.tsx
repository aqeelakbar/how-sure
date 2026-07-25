"use client";

import { useMemo, useState } from "react";
import { SourceCard } from "@/components/EvidencePanel";
import type { ScoreTheme, Source } from "@/types/claim";

type Props = {
  themes: ScoreTheme[];
};

function dedupeSources(themes: ScoreTheme[]) {
  const sources = new Map<string, Source>();

  for (const theme of themes) {
    for (const source of theme.sources) {
      const key = `${source.url}::${source.role}`;
      if (!sources.has(key)) sources.set(key, source);
    }
  }

  return [...sources.values()];
}

export function AssessmentSources({ themes }: Props) {
  const [open, setOpen] = useState(false);
  const sources = useMemo(() => dedupeSources(themes), [themes]);
  const uniquePublishers = new Set(sources.map((source) => source.publisher)).size;

  if (!sources.length) return null;

  return (
    <section className="assessment-sources">
      <button
        type="button"
        className="assessment-sources-trigger"
        aria-expanded={open}
        aria-controls="assessment-cited-sources"
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>{open ? "Hide cited sources" : "View cited sources"}</strong>
          <small>
            {sources.length} source{sources.length === 1 ? "" : "s"} used across the assessment
          </small>
        </span>
        <span className="assessment-sources-trigger-icon" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div id="assessment-cited-sources" className="assessment-sources-content">
          <div className="assessment-sources-intro">
            <p>
              These are the sources used to support, challenge or add context to
              the assessment. Open any source to inspect it for yourself.
            </p>
            <span>
              {uniquePublishers} publisher{uniquePublishers === 1 ? "" : "s"}
            </span>
          </div>

          <div className="source-list assessment-source-list">
            {sources.map((source) => (
              <SourceCard
                key={`${source.url}-${source.role}`}
                source={source}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
