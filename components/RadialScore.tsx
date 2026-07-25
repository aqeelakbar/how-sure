"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";

type Props = {
  score: number;
  label: string;
};

export function RadialScore({ score, label }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.55 });
  const reduceMotion = useReducedMotion();

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div
      ref={ref}
      className="radial-wrap"
      aria-label={`${label}: ${score} out of 100`}
    >
      <svg viewBox="0 0 100 100" className="radial">
        <circle className="radial-track" cx="50" cy="50" r={radius} />

        <motion.circle
          className="radial-value"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={`${dash} ${circumference - dash}`}
          initial={
            reduceMotion
              ? false
              : { strokeDashoffset: dash, opacity: 0 }
          }
          animate={
            inView
              ? { strokeDashoffset: 0, opacity: 1 }
              : undefined
          }
          transition={{
            strokeDashoffset: {
              duration: reduceMotion ? 0 : 1.1,
              ease: [0.16, 1, 0.3, 1],
            },
            opacity: {
              duration: reduceMotion ? 0 : 0.25,
            },
          }}
        />
      </svg>

      <AnimatedNumber
        value={score}
        duration={1}
        className="radial-number"
      />
    </div>
  );
}
