"use client";

import { motion, useReducedMotion } from "motion/react";

const steps = [
  "Searching several evidence paths at once",
  "Comparing the claim with retrieved sources",
  "Checking context and rhetorical certainty",
  "Checking the assessment before showing it",
];

export function AnalysisLoading() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="analysis-loading">
      <div className="loading-shell">
        <p className="brand">How Sure?</p>

        <div className="loading-content">
          <p className="eyebrow">Analysing claim</p>
          <h1>Looking beneath the wording.</h1>

          <div className="loading-steps">
            {steps.map((step, index) => (
              <motion.div
                key={step}
                className="loading-step"
                initial={reduceMotion ? false : { opacity: 0.2 }}
                animate={reduceMotion ? undefined : { opacity: [0.2, 1, 0.2] }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  delay: index * 0.35,
                  ease: "easeInOut",
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </motion.div>
            ))}
          </div>

          <p className="loading-note">
            How Sure? retrieves live web evidence first, then asks the model to
            classify what the sources support, contradict or contextualise.
          </p>
        </div>
      </div>
    </section>
  );
}
