"use client";

import { motion, useReducedMotion } from "motion/react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Reveal } from "@/components/Reveal";

type Props = {
  claimConfidence: number;
  evidenceSupport: number;
  summary: string;
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

export function ClaimVsEvidence({
  claimConfidence,
  evidenceSupport,
  summary,
}: Props) {
  const balance = evidenceSupport - claimConfidence;
  const markerPosition = ((balance + 100) / 200) * 100;
  const label = getBalanceLabel(balance);
  const reduceMotion = useReducedMotion();

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
          </div>
        </div>

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
