"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Reveal } from "@/components/Reveal";
import type { Source } from "@/types/claim";

type Props = {
  isQuestion?: boolean;
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

function getQuestionAssessment(
  wordingStrength: number,
  evidenceSupport: number
) {
  if (wordingStrength <= 30) {
    return {
      label: "The question is fairly neutral",
      explanation:
        "The wording does not strongly push toward a particular answer. The evidence can be considered on its own terms.",
    };
  }

  if (wordingStrength >= evidenceSupport + 20) {
    return {
      label: "The wording goes further than the evidence",
      explanation:
        "The question steers toward a stronger conclusion than the available evidence can establish.",
    };
  }

  if (evidenceSupport >= wordingStrength + 20) {
    return {
      label: "The evidence is clearer than the wording suggests",
      explanation:
        "The question is relatively cautious compared with what the available evidence can establish.",
    };
  }

  return {
    label: "The wording needs some qualification",
    explanation:
      "The question is answerable in part, but its wording affects how confidently a simple yes or no can be given.",
  };
}

function uniqueJudgementSources(sources: Source[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (source.role === "Verifies") return false;
    if (seen.has(source.url)) return false;

    seen.add(source.url);
    return true;
  });
}

function evidenceStory(sources: Source[]) {
  const roles = new Set(sources.map((source) => source.role));

  if (roles.has("Supports") && roles.has("Contradicts")) {
    return "The available evidence is mixed: some sources support the proposition while others challenge it.";
  }

  if (roles.has("Supports")) {
    return "Some sources directly support the proposition, while others mainly add context or define terms.";
  }

  if (roles.has("Contradicts")) {
    return "The strongest evidence challenges the proposition rather than supporting it.";
  }

  if (roles.has("Defines") && roles.has("Contextualises")) {
    return "The available sources mainly define terms and add context rather than directly support the proposition.";
  }

  if (roles.has("Defines")) {
    return "The available sources mainly clarify terms used in the statement rather than directly support the proposition.";
  }

  if (roles.has("Contextualises")) {
    return "The available sources mainly provide context rather than directly support the proposition.";
  }

  return "The available sources provide limited direct support for the proposition itself.";
}

function confidenceStory(score: number, isQuestion: boolean) {
  if (isQuestion) {
    if (score >= 75) {
      return "The wording strongly presupposes or frames a particular conclusion.";
    }

    if (score >= 50) {
      return "The wording nudges toward a conclusion rather than asking in fully neutral terms.";
    }

    return "The wording is relatively open and does not strongly presuppose the answer.";
  }

  if (score >= 75) {
    return "Categorical phrases and necessity language make the statement sound highly certain.";
  }

  if (score >= 50) {
    return "The wording presents the claim with moderate certainty rather than strong qualification.";
  }

  return "The wording uses cautious or qualified language rather than presenting the claim as settled.";
}

function unsupportedStory(summary: string) {
  const normalized = summary.toLowerCase();

  if (
    normalized.includes("evaluative") ||
    normalized.includes("value judgement") ||
    normalized.includes("value judgment") ||
    normalized.includes("cultural values")
  ) {
    return "The available evidence does not provide a neutral standard for establishing the underlying value judgement.";
  }

  return "The available evidence does not establish the proposition strongly enough to match the wording.";
}

export function ClaimVsEvidence({
  isQuestion = false,
  claimConfidence,
  evidenceSupport,
  summary,
  sources,
}: Props) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const balance = evidenceSupport - claimConfidence;
  const markerPosition = ((balance + 100) / 200) * 100;
  const balanceLabel = getBalanceLabel(balance);
  const questionAssessment = getQuestionAssessment(
    claimConfidence,
    evidenceSupport
  );
  const reduceMotion = useReducedMotion();

  const judgementSources = useMemo(
    () => uniqueJudgementSources(sources),
    [sources]
  );

  return (
    <section
      className={`section confidence-section ${
        showAnalysis
          ? "confidence-section--open"
          : "confidence-section--closed"
      }`}
    >
      <Reveal className="confidence-disclosure">
        <div className="confidence-disclosure-copy">
          <p className="section-label">Dive deeper</p>
          <h2>{isQuestion ? "Question vs evidence" : "Claim vs evidence"}</h2>
          <p>
            {isQuestion
              ? "Compare how the question is worded with what the available evidence supports."
              : "Compare how certain the claim sounds with how strongly the available evidence supports it."}
          </p>
        </div>

        <button
          type="button"
          className="confidence-disclosure-action"
          aria-expanded={showAnalysis}
          onClick={() => setShowAnalysis((current) => !current)}
        >
          {showAnalysis ? "Close comparison" : "Inspect comparison"}
          <span aria-hidden="true">{showAnalysis ? "−" : "+"}</span>
        </button>
      </Reveal>

      {showAnalysis &&
        (isQuestion ? (
          <div className="confidence-analysis question-evidence-analysis">
            <div className="confidence-analysis-heading">
              <h3>
                What does the wording ask us to assume, and what can the
                evidence establish?
              </h3>
            </div>

            <div className="question-evidence-grid">
              <div>
                <p className="section-label">How the question is worded</p>
                <h4>{confidenceStory(claimConfidence, true)}</h4>
              </div>

              <div>
                <p className="section-label">What the evidence supports</p>
                <h4>{evidenceStory(judgementSources)}</h4>
              </div>
            </div>

            <div className="question-evidence-judgement">
              <p className="section-label">Overall</p>
              <strong>{questionAssessment.label}</strong>
              <p>{summary || questionAssessment.explanation}</p>
            </div>

            <div className="confidence-gap">
              <p className="section-label">Why?</p>

              <div className="confidence-gap-grid">
                <div>
                  <span>What the wording does</span>
                  <p>{confidenceStory(claimConfidence, true)}</p>
                </div>

                <div>
                  <span>What the evidence establishes</span>
                  <p>{evidenceStory(judgementSources)}</p>
                </div>

                <div>
                  <span>What remains uncertain</span>
                  <p>{unsupportedStory(summary)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="confidence-analysis">
            <div className="confidence-analysis-heading">
              <h3>
                Does the confidence of the claim match the evidence behind it?
              </h3>
            </div>

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
                <p>
                  How strongly the available evidence supports the proposition.
                </p>
              </div>
            </div>

            <div className="balance-block">
              <div className="balance-header">
                <div className="balance-summary">
                  <p className="section-label">Confidence balance</p>
                  <strong>{balanceLabel}</strong>
                  <p>{summary}</p>
                </div>

                <div
                  className="balance-number-block"
                  aria-label={`Confidence balance ${balance}`}
                >
                  <AnimatedNumber
                    value={Math.abs(balance)}
                    prefix={balance < 0 ? "− " : balance > 0 ? "+" : ""}
                    duration={1.25}
                    className="balance-value"
                  />
                  <span>confidence balance</span>
                </div>
              </div>

              <div className="confidence-gap">
                <p className="section-label">Why the gap?</p>

                <div className="confidence-gap-grid">
                  <div>
                    <span>What makes the claim sound certain</span>
                    <p>{confidenceStory(claimConfidence, false)}</p>
                  </div>

                  <div>
                    <span>What the evidence establishes</span>
                    <p>{evidenceStory(judgementSources)}</p>
                  </div>

                  <div>
                    <span>What the evidence does not establish</span>
                    <p>{unsupportedStory(summary)}</p>
                  </div>
                </div>
              </div>

              <div
                className="balance-scale"
                aria-label={`Confidence balance ${balance}`}
              >
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
                Negative values mean the claim sounds more certain than the
                evidence supports. Values near zero are aligned. Positive
                values mean the wording is more cautious than the evidence
                requires.
              </p>
            </div>
          </div>
        ))}
    </section>
  );
}
