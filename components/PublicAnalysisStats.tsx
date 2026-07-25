"use client";

import { useEffect, useState } from "react";

type Stats = {
  claimsExamined: number;
  sourcesInspected: number;
};

const numberFormatter = new Intl.NumberFormat("en-GB");

export function PublicAnalysisStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/stats")
      .then((response) => {
        if (!response.ok) throw new Error("Stats request failed.");
        return response.json() as Promise<Stats>;
      })
      .then((payload) => {
        if (!cancelled) setStats(payload);
      })
      .catch(() => {
        // This is a supporting trust signal, so a stats failure should never
        // affect the main claim-analysis experience.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats || stats.claimsExamined < 1) return null;

  return (
    <p className="public-analysis-stats" aria-label="How Sure? activity">
      <span>
        <strong>{numberFormatter.format(stats.claimsExamined)}</strong>{" "}
        {stats.claimsExamined === 1 ? "claim" : "claims"} examined against live evidence
      </span>
      <span aria-hidden="true">·</span>
      <span>
        <strong>{numberFormatter.format(stats.sourcesInspected)}</strong>{" "}
        {stats.sourcesInspected === 1 ? "source" : "sources"} inspected
      </span>
    </p>
  );
}
