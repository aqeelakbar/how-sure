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
            <strong>Gemini interprets the proposition, evidence, context and wording.</strong>
            <p>
              It distinguishes what can be tested, what the evidence directly establishes,
              what context changes interpretation and what the wording is doing.
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
              Evidence support − claim confidence. Negative means the statement sounds more
              certain than the available evidence can justify or establish; near zero means aligned;
              positive means the wording is more cautious than the evidence requires.
            </p>
          </div>

          <div className="methodology-scores">
            <article>
              <h3>Based on facts</h3>
              <p>
                Whether the proposition can be objectively tested as written, and whether evidence
                could establish it as true or false.
              </p>
            </article>

            <article>
              <h3>Evidence quality</h3>
              <p>
                How direct, relevant, reliable and independent the available evidence is for
                the proposition being assessed.
              </p>
            </article>

            <article>
              <h3>Enough context</h3>
              <p>
                Whether important context, qualifiers or examples are missing in ways that could
                materially change how the statement is understood.
              </p>
            </article>

            <article>
              <h3>Fair wording</h3>
              <p>
                How the wording uses vague, broad, categorical, evaluative or loaded language,
                including undefined terms and comparison standards.
              </p>
            </article>
          </div>

          <div className="methodology-callout">
            <span>Claim vs evidence</span>
            <p>
              How Sure? compares how certain the statement sounds with how strongly the available
              evidence supports the proposition. The balance is then explained through what creates
              certainty, what the evidence establishes and what it cannot establish.
            </p>
          </div>

          <div className="methodology-rules">
            <div>
              <span>Source roles</span>
              <p>
                Supports proposition · Contradicts proposition · Adds context · Defines term · Verifies attribution
              </p>
            </div>

            <div>
              <span>Source quality</span>
              <p>
                High favours primary, official and strong academic evidence.
                Medium covers reputable secondary evidence. Low reflects weaker
                or low-transparency material. Source quality does not by itself mean the source
                proves the proposition.
              </p>
            </div>

            <div>
              <span>Limitation</span>
              <p>
                Search can be incomplete and model interpretation can still be wrong. Some
                propositions are value judgements rather than testable facts. The evidence and
                language panels remain the audit trail.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
