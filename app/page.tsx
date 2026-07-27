"use client";

import { useState } from "react";
import type { ClaimAnalysis } from "@/types/claim";
import type { Verification } from "@/types/verification";
import { ClaimInput } from "@/components/ClaimInput";
import { ClaimReport } from "@/components/ClaimReport";
import { AnalysisLoading } from "@/components/AnalysisLoading";



const DEFAULT_CLAIM = "";

export default function Home() {
  const [claim, setClaim] = useState(DEFAULT_CLAIM);
  const [analysis, setAnalysis] = useState<ClaimAnalysis | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [status, setStatus] = useState<"input" | "loading" | "report">("input");
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyse() {
    const trimmed = claim.trim();

    if (trimmed.length < 8) {
      setError("Enter a little more detail so the claim can be analysed.");
      return;
    }

    setError(null);

    setStatus("loading");

    try {
      const response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: trimmed }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Analysis failed.");
      }

      setAnalysis(payload.analysis);
      setVerification(payload.verification);
      setSharePath(payload.sharePath ?? null);
      if (payload.sharePath) {
        window.history.replaceState({}, "", payload.sharePath);
      }
      setStatus("report");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The claim could not be analysed. Please try again."
      );
      setStatus("input");
    }
  }

  function reset() {
    setStatus("input");
    setAnalysis(null);
    setVerification(null);
    setSharePath(null);
    setClaim("");
    window.history.replaceState({}, "", "/");
    setError(null);
  }

  if (status === "loading") {
    return <AnalysisLoading claim={claim.trim()} />;
  }

  if (status === "report" && analysis) {
    return (
      <ClaimReport
        claim={claim}
        data={analysis}
        onReset={reset}
        verificationLabel={verification?.label}
        verificationDetail={verification?.detail}
        sharePath={sharePath ?? undefined}
      />
    );
  }

  return (
    <ClaimInput
      value={claim}
      onChange={(value) => {
        setClaim(value);
        setError(null);
      }}
      onAnalyse={handleAnalyse}
      error={error}
    />
  );
}
