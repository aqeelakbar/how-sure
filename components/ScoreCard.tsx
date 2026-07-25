"use client";

import { RadialScore } from "@/components/RadialScore";
import type { ScoreTheme } from "@/types/claim";

type Props = {
  theme: ScoreTheme;
  active: boolean;
  onSelect: () => void;
};

export function ScoreCard({ theme, active, onSelect }: Props) {
  return (
    <article className={`score-card ${active ? "is-active" : ""}`}>
      <button
        className="score-card-trigger"
        onClick={onSelect}
        aria-expanded={active}
      >
        <RadialScore score={theme.score} label={theme.label} />

        <div className="score-card-copy">
          <h3>{theme.label}</h3>
          <p>{theme.summary}</p>
        </div>

        <span className="score-action">
          {active ? "Evidence open" : "View evidence"}
        </span>
      </button>
    </article>
  );
}
