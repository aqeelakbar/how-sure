"use client";

import { useRouter } from "next/navigation";
import type { ClaimAnalysis } from "@/types/claim";
import type { Verification } from "@/types/verification";
import { ClaimReport } from "@/components/ClaimReport";

export function SharedAnalysisClient({
  id,
  claim,
  analysis,
  verification,
}: {
  id: string;
  claim: string;
  analysis: ClaimAnalysis;
  verification: Verification;
}) {
  const router = useRouter();

  return (
    <ClaimReport
      claim={claim}
      data={analysis}
      verificationLabel={verification.label}
      verificationDetail={verification.detail}
      sharePath={`/analysis/${id}`}
      shared
      onReset={() => router.push("/")}
    />
  );
}
