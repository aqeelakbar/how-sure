"use client";

import { useEffect, useRef, useState } from "react";
import type { ClaimAnalysis } from "@/types/claim";
import { ScoreCard } from "@/components/ScoreCard";
import { EvidencePanel } from "@/components/EvidencePanel";
import { ClaimVsEvidence } from "@/components/ClaimVsEvidence";
import { StatementAnatomy } from "@/components/StatementAnatomy";
import { Reveal } from "@/components/Reveal";
import { VerificationNotice } from "@/components/VerificationNotice";
import { StickyClaimHeader } from "@/components/StickyClaimHeader";
import { ProvenancePanel } from "@/components/ProvenancePanel";
import { Methodology } from "@/components/Methodology";
import { ClaimsDetected } from "@/components/ClaimsDetected";

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
  const [shareLabel, setShareLabel] = useState("Copy link");

  const selectedTheme =
    data.scoreThemes.find((theme) => theme.id === selectedScore) ?? null;


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
        visible={showStickyClaim}
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
                  window.setTimeout(() => setShareLabel("Copy link"), 1800);
                } catch {
                  window.prompt("Copy this link", url);
                }
              }}
            >
              {shareLabel}
            </button>
          )}
          <button className="text-button" onClick={onReset}>
            Analyse another claim
          </button>
        </div>
      </header>

      <article>
        <section ref={heroRef} className="hero section">
          <Reveal>
            <p className="section-label">Original claim</p>
            <blockquote>“{claim}”</blockquote>
            <div className="claim-meta">
              <span>{data.speaker}</span>
              <span>{data.type}</span>
            </div>

            <VerificationNotice
              label={verificationLabel}
              detail={verificationDetail}
            />
            {shared && (
              <p className="shared-analysis-note">
                This is a saved analysis. The sources and assessment are shown as they were recorded.
              </p>
            )}
          </Reveal>
        </section>

        <div className="claim-context-stack">
          <ProvenancePanel claim={claim} speaker={data.speaker} />
          <ClaimsDetected claims={data.detectedClaims} />
        </div>

        <section className="verdict-section section">
          <Reveal>
            <p className="section-label">Should I trust this claim?</p>
            <h1>{data.verdict}</h1>
            <p className="verdict-summary">{data.verdictSummary}</p>
          </Reveal>
        </section>

        <section className="section score-section">
          <Reveal className="section-heading">
            <p className="section-label">Why?</p>
            <h2>Four ways to inspect the claim.</h2>
          </Reveal>

          <div className="score-grid">
            {data.scoreThemes.map((theme, index) => (
              <Reveal key={theme.id} delay={index * 0.08}>
                <ScoreCard
                  theme={theme}
                  active={selectedScore === theme.id}
                  onSelect={() =>
                    setSelectedScore((current) =>
                      current === theme.id ? null : theme.id
                    )
                  }
                />
              </Reveal>
            ))}
          </div>

          {selectedTheme && (
            <EvidencePanel
              theme={selectedTheme}
              onClose={() => setSelectedScore(null)}
            />
          )}
        </section>

        <ClaimVsEvidence
          claimConfidence={data.rhetoricalCertainty}
          evidenceSupport={data.evidenceCertainty}
          summary={data.certaintyGapSummary}
        />

        <StatementAnatomy
          statement={claim}
          annotations={data.annotations}
        />

        <section className="section plain-section">
          <Reveal>
            <p className="section-label">In plain English</p>
            <p className="plain-text">{data.plainEnglish}</p>
          </Reveal>
        </section>

        <section className="bottom-line-section section">
          <Reveal>
            <p className="section-label">Bottom line</p>
            <h2>{data.bottomLine}</h2>
          </Reveal>
        </section>

        <Methodology />
      </article>
    </div>
  );
}
