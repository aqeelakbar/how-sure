# How Sure? quality harness

V2.5 introduces a small regression corpus for the reasoning pipeline.

The aim is not to force identical language from an LLM. It is to protect
important product invariants.

## Core invariants

### 1. Attribution must not change the proposition

These should resolve to the same proposition before search:

```text
claiming benefits in the UK is too easy

Kemi Badenoch says claiming benefits in the UK is too easy

Kemi Badenoch: claiming benefits in the UK is too easy
```

### 2. A person who is the subject must stay in the claim

```text
Kemi Badenoch misled Parliament
```

must not become:

```text
misled Parliament
```

### 3. A topic label is not automatically a speaker

```text
UK inflation: 3.2%
```

must remain a factual statement, not attribution to "UK inflation".

### 4. Multi-part statements should create distinct retrieval units

```text
The new transport plan will reduce congestion.
It will also make commuting more affordable.
```

should create two retrieval claims.

## Free local check

```bash
npm run quality
```

This makes **zero Gemini calls and zero Tavily calls**.

It checks:
- attribution parsing
- proposition equivalence
- subject preservation
- colon/topic regression cases
- basic subclaim segmentation

## Optional live consistency check

Start the app:

```bash
npm run dev
```

Then in another terminal:

```bash
npm run quality:live -- --group benefits-attribution
```

By default this runs only **2 cases** to protect free-tier quota.

You can explicitly run up to 4:

```bash
npm run quality:live -- --group benefits-attribution --limit 3
```

The live runner reports score differences rather than requiring byte-for-byte
matching. A score/evidence difference above 15 points is flagged for review.

## Corpus

`quality/corpus.ts` contains the current regression set across:

- attribution variants
- factual claims
- value judgements
- causal claims
- loaded claims
- vague claims
- multi-claim statements

Add cases whenever a real user test exposes surprising behaviour.


## V2.6 live quality gate

The production analysis route now runs a small deterministic quality gate after
the first Gemini response.

It checks for:

- attribution leaking into the verdict or Bottom line
- overly long verdict / Bottom line
- avoidable jargon
- wrong score labels
- duplicate evidence inside a score
- high factual/evidence scores with no cited evidence
- annotations that do not exactly match the submitted statement
- high evidence certainty when no sources were retrieved

### Repair behaviour

If any check fails:

```text
first analysis
↓
deterministic checks fail
↓
one Gemini repair call using the same evidence set
↓
checks run again
```

There is no second Tavily search during repair.

If the repaired result passes, it is shown as:

```text
Quality checked · Repaired
```

If checks still fail, the best available result is shown with:

```text
Low confidence assessment
```

The system never keeps retrying until it gets a result it likes.
