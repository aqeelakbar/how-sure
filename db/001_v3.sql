-- How Sure? V3.0
-- Run this once against the PostgreSQL database configured by DATABASE_URL.

create table if not exists analyses (
  id uuid primary key,
  claim text not null,
  claim_hash text not null,
  pipeline_version text not null,
  analysis jsonb not null,
  verification jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (claim_hash, pipeline_version)
);

create index if not exists analyses_updated_at_idx
  on analyses (updated_at desc);

create table if not exists rate_limits (
  key_hash text not null,
  bucket_start timestamptz not null,
  count integer not null default 1,
  primary key (key_hash, bucket_start)
);

create index if not exists rate_limits_bucket_idx
  on rate_limits (bucket_start desc);

create table if not exists analysis_runs (
  id uuid primary key,
  request_id uuid not null,
  claim_hash text,
  analysis_id uuid references analyses(id) on delete set null,
  pipeline_version text not null,
  model text not null,
  outcome text not null check (outcome in ('success', 'error', 'server_cache_hit')),
  duration_ms integer not null,
  failure_stage text,
  error_code text,
  retrieved_source_count integer,
  cited_source_count integer,
  repair_attempted boolean,
  provider_retry_count integer,
  retrieval_fallback_attempted boolean,
  retrieval_quality text,
  created_at timestamptz not null default now()
);

create index if not exists analysis_runs_created_at_idx
  on analysis_runs (created_at desc);

create index if not exists analysis_runs_outcome_idx
  on analysis_runs (outcome, created_at desc);

-- Useful 24-hour operational summary:
-- select
--   count(*) as requests,
--   count(*) filter (where outcome = 'success') as fresh_successes,
--   count(*) filter (where outcome = 'server_cache_hit') as cache_hits,
--   count(*) filter (where outcome = 'error') as errors,
--   round(avg(duration_ms)) as avg_duration_ms,
--   count(*) filter (where repair_attempted) as repairs,
--   count(*) filter (where retrieval_fallback_attempted) as retrieval_fallbacks
-- from analysis_runs
-- where created_at >= now() - interval '24 hours';
