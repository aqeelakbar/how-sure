import { notFound } from "next/navigation";
import { getStoredAnalysis } from "@/lib/serverPersistence";
import { isDatabaseConfigured } from "@/lib/db";
import { SharedAnalysisClient } from "./SharedAnalysisClient";

export const dynamic = "force-dynamic";

export default async function SharedAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();

  const { id } = await params;
  const stored = await getStoredAnalysis(id);
  if (!stored) notFound();

  return (
    <SharedAnalysisClient
      id={stored.id}
      claim={stored.claim}
      analysis={stored.analysis}
      verification={stored.verification}
    />
  );
}
