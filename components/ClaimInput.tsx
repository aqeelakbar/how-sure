"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onAnalyse: () => void;
  error?: string | null;
};

export function ClaimInput({ value, onChange, onAnalyse, error }: Props) {
  return (
    <section className="input-page">
      <div className="input-shell">
        <p className="brand">How Sure?</p>

        <div className="input-copy">
          <p className="eyebrow">Public claim analysis</p>
          <h1>Examine the evidence behind a claim.</h1>
          <p className="lede">
            Paste a political statement, headline, or public claim. The system
            separates evidence, context, rhetoric, and certainty before giving
            you a verdict.
          </p>
        </div>

        <div className="input-block">
          <textarea
            value={value}
            maxLength={500}
            onChange={(event) => onChange(event.target.value)}
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
        </div>
      </div>
    </section>
  );
}
