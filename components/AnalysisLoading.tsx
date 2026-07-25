"use client";

import { BrainCircuit, Search, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  claim: string;
};

const messages = [
  {
    icon: Search,
    title: "Searching for evidence",
    detail: "Related pages are not automatically treated as proof.",
  },
  {
    icon: BrainCircuit,
    title: "Comparing claim and evidence",
    detail: "How Sure? checks what the sources actually support or challenge.",
  },
  {
    icon: ShieldCheck,
    title: "Checking the assessment",
    detail: "The AI's first answer is checked before you see the result.",
  },
];

export function AnalysisLoading({ claim }: Props) {
  const reduceMotion = useReducedMotion();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  const messageIndex = useMemo(() => {
    if (elapsedSeconds < 5) return 0;
    if (elapsedSeconds < 11) return 1;
    return 2;
  }, [elapsedSeconds]);

  const message = messages[messageIndex];
  const Icon = message.icon;

  const waitMessage =
    elapsedSeconds < 12
      ? "Checking live sources can take a few seconds."
      : elapsedSeconds < 24
        ? "Still working — some claims need more source checking."
        : "Still with you — How Sure? is finishing the evidence and quality checks.";

  return (
    <section className="analysis-loading">
      <div className="loading-shell">
        <p className="brand">How Sure?</p>

        <div className="loading-content loading-content--compact">
          <p className="eyebrow">Analysing claim</p>
          <h1>Checking before judging.</h1>

          <div className="loading-claim" aria-label="Claim being analysed">
            <span>YOUR CLAIM</span>
            <p>“{claim}”</p>
          </div>

          <div className="loading-progress" aria-hidden="true">
            <motion.span
              initial={reduceMotion ? false : { x: "-100%" }}
              animate={reduceMotion ? undefined : { x: ["-100%", "280%"] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>

          <motion.div
            key={message.title}
            className="loading-status"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
          >
            <div className="loading-status-icon">
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
            </div>

            <div>
              <strong>{message.title}</strong>
              <p>{message.detail}</p>
            </div>
          </motion.div>

          <div className="loading-meta" aria-live="polite">
            <span>{elapsedSeconds}s</span>
            <p>{waitMessage}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
