"use client";

import type { ScoreTheme, Source } from "@/types/claim";
import { motion, useReducedMotion } from "motion/react";

type Props = {
  theme: ScoreTheme;
  onClose: () => void;
};

export function SourceCard({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="source-card"
    >
      <div className="source-card-topline">
        <span className={`source-role source-role--${source.role.toLowerCase()}`}>
          {source.role}
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

export function EvidencePanel({ theme, onClose }: Props) {
  const reduceMotion = useReducedMotion();

  const highQualityCount = theme.sources.filter(
    (source) => source.quality === "High"
  ).length;

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
        </div>

        <div className="evidence-panel-score">
          <span>{theme.score}</span>
          <small>/ 100</small>
        </div>

        <button className="evidence-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="evidence-panel-body">
        <div className="evidence-reasoning">
          <p className="section-label">Why this score?</p>

          <ul>
            {theme.rationale.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
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

            {theme.sources.length > 0 && (
              <div className="source-legend" aria-label="Source roles">
                <span>Supports</span>
                <span>Contradicts</span>
                <span>Contextualises</span>
                <span>Defines</span>
                <span>Verifies</span>
              </div>
            )}
          </div>

          {theme.sources.length ? (
            <div className="source-list">
              {theme.sources.map((source) => (
                <SourceCard key={`${source.url}-${source.role}`} source={source} />
              ))}
            </div>
          ) : (
            <div className="no-source-note">
              <strong>Textual analysis</strong>
              <p>
                No retrieved web source was used directly for this score.
                This part of the assessment is based on the wording, logic or
                structure of the statement itself.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
