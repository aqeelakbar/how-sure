"use client";

import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import type { ClaimAnalysis } from "@/types/claim";
import { EvidencePanel } from "@/components/EvidencePanel";
import { ClaimVsEvidence } from "@/components/ClaimVsEvidence";
import { StatementAnatomy } from "@/components/StatementAnatomy";
import { Reveal } from "@/components/Reveal";
import { StickyClaimHeader } from "@/components/StickyClaimHeader";
import { Methodology } from "@/components/Methodology";
import { QuestionClarification } from "@/components/QuestionClarification";
import { detectInputKind, questionFacingVerdict } from "@/lib/analysis/inputKind";

type Props = {
  claim: string;
  data: ClaimAnalysis;
  onReset: () => void;
  verificationLabel?: string;
  verificationDetail?: string;
  sharePath?: string;
  shared?: boolean;
};

export function ClaimReport({
  claim,
  data,
  onReset,
  verificationLabel,
  verificationDetail,
  sharePath,
  shared = false,
}: Props) {
  const heroRef = useRef<HTMLElement | null>(null);
  const [showStickyClaim, setShowStickyClaim] = useState(false);
  const [selectedScore, setSelectedScore] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState("Share analysis");

  const selectedTheme =
    data.scoreThemes.find((theme) => theme.id === selectedScore) ?? null;

  const citedSourceCount = new Set(
    data.scoreThemes.flatMap((theme) =>
      theme.sources.map((source) => `${source.url}::${source.role}`)
    )
  ).size;

  const inputKind = detectInputKind(claim);
  const isQuestion = inputKind === "question";
  const displayVerdict = isQuestion
    ? questionFacingVerdict(data.verdict)
    : data.verdict;

  const questionClarification =
    data.annotations.find((annotation) => {
      const label = annotation.label.toLowerCase();
      return !["qualifier"].includes(label);
    }) ?? null;

  const submittedSpeaker = data.speaker.trim();
  const hasSubmittedSpeaker = ![
    "source not provided",
    "unknown / not provided",
  ].includes(submittedSpeaker.toLowerCase());


  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyClaim(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: "-72px 0px 0px 0px",
      }
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="report-page">
      <StickyClaimHeader
        claim={claim}
        speaker={data.speaker}
        inputKind={inputKind}
        visible={showStickyClaim}
        onReset={onReset}
      />

      <header className="report-nav">
        <button className="brand-button" onClick={onReset}>
          How Sure?
        </button>
        <div className="report-nav-actions">
          {sharePath && (
            <button
              className="share-action"
              type="button"
              onClick={async () => {
                const url = new URL(sharePath, window.location.origin).toString();
                try {
                  await navigator.clipboard.writeText(url);
                  setShareLabel("Link copied");
                  window.setTimeout(() => setShareLabel("Share analysis"), 1800);
                } catch {
                  window.prompt("Copy this link", url);
                }
              }}
            >
              <Share2 aria-hidden="true" size={13} strokeWidth={2} />
              <span>{shareLabel}</span>
            </button>
          )}

          <button
            type="button"
            className="report-new-claim-action"
            onClick={onReset}
          >
            Analyse another claim
          </button>
        </div>
      </header>

      <article>
        <section ref={heroRef} className="hero section">
          <Reveal>
            <p className="section-label">{isQuestion ? "Original question" : "Original claim"}</p>
            <blockquote>“{claim}”</blockquote>
            <div className="claim-meta">
              <span>
                {data.speaker.trim().toLowerCase() === "source not provided" ||
                data.speaker.trim().toLowerCase() === "unknown / not provided"
                  ? "Source optional · evidence searched independently"
                  : data.speaker}
              </span>
              <span>{data.type}</span>
            </div>
          </Reveal>
        </section>

        <section className="verdict-section section">
          <Reveal>
            <p className="section-label">
              {isQuestion ? "What does the evidence suggest?" : "Should I trust this claim?"}
            </p>
            <h1>{displayVerdict}</h1>
            <p className="verdict-summary">{data.verdictSummary}</p>
          </Reveal>
        </section>

        <section className="assessment-details-section">
          <details className="assessment-details">
            <summary>
              <span>About this assessment</span>
              <span className="assessment-details-hint">
                See what was assessed and what evidence was used
              </span>
            </summary>

            <div className="assessment-details-content assessment-overview">
              <div className="assessment-overview-row">
                <p className="section-label">What was assessed</p>
                <div className="assessment-overview-value">
                  <strong>
                    {isQuestion
                      ? `${data.detectedClaims.length} proposition${data.detectedClaims.length === 1 ? "" : "s"} investigated`
                      : `${data.detectedClaims.length} testable claim${data.detectedClaims.length === 1 ? "" : "s"}`}
                  </strong>
                  {data.detectedClaims[0] && (
                    <p>“{data.detectedClaims[0].text}”</p>
                  )}
                </div>
              </div>

              <div className="assessment-overview-row">
                <p className="section-label">Attributed to</p>
                <div className="assessment-overview-value assessment-overview-inline">
                  <strong>
                    {hasSubmittedSpeaker ? submittedSpeaker : "Attribution not provided"}
                  </strong>
                  <span>
                    {hasSubmittedSpeaker
                      ? "Attribution taken from the submitted text"
                      : "Evidence was searched independently"}
                  </span>
                </div>
              </div>

              <div className="assessment-overview-row">
                <p className="section-label">Evidence used</p>
                <div className="assessment-overview-value assessment-overview-inline">
                  <strong>
                    {citedSourceCount} cited source
                    {citedSourceCount === 1 ? "" : "s"}
                  </strong>
                  <span>Used to support, challenge or add context to the assessment</span>
                </div>
              </div>

              {shared && (
                <p className="shared-analysis-note">
                  This is a saved analysis. The sources and assessment are shown as they were recorded.
                </p>
              )}
            </div>
          </details>
        </section>

        <section className="section score-section why-section">
          <Reveal className="section-heading why-heading">
            <p className="section-label">Why?</p>
            <div className="why-heading-main">
              <h2>Why we reached this conclusion.</h2>
              <button
                type="button"
                className="why-help-link"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("open-how-sure-about", {
                      detail: { section: "result" },
                    })
                  )
                }
              >
                How should I read these dimensions?
              </button>
            </div>
          </Reveal>

          <div className="why-grid">
            {data.scoreThemes.map((theme, index) => {
              const active = selectedScore === theme.id;

              return (
                <Reveal key={theme.id} delay={index * 0.06}>
                  <div className={`why-reason ${active ? "is-active" : ""}`}>
                    <button
                      type="button"
                      className="why-reason-trigger"
                      aria-expanded={active}
                      onClick={() =>
                        setSelectedScore((current) =>
                          current === theme.id ? null : theme.id
                        )
                      }
                    >
                      <span className="why-reason-index">0{index + 1}</span>
                      <div className="why-reason-copy">
                        <h3>{theme.label}</h3>
                        <p>{theme.summary}</p>
                      </div>
                      <span className="why-reason-action">
                        {active ? "Evidence open" : "View evidence"}
                      </span>
                    </button>

                    {active && (
                      <div className="mobile-card-evidence">
                        <EvidencePanel
                          theme={theme}
                          annotations={data.annotations}
                          onClose={() => setSelectedScore(null)}
                        />
                      </div>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>

          {selectedTheme && (
            <div className="desktop-score-evidence">
              <EvidencePanel
                theme={selectedTheme}
                annotations={data.annotations}
                onClose={() => setSelectedScore(null)}
              />
            </div>
          )}
        </section>

        <section className="bottom-line-section section">
          <Reveal>
            <p className="section-label">Bottom line</p>
            <h2>{data.bottomLine}</h2>
          </Reveal>
        </section>

        {!isQuestion && (
          <ClaimVsEvidence
            claimConfidence={data.rhetoricalCertainty}
            evidenceSupport={data.evidenceCertainty}
            summary={data.certaintyGapSummary}
            sources={data.scoreThemes.flatMap((theme) => theme.sources)}
          />
        )}

        {isQuestion ? (
          questionClarification ? (
            <QuestionClarification annotation={questionClarification} />
          ) : null
        ) : (
          <StatementAnatomy
            statement={claim}
            annotations={data.annotations}
          />
        )}

        <section className="section meaning-section">
          <Reveal>
            <p className="section-label">What this means</p>
            <p className="meaning-text">{data.plainEnglish}</p>
          </Reveal>
        </section>

        <Methodology />
      </article>
    </div>
  );
}
