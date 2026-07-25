import { createHash, randomUUID } from "node:crypto";
import type { ClaimAnalysis } from "@/types/claim";
import type { Verification } from "@/types/verification";
import { getDb } from "@/lib/db";
import { PIPELINE_VERSION } from "@/lib/version";

export type StoredAnalysis = {
  id: string;
  claim: string;
  analysis: ClaimAnalysis;
  verification: Verification;
  createdAt: string;
  updatedAt: string;
};

export function normalizeClaimForCache(claim: string) {
  return claim
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .toLocaleLowerCase("en");
}

export function hashClaim(claim: string) {
  return createHash("sha256")
    .update(normalizeClaimForCache(claim))
    .digest("hex");
}

function cacheTtlHours() {
  const configured = Number(process.env.SERVER_CACHE_TTL_HOURS ?? 168);
  return Number.isFinite(configured) && configured > 0 ? configured : 168;
}

export async function findServerCachedAnalysis(claimHash: string) {
  const sql = getDb();
  const ttlHours = cacheTtlHours();

  const rows = await sql<{
    id: string;
    claim: string;
    analysis: ClaimAnalysis;
    verification: Verification;
    created_at: string;
    updated_at: string;
  }[]>`
    select id, claim, analysis, verification, created_at, updated_at
    from analyses
    where claim_hash = ${claimHash}
      and pipeline_version = ${PIPELINE_VERSION}
      and updated_at >= now() - (${ttlHours} * interval '1 hour')
      and coalesce(verification->>'qualityStatus', 'passed') = 'passed'
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    claim: row.claim,
    analysis: row.analysis,
    verification: row.verification,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies StoredAnalysis;
}

export async function getStoredAnalysis(id: string) {
  const sql = getDb();
  const rows = await sql<{
    id: string;
    claim: string;
    analysis: ClaimAnalysis;
    verification: Verification;
    created_at: string;
    updated_at: string;
  }[]>`
    select id, claim, analysis, verification, created_at, updated_at
    from analyses
    where id = ${id}
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    claim: row.claim,
    analysis: row.analysis,
    verification: row.verification,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies StoredAnalysis;
}

export async function saveAnalysis({
  claim,
  claimHash,
  analysis,
  verification,
}: {
  claim: string;
  claimHash: string;
  analysis: ClaimAnalysis;
  verification: Verification;
}) {
  const sql = getDb();
  const id = randomUUID();

  const rows = await sql<{ id: string }[]>`
    insert into analyses (
      id,
      claim,
      claim_hash,
      pipeline_version,
      analysis,
      verification,
      created_at,
      updated_at
    )
    values (
      ${id},
      ${claim},
      ${claimHash},
      ${PIPELINE_VERSION},
      ${sql.json(analysis)},
      ${sql.json(verification)},
      now(),
      now()
    )
    on conflict (claim_hash, pipeline_version)
    do update set
      claim = excluded.claim,
      analysis = excluded.analysis,
      verification = excluded.verification,
      updated_at = now()
    returning id
  `;

  return rows[0].id;
}
