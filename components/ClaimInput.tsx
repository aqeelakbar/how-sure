"use client";

import { useEffect, useRef, useState } from "react";
import { PublicAnalysisStats } from "@/components/PublicAnalysisStats";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onAnalyse: () => void;
  error?: string | null;
};

export function ClaimInput({ value, onChange, onAnalyse, error }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (isMobile) return;

    textarea.focus({ preventScroll: true });

    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, []);

  return (
    <section className="input-page">
      <div className="input-shell">
        <p className="brand">How Sure?</p>

        <div className="input-copy">
          <p className="eyebrow">Public claim analysis</p>
          <h1>Examine the evidence behind a claim.</h1>
          <p className="lede">
            How Sure? examines the evidence, context and wording behind a public
            statement, then shows what can and cannot be established.
          </p>
        </div>

        <div className="input-block">
          <label className="input-field-label" htmlFor="claim-input">
            Paste or type a claim
          </label>
          <textarea
            id="claim-input"
            ref={textareaRef}
            value={value}
            maxLength={500}
            placeholder="Paste a statement, headline, or question here…"
            onChange={(event) => {
              onChange(event.target.value);
            }}
            aria-label="Claim to analyse"
          />
          <div className="input-actions">
            <span>{value.length}/500</span>
            <button
              type="button"
              className="analyse-claim-action"
              onClick={onAnalyse}
            >
              Analyse claim
            </button>
          </div>

          {error && <p className="input-error">{error}</p>}

          <p className="input-disclaimer">
            New statements use live web retrieval plus AI analysis. Completed
            analyses are saved so they can be shared and reused without another
            search or AI request.
          </p>

          <PublicAnalysisStats />
        </div>
      </div>
    </section>
  );
}
