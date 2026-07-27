"use client";

import type { Annotation, ScoreTheme, Source } from "@/types/claim";
import { motion, useReducedMotion } from "motion/react";

type Props = {
  theme: ScoreTheme;
  annotations?: Annotation[];
  onClose: () => void;
};

function factualTestabilityLabel(score: number) {
  if (score >= 85) return "Very high factual testability";
  if (score >= 70) return "High factual testability";
  if (score >= 50) return "Mixed factual testability";
  if (score >= 25) return "Low factual testability";
  return "Very low factual testability";
}


function evidenceQualityLabel(score: number) {
  if (score >= 85) return "Very high evidence quality";
  if (score >= 70) return "High evidence quality";
  if (score >= 50) return "Limited direct evidence";
  if (score >= 25) return "Low evidence quality";
  return "Very low evidence quality";
}

function contextQualityLabel(score: number) {
  if (score >= 85) return "Very complete context";
  if (score >= 70) return "Good contextual coverage";
  if (score >= 50) return "Partial context";
  if (score >= 25) return "Limited context";
  return "Very limited context";
}

function wordingQualityLabel(score: number) {
  if (score >= 85) return "Very neutral wording";
  if (score >= 70) return "Mostly neutral wording";
  if (score >= 50) return "Mixed wording";
  if (score >= 25) return "Evaluative wording";
  return "Strongly loaded wording";
}

function clarifiedRole(role: Source["role"]) {
  switch (role) {
    case "Supports":
      return "Supports proposition";
    case "Contradicts":
      return "Contradicts proposition";
    case "Contextualises":
      return "Adds context";
    case "Defines":
      return "Defines term";
    case "Verifies":
      return "Verifies attribution";
  }
}

export function SourceCard({
  source,
  clarifyRole = false,
}: {
  source: Source;
  clarifyRole?: boolean;
}) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="source-card"
    >
      <div className="source-card-topline">
        <span className={`source-role source-role--${source.role.toLowerCase()}`}>
          {clarifyRole ? clarifiedRole(source.role) : source.role}
        </span>

        <span className={`source-quality source-quality--${source.quality.toLowerCase()}`}>
          {source.quality} quality
        </span>
      </div>

      <span className="source-meta">
        {source.publisher} · {source.type}
      </span>

      <strong>{source.title}</strong>
      <span className="source-relevance">{source.relevance}</span>

      <span className="source-link">Open source ↗</span>
    </a>
  );
}

export function EvidencePanel({ theme, annotations = [], onClose }: Props) {
  const reduceMotion = useReducedMotion();
  const isFactualTheme = theme.id === "factual";
  const isEvidenceTheme = theme.id === "evidence";
  const isContextTheme = theme.id === "context";
  const isWordingTheme = theme.id === "rhetoric";
  const usesEditorialRating =
    isFactualTheme || isEvidenceTheme || isContextTheme || isWordingTheme;

  const highQualityCount = theme.sources.filter(
    (source) => source.quality === "High"
  ).length;

  const languageSignals = annotations
    .filter((annotation) => {
      const label = annotation.label.toLowerCase();
      const allowedWordingSignals = [
        "value judgement",
        "undefined term",
        "vague term",
        "categorical wording",
        "absolute wording",
        "broad scope",
        "broad generalisation",
        "loaded framing",
        "evaluative wording",
        "comparison standard",
        "qualifier",
      ];

      return allowedWordingSignals.some((signal) => label.includes(signal));
    })
    .slice(0, 4);

  return (
    <motion.section
      className="evidence-panel"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.45,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div className="evidence-panel-header">
        <div>
          <p className="section-label">Evidence detail</p>
          <h3>{theme.label}</h3>
          {usesEditorialRating && (
            <div className="evidence-panel-rating-inline">
              <strong>
                {isFactualTheme
                  ? factualTestabilityLabel(theme.score)
                  : isEvidenceTheme
                    ? evidenceQualityLabel(theme.score)
                    : isContextTheme
                      ? contextQualityLabel(theme.score)
                      : wordingQualityLabel(theme.score)}
              </strong>
              <span>{theme.score}/100</span>
            </div>
          )}
        </div>

        {!usesEditorialRating && (
          <div className="evidence-panel-score">
            <span>{theme.score}</span>
            <small>/ 100</small>
          </div>
        )}

        <button className="evidence-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="evidence-panel-body">
        <div className="evidence-reasoning">
          <p className="section-label">{usesEditorialRating ? "Why this rating?" : "Why this score?"}</p>

          {usesEditorialRating ? (
            <div className="evidence-findings">
              <div>
                <span className="evidence-finding-label">What we found</span>
                <p>{theme.rationale[0]}</p>
              </div>
              <div>
                <span className="evidence-finding-label">Why it matters</span>
                <p>{theme.rationale[1]}</p>
              </div>
            </div>
          ) : (
            <ul>
              {theme.rationale.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="evidence-sources">
          <div className="source-section-heading">
            <div>
              <p className="section-label">Sources</p>
              <p className="source-count">
                {theme.sources.length
                  ? `${theme.sources.length} sources · ${highQualityCount} high quality`
                  : "No external sources used"}
              </p>
            </div>

            {theme.sources.length > 0 && !usesEditorialRating && (
              <div className="source-legend" aria-label="Source roles">
                <span>Supports</span>
                <span>Contradicts</span>
                <span>Contextualises</span>
                <span>Defines</span>
                <span>Verifies</span>
              </div>
            )}
          </div>

          {isWordingTheme ? (
            <div className="wording-detail-stack">
              <div className="language-analysis">
                <div className="language-analysis-heading">
                  <p className="section-label">Language analysis</p>
                  <p>Based on the wording of the proposition itself.</p>
                </div>

                {languageSignals.length ? (
                  <div className="language-signal-list">
                    {languageSignals.map((annotation) => (
                      <div
                        className="language-signal"
                        key={`${annotation.phrase}-${annotation.label}`}
                      >
                        <span className="language-signal-label">{annotation.label}</span>
                        <strong>“{annotation.phrase}”</strong>
                        <p>{annotation.explanation}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="language-signal">
                    <span className="language-signal-label">Wording signal</span>
                    <p>{theme.rationale[0]}</p>
                  </div>
                )}
              </div>

              {theme.sources.length > 0 && (
                <div className="wording-reference">
                  <div className="wording-reference-heading">
                    <p className="section-label">Reference used</p>
                    <p>
                      Included only where a source is needed to clarify wording or a disputed term.
                    </p>
                  </div>
                  <div className="source-list">
                    {theme.sources.map((source) => (
                      <SourceCard
                        key={`${source.url}-${source.role}`}
                        source={source}
                        clarifyRole
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : theme.sources.length ? (
            <div className="source-list">
              {theme.sources.map((source) => (
                <SourceCard
                  key={`${source.url}-${source.role}`}
                  source={source}
                  clarifyRole={usesEditorialRating}
                />
              ))}
            </div>
          ) : (
            <div className="no-source-note">
              <strong>No external sources used</strong>
              <p>
                This part of the assessment is based on the statement itself.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="evidence-panel-footer">
        <button
          type="button"
          className="evidence-close evidence-close--footer"
          onClick={onClose}
        >
          Close evidence
        </button>
      </div>
    </motion.section>
  );
}
