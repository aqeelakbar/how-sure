"use client";

import { useState } from "react";
import type { Annotation } from "@/types/claim";
import { Reveal } from "@/components/Reveal";

type Props = {
  statement: string;
  annotations: Annotation[];
};

export function StatementAnatomy({ statement, annotations }: Props) {
  const [active, setActive] = useState<Annotation | null>(
    annotations[0] ?? null
  );
  const [showAnalysis, setShowAnalysis] = useState(false);

  const parts: Array<{ text: string; annotation?: Annotation }> = [];
  let cursor = 0;

  annotations.forEach((annotation) => {
    const index = statement
      .toLowerCase()
      .indexOf(annotation.phrase.toLowerCase(), cursor);

    if (index === -1) return;

    if (index > cursor) {
      parts.push({ text: statement.slice(cursor, index) });
    }

    parts.push({
      text: statement.slice(index, index + annotation.phrase.length),
      annotation,
    });

    cursor = index + annotation.phrase.length;
  });

  if (cursor < statement.length) {
    parts.push({ text: statement.slice(cursor) });
  }

  return (
    <section className={`section anatomy-section ${showAnalysis ? "anatomy-section--open" : "anatomy-section--closed"}`}>
      <Reveal className="anatomy-disclosure">
        <div className="anatomy-disclosure-copy">
          <p className="section-label">Statement anatomy</p>
          <h2>What words are doing the work?</h2>
          <p>Inspect the language that shapes how the statement is framed and understood.</p>
        </div>

        <button
          type="button"
          className="anatomy-disclosure-action"
          aria-expanded={showAnalysis}
          onClick={() => setShowAnalysis((current) => !current)}
        >
          {showAnalysis ? "Close wording" : "Inspect wording"}
          <span aria-hidden="true">{showAnalysis ? "−" : "+"}</span>
        </button>
      </Reveal>

      {showAnalysis && (
        <div className="anatomy-analysis">
          <div className="anatomy-workspace">
            <Reveal className="anatomy-statement">
              <p className="annotated-quote">
                {parts.map((part, index) =>
                  part.annotation ? (
                    <button
                      key={`${part.text}-${index}`}
                      type="button"
                      className={`annotated-phrase ${
                        active?.phrase === part.annotation.phrase
                          ? "is-active"
                          : ""
                      }`}
                      aria-pressed={
                        active?.phrase === part.annotation.phrase
                      }
                      onClick={() => setActive(part.annotation ?? null)}
                    >
                      {part.text}
                    </button>
                  ) : (
                    <span key={`${part.text}-${index}`}>{part.text}</span>
                  )
                )}
              </p>
            </Reveal>

            <aside className="anatomy-inspector" aria-live="polite">
              <div className="anatomy-inspector-inner">
                {active ? (
                  <>
                    <p className="section-label">Selected language</p>
                    <blockquote className="annotation-phrase">
                      “{active.phrase}”
                    </blockquote>

                    <div className="annotation-detail">
                      <p className="annotation-kicker">What it is doing</p>
                      <h3>{active.label}</h3>
                      <p>{active.explanation}</p>
                    </div>

                    <p className="anatomy-hint">
                      Select another underlined phrase to inspect it.
                    </p>
                  </>
                ) : (
                  <p className="anatomy-empty">
                    Select an underlined phrase to see why it matters.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}
    </section>
  );
}
