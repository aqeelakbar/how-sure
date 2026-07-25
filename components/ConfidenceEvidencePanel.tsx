"use client";

import { motion, useReducedMotion } from "motion/react";
import { SourceCard } from "@/components/EvidencePanel";
import type { Source } from "@/types/claim";

type Props = {
  sources: Source[];
  onClose: () => void;
};

export function ConfidenceEvidencePanel({ sources, onClose }: Props) {
  const reduceMotion = useReducedMotion();
  const highQualityCount = sources.filter(
    (source) => source.quality === "High"
  ).length;

  return (
    <motion.section
      className="confidence-evidence-panel"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div className="confidence-evidence-header">
        <div>
          <p className="section-label">Evidence behind this comparison</p>
          <h3>Why the claim and evidence do not fully match</h3>
          <p>
            These are the sources used to judge whether the statement sounds
            more certain than the available evidence allows.
          </p>
        </div>

        <button
          type="button"
          className="evidence-close"
          onClick={onClose}
          aria-label="Close supporting evidence"
        >
          Close
        </button>
      </div>

      <div className="confidence-evidence-meta">
        {sources.length} source{sources.length === 1 ? "" : "s"} · {highQualityCount}{" "}
        high quality
      </div>

      <div className="source-list confidence-evidence-list">
        {sources.map((source) => (
          <SourceCard key={`${source.url}-${source.role}`} source={source} />
        ))}
      </div>
    </motion.section>
  );
}
