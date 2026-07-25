import { randomUUID } from "node:crypto";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { MODEL_NAME, PIPELINE_VERSION } from "@/lib/version";

export type AnalysisRunRecord = {
  requestId: string;
  claimHash?: string | null;
  analysisId?: string | null;
  outcome: "success" | "error" | "server_cache_hit";
  durationMs: number;
  failureStage?: string | null;
  errorCode?: string | null;
  retrievedSourceCount?: number | null;
  citedSourceCount?: number | null;
  repairAttempted?: boolean | null;
  providerRetryCount?: number | null;
  retrievalFallbackAttempted?: boolean | null;
  retrievalQuality?: string | null;
};

export function newRequestId() {
  return randomUUID();
}

export async function recordAnalysisRun(record: AnalysisRunRecord) {
  const log = {
    event: "analysis_run",
    pipelineVersion: PIPELINE_VERSION,
    model: MODEL_NAME,
    ...record,
  };

  console.info(JSON.stringify(log));

  if (!isDatabaseConfigured()) return;

  try {
    const sql = getDb();
    await sql`
      insert into analysis_runs (
        id,
        request_id,
        claim_hash,
        analysis_id,
        pipeline_version,
        model,
        outcome,
        duration_ms,
        failure_stage,
        error_code,
        retrieved_source_count,
        cited_source_count,
        repair_attempted,
        provider_retry_count,
        retrieval_fallback_attempted,
        retrieval_quality,
        created_at
      ) values (
        ${randomUUID()},
        ${record.requestId},
        ${record.claimHash ?? null},
        ${record.analysisId ?? null},
        ${PIPELINE_VERSION},
        ${MODEL_NAME},
        ${record.outcome},
        ${Math.max(0, Math.round(record.durationMs))},
        ${record.failureStage ?? null},
        ${record.errorCode ?? null},
        ${record.retrievedSourceCount ?? null},
        ${record.citedSourceCount ?? null},
        ${record.repairAttempted ?? null},
        ${record.providerRetryCount ?? null},
        ${record.retrievalFallbackAttempted ?? null},
        ${record.retrievalQuality ?? null},
        now()
      )
    `;
  } catch (error) {
    console.warn("Could not persist analysis telemetry:", error);
  }
}
