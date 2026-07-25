"use client";

import { useState } from "react";

export function Methodology() {
  const [open, setOpen] = useState(false);

  return (
    <section className="section methodology-section">
      <div className="methodology-heading">
        <div>
          <p className="section-label">Methodology</p>
          <h2>How this assessment was made</h2>
        </div>

        <button
          className="secondary-action"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide methodology" : "Show methodology"}
        </button>
      </div>

      <p className="methodology-intro">
        How Sure? separates source retrieval, model interpretation and
        application logic so the result is inspectable.
      </p>

      {open && (
        <div className="methodology-content">
          <div className="methodology-flow">
            <span>01 · Retrieve</span>
            <strong>How Sure? splits the statement into retrieval claims, then Tavily searches each one.</strong>
            <p>Each detected claim is searched separately. Results are deduplicated, and only retrieved URLs are eligible to appear as evidence.</p>
          </div>

          <div className="methodology-flow">
            <span>01A · Separate</span>
            <strong>Attribution is separated from the proposition.</strong>
            <p>
              A wrapper such as “Kemi Badenoch says…” is treated as attribution,
              while the underlying proposition is what gets tested against the
              evidence. This prevents speaker context from changing the factual
              evidence base unnecessarily.
            </p>
          </div>

          <div className="methodology-flow">
            <span>02 · Interpret</span>
            <strong>Gemini compares the claim with the evidence.</strong>
            <p>
              It assigns source roles, relevance, quality, missing context and
              rhetorical features.
            </p>
          </div>

          <div className="methodology-flow">
            <span>02A · Check</span>
            <strong>The result is checked before you see it.</strong>
            <p>
              Simple rules first fix safe formatting problems locally, such as verdict
              wording, score labels, duplicate evidence and known jargon. Only
              substantive problems — such as speaker attribution leaking into the
              verdict or unsupported scoring — can trigger one AI repair attempt.
              If that still fails, the assessment is marked low confidence.
            </p>
          </div>

          <div className="methodology-flow">
            <span>03 · Calculate</span>
            <strong>The application derives confidence balance.</strong>
            <p>
              Evidence support − claim confidence. Negative means overclaiming;
              near zero means aligned; positive means cautious.
            </p>
          </div>

          <div className="methodology-scores">
            <article>
              <h3>Based on facts</h3>
              <p>
                How well factual parts of the statement are supported by
                retrieved evidence.
              </p>
            </article>

            <article>
              <h3>Evidence quality</h3>
              <p>
                Quality, relevance, directness, independence and agreement of
                the evidence base.
              </p>
            </article>

            <article>
              <h3>Enough context</h3>
              <p>
                Whether important qualifiers, definitions, uncertainty or
                alternative explanations are missing.
              </p>
            </article>

            <article>
              <h3>Fair wording</h3>
              <p>
                How strongly wording pushes an interpretation through
                absolutes, emotive framing or false dilemmas.
              </p>
            </article>
          </div>

          <div className="methodology-rules">
            <div>
              <span>Source roles</span>
              <p>
                Supports · Contradicts · Contextualises · Defines · Verifies
              </p>
            </div>

            <div>
              <span>Source quality</span>
              <p>
                High favours primary, official and strong academic evidence.
                Medium covers reputable secondary evidence. Low reflects weaker
                or low-transparency material.
              </p>
            </div>

            <div>
              <span>Limitation</span>
              <p>
                Search can be incomplete and model interpretation can still be
                wrong. The evidence panels remain the audit trail.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
