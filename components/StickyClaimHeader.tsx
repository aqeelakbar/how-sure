"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

type Props = {
  claim: string;
  speaker: string;
  inputKind?: "question" | "assertion";
  visible: boolean;
  onReset: () => void;
};

function sourceLabel(speaker: string) {
  const normalized = speaker.trim().toLowerCase();

  if (
    !speaker.trim() ||
    normalized === "unknown / not provided" ||
    normalized === "source not provided"
  ) {
    return "Source optional";
  }

  return speaker;
}

export function StickyClaimHeader({
  claim,
  speaker,
  inputKind = "assertion",
  visible,
  onReset,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`sticky-claim-header ${expanded ? "is-expanded" : ""}`}
          initial={reduceMotion ? false : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
          transition={{
            duration: reduceMotion ? 0 : 0.28,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="sticky-claim-inner">
            <div className="sticky-claim-brand">
              <span className="sticky-claim-product">How Sure?</span>
              <span className="sticky-claim-source">
                {sourceLabel(speaker)} · {inputKind === "question" ? "Original question" : "Original claim"}
              </span>
            </div>

            <button
              type="button"
              className="sticky-claim-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              <span className="sticky-claim-text">“{claim}”</span>
              <span className="sticky-claim-action">
                {expanded
                  ? "Collapse"
                  : inputKind === "question"
                    ? "View full question"
                    : "View full claim"}
              </span>
            </button>

            <button
              type="button"
              className="sticky-new-claim-action"
              onClick={onReset}
            >
              Analyse another claim
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
