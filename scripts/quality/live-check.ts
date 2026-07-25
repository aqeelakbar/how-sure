import { qualityCorpus } from "../../quality/corpus";

type AnalysisResponse = {
  analysis?: {
    verdict: string;
    scoreThemes: Array<{ id: string; score: number }>;
    evidenceCertainty: number;
    rhetoricalCertainty: number;
    bottomLine: string;
  };
  error?: string;
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const groupName = argValue("--group") ?? "benefits-attribution";
const baseUrl = argValue("--base-url") ?? "http://localhost:3000";
const limit = Math.max(
  2,
  Math.min(Number(argValue("--limit") ?? "2") || 2, 4)
);

const tests = qualityCorpus
  .filter((item) => item.equivalenceGroup === groupName)
  .slice(0, limit);

if (tests.length < 2) {
  console.error(`Need at least two cases in equivalence group "${groupName}".`);
  process.exit(1);
}

console.log(
  `Running ${tests.length} live analyses for "${groupName}".\n` +
  `This consumes ${tests.length} uncached Gemini requests and Tavily searches.\n`
);

const outputs: Array<{
  id: string;
  verdict: string;
  bottomLine: string;
  evidenceCertainty: number;
  rhetoricalCertainty: number;
  scores: Record<string, number>;
}> = [];

for (const test of tests) {
  const response = await fetch(`${baseUrl}/api/analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim: test.statement }),
  });

  const payload = (await response.json()) as AnalysisResponse;

  if (!response.ok || !payload.analysis) {
    console.error(`${test.id}: ${payload.error ?? `HTTP ${response.status}`}`);
    process.exit(1);
  }

  outputs.push({
    id: test.id,
    verdict: payload.analysis.verdict,
    bottomLine: payload.analysis.bottomLine,
    evidenceCertainty: payload.analysis.evidenceCertainty,
    rhetoricalCertainty: payload.analysis.rhetoricalCertainty,
    scores: Object.fromEntries(
      payload.analysis.scoreThemes.map((theme) => [theme.id, theme.score])
    ),
  });
}

const baseline = outputs[0];

console.log("Live consistency report\n");

for (const output of outputs) {
  console.log(`• ${output.id}`);
  console.log(`  verdict: ${output.verdict}`);
  console.log(`  evidence certainty: ${output.evidenceCertainty}`);
  console.log(`  scores: ${JSON.stringify(output.scores)}`);
  console.log(`  bottom line: ${output.bottomLine}\n`);
}

if (baseline) {
  for (const output of outputs.slice(1)) {
    const scoreDeltas = Object.keys(baseline.scores).map((id) => ({
      id,
      delta: Math.abs((baseline.scores[id] ?? 0) - (output.scores[id] ?? 0)),
    }));

    const maxScoreDelta = Math.max(...scoreDeltas.map((item) => item.delta), 0);
    const evidenceDelta = Math.abs(
      baseline.evidenceCertainty - output.evidenceCertainty
    );

    console.log(
      `${baseline.id} ↔ ${output.id}: ` +
      `max score delta ${maxScoreDelta}, evidence delta ${evidenceDelta}`
    );

    if (maxScoreDelta > 15 || evidenceDelta > 15) {
      console.log(
        "  ⚠ Material divergence. Review whether attribution or phrasing changed the judgement."
      );
    } else {
      console.log("  ✓ Broadly consistent.");
    }
  }
}
