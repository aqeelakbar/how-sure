import { parseAttribution } from "../../lib/analysis/attribution";
import { extractRetrievalClaims } from "../../lib/analysis/subclaims";
import { qualityCorpus } from "../../quality/corpus";

type Result = {
  id: string;
  passed: boolean;
  message: string;
};

const results: Result[] = [];

for (const test of qualityCorpus) {
  if (
    test.expectedProposition === undefined &&
    test.expectedAttribution === undefined
  ) {
    continue;
  }

  const parsed = parseAttribution(test.statement);

  if (
    test.expectedProposition !== undefined &&
    parsed.proposition !== test.expectedProposition
  ) {
    results.push({
      id: test.id,
      passed: false,
      message:
        `proposition expected "${test.expectedProposition}" ` +
        `but got "${parsed.proposition}"`,
    });
    continue;
  }

  if (
    test.expectedAttribution !== undefined &&
    parsed.attribution !== test.expectedAttribution
  ) {
    results.push({
      id: test.id,
      passed: false,
      message:
        `attribution expected ${JSON.stringify(test.expectedAttribution)} ` +
        `but got ${JSON.stringify(parsed.attribution)}`,
    });
    continue;
  }

  results.push({
    id: test.id,
    passed: true,
    message: "attribution/proposition boundary is correct",
  });
}

// Critical equivalence invariant: all variants in a group must resolve to the
// exact same proposition before search.
const groups = new Map<string, typeof qualityCorpus>();

for (const test of qualityCorpus) {
  if (!test.equivalenceGroup) continue;
  const existing = groups.get(test.equivalenceGroup) ?? [];
  existing.push(test);
  groups.set(test.equivalenceGroup, existing);
}

for (const [groupName, tests] of groups) {
  const propositions = tests.map(
    (test) => parseAttribution(test.statement).proposition.toLowerCase()
  );

  const unique = new Set(propositions);

  results.push({
    id: `equivalence:${groupName}`,
    passed: unique.size === 1,
    message:
      unique.size === 1
        ? `all ${tests.length} variants resolve to the same proposition`
        : `variants diverged: ${[...unique].join(" | ")}`,
  });
}

// Local subclaim sanity check. No API calls.
const multi = qualityCorpus.find((item) => item.id === "multi-claim-transport");
if (multi) {
  const claims = extractRetrievalClaims(multi.statement);
  results.push({
    id: "subclaims:multi-claim-transport",
    passed: claims.length === 2,
    message: `expected 2 retrieval claims, got ${claims.length}`,
  });
}

const failures = results.filter((result) => !result.passed);

console.log("\nHow Sure? quality checks\n");

for (const result of results) {
  console.log(`${result.passed ? "✓" : "✗"} ${result.id}`);
  if (!result.passed) console.log(`  ${result.message}`);
}

console.log(
  `\n${results.length - failures.length}/${results.length} checks passed.`
);

if (failures.length) {
  process.exitCode = 1;
}
