const claims = [
  "Keir Starmer: Britain is now stronger and fairer than it was two years ago.",
  "Keir Starmer: immigration is down significantly.",
  "Rachel Reeves: at the start of 2026, Britain had the fastest economic growth of any G7 country.",
  "Shabana Mahmood: the UK was spending £9 million a day housing people in 400 asylum hotels.",
  "Andy Burnham: building more council homes is a fair and sustainable way to bring the welfare bill down.",
  "Seven out of ten of the poorest regions in Northern Europe are in England.",
  "Keir Starmer will receive a £115,000-a-year pension for life because he is a former Prime Minister.",
  "Sadiq Khan is building 40,000 council homes for Muslims only.",
  "Andy Burnham has no legal right to be Prime Minister because he was not elected Prime Minister in a general election.",
  "It is established that 250,000 white girls have been victims of rape gangs in the UK.",
];

type Issue = { code: string; message: string };

type ApiResponse = {
  analysis?: {
    verdict: string;
    bottomLine: string;
    evidenceCertainty: number;
    rhetoricalCertainty: number;
    scoreThemes: Array<{
      id: string;
      label: string;
      score: number;
    }>;
  };
  verification?: {
    qualityStatus?: "passed" | "low";
    qualityIssueCount?: number;
    repairAttempted?: boolean;
    repairSucceeded?: boolean;
    retrievedSourceCount?: number;
    citedSourceCount?: number;
    initialProviderRetryCount?: number;
    repairProviderRetryCount?: number;
    retrievalFallbackAttempted?: boolean;
    retrievalFallbackAddedSources?: number;
    localQualityFixes?: Issue[];
    retrievalQuality?: "none" | "insufficient" | "limited" | "usable";
    initialQualityIssues?: Issue[];
    finalQualityIssues?: Issue[];
  };
  code?: string;
  stage?: string;
  error?: string;
  detail?: string;
};

const BASE_URL = process.env.HOW_SURE_BASE_URL ?? "http://localhost:3000";

async function run() {
  const results: any[] = [];

  for (let index = 0; index < claims.length; index++) {
    const claim = claims[index];
    console.log(`\n[${index + 1}/${claims.length}] ${claim}`);

    try {
      const response = await fetch(`${BASE_URL}/api/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim }),
      });

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.analysis) {
        console.error(
          `Failed at ${payload.stage ?? "unknown"}: ${payload.detail ?? payload.error ?? `HTTP ${response.status}`}`
        );

        results.push({
          number: index + 1,
          claim,
          status: "failed",
          code: payload.code ?? null,
          failureStage: payload.stage ?? null,
          error: payload.error ?? `HTTP ${response.status}`,
          detail: payload.detail ?? null,
        });
        continue;
      }

      const scores = Object.fromEntries(
        payload.analysis.scoreThemes.map((theme) => [
          theme.label,
          theme.score,
        ])
      );

      const result = {
        number: index + 1,
        claim,
        status: "success",
        verdict: payload.analysis.verdict,
        bottomLine: payload.analysis.bottomLine,
        evidenceCertainty: payload.analysis.evidenceCertainty,
        rhetoricalCertainty: payload.analysis.rhetoricalCertainty,
        scores,
        qualityStatus: payload.verification?.qualityStatus ?? null,
        qualityIssueCount: payload.verification?.qualityIssueCount ?? null,
        repairAttempted: payload.verification?.repairAttempted ?? false,
        repairSucceeded: payload.verification?.repairSucceeded ?? false,
        initialProviderRetryCount: payload.verification?.initialProviderRetryCount ?? 0,
        repairProviderRetryCount: payload.verification?.repairProviderRetryCount ?? 0,
        retrievalFallbackAttempted: payload.verification?.retrievalFallbackAttempted ?? false,
        retrievalFallbackAddedSources: payload.verification?.retrievalFallbackAddedSources ?? 0,
        localQualityFixes: payload.verification?.localQualityFixes ?? [],
        retrievalQuality: payload.verification?.retrievalQuality ?? null,
        initialQualityIssues: payload.verification?.initialQualityIssues ?? [],
        finalQualityIssues: payload.verification?.finalQualityIssues ?? [],
        retrievedSourceCount: payload.verification?.retrievedSourceCount ?? null,
        citedSourceCount: payload.verification?.citedSourceCount ?? null,
      };

      results.push(result);

      console.log(`Verdict: ${result.verdict}`);
      console.log(`Quality: ${result.qualityStatus}`);
      console.log(
        `Repair: ${
          result.repairAttempted
            ? result.repairSucceeded
              ? "triggered + succeeded"
              : "triggered + unresolved"
            : "not needed"
        }`
      );

      if (result.localQualityFixes.length) {
        console.log(
          `Local fixes: ${result.localQualityFixes.map((issue: Issue) => issue.code).join(", ")}`
        );
      }

      if (result.initialQualityIssues.length) {
        console.log(
          `Remaining issues before AI repair: ${result.initialQualityIssues.map((issue: Issue) => issue.code).join(", ")}`
        );
      }

      console.log(`Retrieval quality: ${result.retrievalQuality ?? "unknown"}`);
      if (result.initialProviderRetryCount > 0) {
        console.log(`Provider retries: ${result.initialProviderRetryCount}`);
      }
      if (result.retrievalFallbackAttempted) {
        console.log(
          `Retrieval fallback: attempted, ${result.retrievalFallbackAddedSources} new source(s)`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown runner error";

      results.push({
        number: index + 1,
        claim,
        status: "failed",
        code: "runner_error",
        failureStage: "runner",
        error: message,
        detail: message,
      });

      console.error(`Runner failed: ${message}`);
    }
  }

  const fs = await import("node:fs/promises");
  await fs.mkdir("quality/results", { recursive: true });

  await fs.writeFile(
    "quality/results/ten-claim-validation-v2-6-3.json",
    JSON.stringify(results, null, 2),
    "utf8"
  );

  const successes = results.filter((result) => result.status === "success");
  const failures = results.filter((result) => result.status === "failed");
  const repairs = successes.filter((result) => result.repairAttempted);

  const issueCounts = new Map<string, number>();
  const localFixCounts = new Map<string, number>();

  for (const result of successes) {
    for (const issue of result.initialQualityIssues ?? []) {
      issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
    }

    for (const fix of result.localQualityFixes ?? []) {
      localFixCounts.set(fix.code, (localFixCounts.get(fix.code) ?? 0) + 1);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Success: ${successes.length}/${results.length}`);
  console.log(`Failed: ${failures.length}/${results.length}`);
  console.log(`Repair triggered: ${repairs.length}/${successes.length || 0}`);

  if (localFixCounts.size) {
    console.log("\nLocal fixes:");
    for (const [code, count] of [...localFixCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${code}: ${count}`);
    }
  }

  if (issueCounts.size) {
    console.log("\nRemaining issues that triggered AI repair:");
    for (const [code, count] of [...issueCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${code}: ${count}`);
    }
  }

  if (failures.length) {
    console.log("\nFailure stages:");
    for (const result of failures) {
      console.log(`  #${result.number}: ${result.failureStage ?? "unknown"} — ${result.detail ?? result.error}`);
    }
  }

  console.log(
    "\nSaved: quality/results/ten-claim-validation-v2-6-3.json"
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
