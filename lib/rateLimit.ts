import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    forwarded ||
    "unknown"
  );
}

function hashVisitor(request: Request) {
  const salt = process.env.RATE_LIMIT_SALT || "how-sure-development-salt";
  return createHash("sha256")
    .update(`${salt}:${clientAddress(request)}`)
    .digest("hex");
}

async function incrementBucket({
  key,
  period,
}: {
  key: string;
  period: "hour" | "day";
}) {
  const sql = getDb();

  const rows = await sql<{ count: number }[]>`
    insert into rate_limits (key_hash, bucket_start, count)
    values (${key}, date_trunc(${period}, now()), 1)
    on conflict (key_hash, bucket_start)
    do update set count = rate_limits.count + 1
    returning count
  `;

  return rows[0]?.count ?? 1;
}

export async function consumeFreshAnalysisLimit(request: Request) {
  const visitorLimit = numberFromEnv("ANALYSIS_RATE_LIMIT_PER_HOUR", 10);
  const globalLimit = numberFromEnv("ANALYSIS_DAILY_LIMIT", 100);
  const visitorHash = hashVisitor(request);

  const visitorCount = await incrementBucket({
    key: `analysis:visitor:${visitorHash}`,
    period: "hour",
  });

  if (visitorCount > visitorLimit) {
    return {
      allowed: false as const,
      code: "visitor_rate_limit",
      message: `Too many new analyses from this connection. Try again later. Cached claims still work.`,
    };
  }

  const globalCount = await incrementBucket({
    key: "analysis:global",
    period: "day",
  });

  if (globalCount > globalLimit) {
    return {
      allowed: false as const,
      code: "daily_project_limit",
      message: "Today's analysis allowance has been reached. Existing shared analyses still work.",
    };
  }

  return {
    allowed: true as const,
    visitorCount,
    visitorLimit,
    globalCount,
    globalLimit,
  };
}

export async function consumeProvenanceLimit(request: Request) {
  const visitorHash = hashVisitor(request);
  const count = await incrementBucket({
    key: `provenance:visitor:${visitorHash}`,
    period: "hour",
  });

  return {
    allowed: count <= 15,
    count,
    limit: 15,
  };
}
