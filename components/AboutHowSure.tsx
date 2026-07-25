"use client";

import { useEffect, useRef, useState } from "react";

const sections = [
  ["why", "Why it exists"],
  ["works", "How it works"],
  ["result", "Understanding the result"],
  ["visible", "Why the evidence is visible"],
  ["checks", "How results are checked"],
  ["limits", "What it cannot do"],
  ["built", "How it was built"],
] as const;

export function AboutHowSure() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        className="about-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About How Sure?"
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">i</span>
      </button>

      {open && (
        <div className="about-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
          <aside
            className="about-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="about-panel-header">
              <div>
                <p className="about-kicker">About the project</p>
                <h1 id="about-title">How Sure?</h1>
              </div>
              <button
                ref={closeButtonRef}
                className="about-close"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close information panel"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="about-panel-layout">
              <nav className="about-toc" aria-label="About How Sure? sections">
                {sections.map(([id, label], index) => (
                  <a key={id} href={`#about-${id}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {label}
                  </a>
                ))}
              </nav>

              <div className="about-content">
                <section className="about-intro" id="about-why">
                  <p className="about-eyebrow">A critical-thinking tool</p>
                  <h2>Pause before accepting a confident statement as fact.</h2>
                  <p className="about-lede">
                    How Sure? helps people think more carefully about claims they see in news,
                    politics and social media.
                  </p>
                  <p>
                    Social media has made it possible for inaccurate or misleading statements
                    to spread further and faster than ever. A short clip, headline or post can
                    reach millions of people before anyone has checked what it leaves out or
                    whether the evidence supports it.
                  </p>
                  <p>
                    Paste in a public statement and How Sure? looks for evidence, examines the
                    wording and explains how much confidence the available information supports.
                    It does not tell you what to think. It gives you more information to help you
                    decide.
                  </p>
                </section>

                <section id="about-works">
                  <p className="about-eyebrow">How it works</p>
                  <h2>AI is the analyst, not the oracle.</h2>
                  <p>
                    AI can give convincing answers even when it is wrong. So How Sure? does not
                    simply ask an AI, “Is this true?” The AI is only one part of a wider process.
                  </p>
                  <ol className="about-flow" aria-label="How a claim is analysed">
                    <li><span>1</span><strong>You paste in a statement</strong></li>
                    <li><span>2</span><strong>The main claim is identified</strong></li>
                    <li><span>3</span><strong>The web is searched for evidence</strong></li>
                    <li><span>4</span><strong>AI compares the claim with that evidence</strong></li>
                    <li><span>5</span><strong>Automatic checks look for mistakes</strong></li>
                    <li><span>6</span><strong>You see the result, reasons and sources</strong></li>
                  </ol>
                </section>

                <section className="about-principles" aria-label="Three principles">
                  <article>
                    <p>Evidence ≠ relevance</p>
                    <h3>A related source is not automatically proof.</h3>
                    <p>An article can discuss the same topic without supporting the exact claim.</p>
                  </article>
                  <article>
                    <p>Attribution ≠ truth</p>
                    <h3>Showing that somebody said it does not make it true.</h3>
                    <p>Who made a statement and whether the statement is accurate are separate questions.</p>
                  </article>
                  <article>
                    <p>Confidence ≠ evidence</p>
                    <h3>A confident voice can still rest on weak evidence.</h3>
                    <p>How certain a claim sounds is compared with how much support the evidence provides.</p>
                  </article>
                </section>

                <section id="about-result">
                  <p className="about-eyebrow">Understanding the result</p>
                  <h2>One verdict is not enough.</h2>
                  <p>
                    How Sure? breaks the result into four simple questions so you can see where
                    a claim is strong and where it may be weak.
                  </p>
                  <div className="about-score-list">
                    <article><h3>Based on facts</h3><p>How well does the evidence support the claim?</p></article>
                    <article><h3>Evidence quality</h3><p>How trustworthy and useful are the sources?</p></article>
                    <article><h3>Enough context</h3><p>Is important information, such as a timeframe or comparison, missing?</p></article>
                    <article><h3>Fair wording</h3><p>Is the statement neutral, or does it use loaded language?</p></article>
                  </div>
                  <div className="about-callout">
                    <p className="about-eyebrow">Claim vs evidence</p>
                    <h3>Does the statement sound more certain than the evidence allows?</h3>
                    <p>
                      A claim can sound completely certain even when the evidence is weak. This
                      comparison makes that gap visible.
                    </p>
                  </div>
                </section>

                <section id="about-visible">
                  <p className="about-eyebrow">Why show the method?</p>
                  <h2>A hidden answer only asks you to trust another black box.</h2>
                  <p>
                    Telling you not to trust a claim and then asking you to trust an unexplained AI
                    answer does not solve the problem. How Sure? shows the reasons, evidence and
                    sources behind its result so you can inspect them and make up your own mind.
                  </p>
                  <div className="about-trace" aria-label="Traceability chain">
                    <span>Score</span><b>→</b><span>Reason</span><b>→</b><span>Claim</span><b>→</b><span>Evidence</span><b>→</b><span>Source</span>
                  </div>
                  <p>
                    Showing the method does not guarantee an answer is correct. It makes the answer
                    easier to question, inspect and hold accountable.
                  </p>
                </section>

                <section id="about-checks">
                  <p className="about-eyebrow">Quality control</p>
                  <h2>The AI’s first answer is not shown automatically.</h2>
                  <p>
                    How Sure? checks the assessment first. It looks for problems such as missing
                    evidence, sources the system did not retrieve, confusing language, or a
                    conclusion that does not match the evidence.
                  </p>
                  <div className="about-quality-flow" aria-label="Quality-control process">
                    <div><span>AI creates an assessment</span></div>
                    <i aria-hidden="true">↓</i>
                    <div><span>Safe, predictable issues are fixed in code</span></div>
                    <i aria-hidden="true">↓</i>
                    <div><span>Automatic checks review the result</span></div>
                    <div className="about-quality-branches">
                      <div><small>Looks good</small><strong>Show the result</strong></div>
                      <div><small>Problem found</small><strong>Try to repair it once</strong></div>
                    </div>
                    <i aria-hidden="true">↓</i>
                    <div><span>If doubt remains, warn the user</span></div>
                  </div>
                  <h3 className="about-subheading">What is checked?</h3>
                  <ul className="about-check-list">
                    <li>Confirming who said something must not make the claim look more factual.</li>
                    <li>High scores need evidence behind them.</li>
                    <li>The AI can only cite sources the search system actually found.</li>
                    <li>“False” is used only when evidence directly contradicts the claim.</li>
                    <li>Plain language is preferred over technical wording.</li>
                    <li>The four scores must keep the same meaning every time.</li>
                  </ul>
                </section>

                <section id="about-limits">
                  <p className="about-eyebrow">Limitations</p>
                  <h2>How Sure? is not a truth machine.</h2>
                  <p>It can still miss useful evidence, misunderstand an unclear statement, rely on weak sources or make a mistake.</p>
                  <p>
                    Some questions also involve values rather than facts. Words such as “fair”,
                    “good” or “better” can contain genuine political or moral judgement. How Sure?
                    can examine the factual assumptions behind them, but it cannot decide your values
                    for you.
                  </p>
                </section>

                <section id="about-built">
                  <p className="about-eyebrow">How it was built</p>
                  <h2>Generative AI works alongside ordinary software.</h2>
                  <p>
                    Gemini carries out the language analysis and Tavily searches the web. Next.js,
                    React and TypeScript run the application. Conventional software handles source
                    checks, scoring rules, caching, quality controls and shared results.
                  </p>
                  <div className="about-architecture" aria-label="Technical architecture">
                    <span>User statement</span><b>↓</b>
                    <span>Separate the speaker from the claim</span><b>↓</b>
                    <span>Find the smaller claims that can be checked</span><b>↓</b>
                    <span>Search for evidence</span><b>↓</b>
                    <span>Gemini analyses the evidence</span><b>↓</b>
                    <span>Sources and reasoning are checked</span><b>↓</b>
                    <span>Final assessment with visible evidence</span>
                  </div>
                  <div className="about-closing">
                    <p>How Sure? does not ask you to trust it.</p>
                    <h2>It helps you decide how sure you should be.</h2>
                  </div>
                </section>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
