"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ConfidenceEvidencePanel } from "@/components/ConfidenceEvidencePanel";
import { Reveal } from "@/components/Reveal";
import type { Source } from "@/types/claim";

type Props = {
  claimConfidence: number;
  evidenceSupport: number;
  summary: string;
  sources: Source[];
};

function getBalanceLabel(balance: number) {
  if (balance <= -60) return "Strong overclaim";
  if (balance <= -30) return "Moderate overclaim";
  if (balance < -10) return "Slight overclaim";
  if (balance <= 10) return "Well aligned";
  if (balance < 30) return "Slightly cautious";
  if (balance < 60) return "Moderately cautious";
  return "Strongly cautious";
}

function uniqueJudgementSources(sources: Source[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    // Provenance verifies that somebody said something; it does not help judge
    // whether the proposition is supported.
    if (source.role === "Verifies") return false;
    if (seen.has(source.url)) return false;

    seen.add(source.url);
    return true;
  });
}

export function ClaimVsEvidence({
  claimConfidence,
  evidenceSupport,
  summary,
  sources,
}: Props) {
  const [showEvidence, setShowEvidence] = useState(false);
  const balance = evidenceSupport - claimConfidence;
  const markerPosition = ((balance + 100) / 200) * 100;
  const label = getBalanceLabel(balance);
  const reduceMotion = useReducedMotion();
  const judgementSources = useMemo(
    () => uniqueJudgementSources(sources),
    [sources]
  );

  return (
    <section className="section confidence-section">
      <Reveal className="section-heading">
        <p className="section-label">Claim vs evidence</p>
        <h2>Does the confidence of the claim match the evidence behind it?</h2>
      </Reveal>

      <div className="confidence-comparison">
        <div className="confidence-stat">
          <span>Claim confidence</span>
          <AnimatedNumber
            value={claimConfidence}
            duration={1.1}
            className="confidence-stat-number"
          />
          <p>How certain the statement sounds.</p>
        </div>

        <div className="confidence-stat">
          <span>Evidence support</span>
          <AnimatedNumber
            value={evidenceSupport}
            duration={1.1}
            className="confidence-stat-number"
          />
          <p>How strongly the available evidence supports it.</p>
        </div>
      </div>

      <div className="balance-block">
        <div className="balance-header">
          <div>
            <p className="section-label">Confidence balance</p>
            <AnimatedNumber
              value={balance}
              prefix={balance > 0 ? "+" : ""}
              duration={1.25}
              className="balance-value"
            />
          </div>

          <div className="balance-summary">
            <strong>{label}</strong>
            <p>{summary}</p>

            {judgementSources.length > 0 ? (
              <button
                type="button"
                className="balance-evidence-action"
                aria-expanded={showEvidence}
                onClick={() => setShowEvidence((current) => !current)}
              >
                {showEvidence ? "Hide supporting evidence" : "View supporting evidence"}
                <span>
                  {judgementSources.length} source
                  {judgementSources.length === 1 ? "" : "s"}
                </span>
              </button>
            ) : (
              <p className="balance-no-evidence">
                No web source was used directly for this comparison.
              </p>
            )}
          </div>
        </div>

        {showEvidence && judgementSources.length > 0 && (
          <ConfidenceEvidencePanel
            sources={judgementSources}
            onClose={() => setShowEvidence(false)}
          />
        )}

        <div className="balance-scale" aria-label={`Confidence balance ${balance}`}>
          <div className="balance-axis" />
          <div className="balance-zero" />
          <motion.div
            className="balance-marker"
            initial={reduceMotion ? false : { left: "50%" }}
            whileInView={{ left: `${markerPosition}%` }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{
              duration: reduceMotion ? 0 : 1.1,
              ease: [0.16, 1, 0.3, 1],
            }}
            title={`Confidence balance: ${balance}`}
          />

          <div className="balance-scale-label balance-scale-label--left">
            <strong>−100</strong>
            <span>Overclaiming</span>
          </div>

          <div className="balance-scale-label balance-scale-label--center">
            <strong>0</strong>
            <span>Aligned</span>
          </div>

          <div className="balance-scale-label balance-scale-label--right">
            <strong>+100</strong>
            <span>Cautious</span>
          </div>
        </div>

        <p className="balance-helper">
          Negative values mean the claim sounds more confident than the evidence supports.
          Values near zero mean the language and evidence are well matched.
          Positive values mean the speaker is more cautious than the evidence requires.
        </p>
      </div>
    </section>
  );
}
