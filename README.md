# How Sure? — V2

V2 connects the editorial prototype to the Gemini API.

## What V2 does

A user can now paste a new claim and receive a genuinely generated structured analysis.

Flow:

```text
claim
  ↓
POST /api/analyse
  ↓
Gemini 3.6 Flash
  ↓
structured ClaimAnalysis JSON
  ↓
How Sure? report UI
```

## Important limitation

This free V2 does **not** use live Google Search grounding.

Gemini 3.6 Flash model input/output is available on Google's free tier, but Google Search grounding for Gemini 3.6 Flash is not available on the free tier.

Therefore V2 explicitly labels every generated report:

> AI analysis only — This result has not been checked against live external sources.

The API route also strips all returned sources as a guardrail so the model cannot present invented links as evidence.

This is an interpretation prototype, not yet a live fact-checking product.

## Setup

1. Get a Gemini API key from Google AI Studio.
2. Copy:

```text
.env.example
```

to:

```text
.env.local
```

3. Add your key:

```text
GEMINI_API_KEY=your_real_key_here
```

4. Install dependencies:

```bash
npm install
```

5. Run:

```bash
npm run dev
```

6. Open:

```text
http://localhost:3000
```

## Model

```text
gemini-3.6-flash
```

## Why structured output

The API requests a fixed JSON structure matching the UI rather than asking the model to write a free-form answer.

The model generates:

- verdict
- verdict summary
- four score themes
- reasons for each score
- claim confidence
- evidence support
- exact-phrase annotations
- defensible rewrite
- plain-English explanation
- bottom line

Your frontend calculates the confidence balance from:

```text
evidence support - claim confidence
```

## Safety / trust rule

In V2:

- no live sources are claimed
- no fabricated URLs are displayed
- no result is described as externally verified
- the model is instructed to avoid calling a speaker a liar without evidence
- evidence-support scores are deliberately conservative without live research

## Next step — V2.1

Add a real evidence layer.

Options:

1. Enable Gemini Google Search grounding on a paid project.
2. Add a separate search API with a free allowance.
3. Retrieve sources independently, then give them to Gemini for comparison.

The best long-term architecture is:

```text
claim
  ↓
claim extraction
  ↓
source retrieval
  ↓
evidence comparison
  ↓
structured analysis
  ↓
How Sure? UI
```


## V2.0.1 fix — Gemini INVALID_ARGUMENT

The first V2 used an unnecessarily deep structured-output schema. Gemini may reject
large/deep schemas with HTTP 400 `INVALID_ARGUMENT`.

V2.0.1:

- simplifies the schema sent to Gemini
- does not ask Gemini to construct source objects in the ungrounded version
- retries automatically in JSON mode if Gemini rejects structured output
- still validates the returned JSON locally with Zod
- still strips all sources before sending a result to the browser

If the structured request works, it is used. If Gemini rejects the schema, the user
should see no failure; the server retries with JSON-only output.


## V2.0.2 — SDK compatibility fix

This release removes API-side structured output entirely.

Why:
- Gemini 3.6 Flash was released in July 2026.
- the original prototype pinned `@google/genai` 1.30.0
- the current SDK is 2.13.0
- V2.0.1 showed that even the JSON-mode fallback was rejected before generation

V2.0.2 therefore uses the minimal current API call:

```ts
const response = await ai.models.generateContent({
  model: "gemini-3.6-flash",
  contents: prompt,
});
```

The prompt asks for JSON and the app validates that JSON locally with Zod.

### Important clean install

Because the dependency version changed, do not rely on the old `node_modules`.

Run:

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

Your existing `.env.local` can be reused.


## V2.0.3 — long Statement Anatomy layout

Long statements could push the selected anatomy explanation below the viewport.

The Statement Anatomy section now uses a two-column desktop layout:

- annotated claim on the left
- selected phrase analysis on the right
- analysis panel stays sticky while the user scrolls through long claims
- selecting a phrase updates the inspector in place
- mobile/tablet layouts return to a single stacked column
- no nested scrolling is introduced

This keeps the statement readable while making the explanation continuously available.


## V2.0.4 — sticky anatomy inspector fix

The right-hand Statement Anatomy inspector now remains sticky while scrolling
through long claims.

The issue was caused by the grid using `align-items: start`, which made the
inspector's parent only as tall as its own content. A sticky child cannot travel
beyond the bounds of its parent.

The grid now stretches both columns to the height of the long statement, while
the statement itself remains top-aligned.


## V2.0.5 — sticky original claim

After the full original-claim section leaves the viewport, the report shows a
compact sticky context bar with:

- How Sure?
- speaker/source status
- Original claim
- truncated quote
- View full claim / Collapse control

For unattributed statements, it displays:

`Source not provided · Original claim`


## V2.0.6 — quota handling, caching and mobile

### Neutral starter statement
The default input is now:

> The new city transport plan will reduce traffic congestion and make commuting more affordable.

It is intentionally unattributed and politically neutral.

### Free-tier quota state
Gemini `429 RESOURCE_EXHAUSTED` responses are now returned to the UI as a
normal product state rather than a generic server failure.

The user sees that today's free AI allowance has been used and that previously
cached statements remain available.

### Seven-day local cache
Successful analyses are cached in the browser's `localStorage`.

- key: normalized statement text
- lifetime: 7 days
- maximum: 50 cached analyses
- cache hit: no network request and no Gemini quota usage
- the report labels cached results explicitly

This is deliberately a browser cache for the prototype. A production deployment
would normally move shared caching to a persistent server-side store.

### Mobile
The report now has explicit responsive rules for:

- full-bleed verdict and claim-vs-evidence sections
- score cards
- evidence panels
- long quotes
- statement anatomy
- confidence scale
- sticky claim header
- input screen
- bottom-line layout

Horizontal overflow is clipped and long generated text is allowed to wrap.


# V2.1 — evidence-backed analysis

V2.1 adds Tavily as a real web-evidence layer.

## Architecture

```text
statement
   ↓
7-day browser cache
   ↓ cache miss
Tavily Search API
   ↓ up to 8 retrieved sources
Gemini 3.6 Flash
   ↓ source role + quality + reasoning
local trust-boundary validation
   ↓
How Sure? report
```

Each uncached analysis uses:

- one Tavily basic search request
- one Gemini generateContent request

## Setup

Create `.env.local`:

```text
GEMINI_API_KEY=...
TAVILY_API_KEY=...
```

Restart the dev server after adding or changing environment variables.

## Tavily

Create a Tavily account and copy an API key from the Tavily dashboard.

V2.1 uses the direct REST endpoint:

```text
POST https://api.tavily.com/search
Authorization: Bearer TAVILY_API_KEY
```

The prototype requests:

- basic search depth
- up to 8 results
- no generated Tavily answer
- no raw page content
- no images

This keeps the retrieval pass lightweight.

## Source trust boundary

Gemini does **not** have permission to create citations.

Tavily retrieves the candidates first. Each result receives an internal ID:

```text
S1
S2
S3
...
```

Gemini can classify an existing source as:

- Supports
- Contradicts
- Contextualises
- Defines
- Verifies

and:

- High quality
- Medium quality
- Low quality

But before the response reaches the UI, every model-selected source is checked
against the original Tavily result set.

If its ID/URL was not retrieved by Tavily, it is dropped.

The model therefore supplies interpretation, while the search layer supplies the
actual URLs.

## Evidence scoring

V2.1 changes the meaning of two scores.

### Factual grounding

How well the factual parts of the statement are supported by the retrieved
evidence.

### Evidence strength

How strong the evidence base itself is, considering:

- source quality
- directness
- relevance
- agreement or disagreement
- independence

Rhetorical loading can legitimately have no external sources because it is
primarily textual analysis.

## Caching

The cache namespace is bumped for V2.1.

Old ungrounded analyses are intentionally not reused as evidence-backed reports.

A successful evidence-backed report is cached locally for seven days. A cache hit
uses neither a Tavily request nor a Gemini request.

## Free-tier errors

The app distinguishes:

- Gemini daily quota reached
- Tavily search quota reached
- Tavily search failure
- general analysis failure

Cached reports continue to work when either external free quota is exhausted.


## V2.1.1 — long-statement search fix

Tavily limits a single search query to 400 characters.

How Sure? still accepts statements up to 1,200 characters.

For evidence retrieval, long statements are now converted into a compact search
query of at most 390 characters. The original statement is not altered.

Flow:

```text
full statement (up to 1,200 chars)
        ↓
compact retrieval query (≤390 chars)
        ↓
Tavily
        ↓
retrieved evidence
        ↓
Gemini receives:
  - the complete original statement
  - the retrieved evidence
```

This does not add another Gemini or Tavily request.

For long statements, the compact query preserves the beginning and end of the
statement so both the main topic and later factual/policy claims are represented.


# V2.2 — provenance + methodology

- Unattributed quotes now offer **Find original source**.
- Provenance search is separate and only consumes Tavily/Gemini quota when triggered.
- Candidate provenance URLs are validated against Tavily results before display.
- Reports now include an expandable **How this assessment was made** section.
- Methodology explains retrieval, interpretation, scoring, source roles, source quality, confidence balance and limitations.


# V2.3 — subclaim-based evidence retrieval

V2.3 improves retrieval precision by searching distinct parts of a statement
separately.

## Why this is local, not another Gemini request

The free Gemini tier is request-limited. A second model call just to extract
subclaims would halve the number of fresh analyses available each day.

V2.3 therefore creates 1–5 retrieval claims locally using sentence boundaries
and conservative clause splitting.

Gemini still receives:

- the full original statement
- the detected retrieval claims
- all deduplicated evidence
- the relationship between sources and claim IDs

and performs the semantic interpretation in the single existing model call.

## Flow

```text
original statement
        ↓
local claim segmentation
        ↓
C1 / C2 / C3 ...
        ↓
one Tavily search per detected claim
        ↓
deduplicate by URL
        ↓
up to 16 strongest unique sources
        ↓
one Gemini analysis
        ↓
overall How Sure? report
```

## UI

A new `Claims detected` section appears near the top of the report.

Evidence sources can carry claim IDs such as:

```text
C1 · C3
```

so users can see which part of the original statement a source bears on.

## Cache

The cache namespace changed again so older V2.2 results are not reused without
subclaim metadata.

A V2.3 cache hit still uses:

- 0 Tavily requests
- 0 Gemini requests


# V2.3.1 — attribution / proposition separation

This fixes a consistency bug where:

```text
claiming benefits in the UK is too easy
```

and:

```text
Kemi Badenoch says claiming benefits in the UK is too easy
```

could retrieve different evidence and produce materially different results.

## New behaviour

Before evidence retrieval, How Sure? separates:

```text
attribution
+
proposition
```

Example:

```text
input:
Kemi Badenoch says claiming benefits in the UK is too easy

attribution:
Kemi Badenoch

proposition:
claiming benefits in the UK is too easy
```

Tavily searches the proposition, not the attribution wrapper.

Gemini still receives the full original statement, so it can preserve attribution
for provenance and surrounding context.

## Important distinction

A reporting wrapper is removed:

```text
Kemi Badenoch says X
```

But a person who is the subject of the claim is not removed:

```text
Kemi Badenoch misled Parliament
```

That remains the proposition because removing the name would destroy the claim.

## Cache

The cache namespace has been bumped so older analyses generated with the previous
retrieval logic are not reused.


# V2.3.2 — stronger Bottom line

The Bottom line is now a standalone full-width closing judgement rather than a
small element inside the plain-English explanation.

It mirrors the visual importance of `Should I trust this claim?`:

- large editorial typography
- full-width treatment
- strong tonal contrast
- scroll reveal animation
- responsive mobile typography

The reading hierarchy now has two explicit anchors:

1. `Should I trust this claim?` — opening judgement
2. `Bottom line` — closing judgement


# V2.3.3 — compact opening context

The opening report hierarchy has been tightened after visual review.

`Quote provenance` and `Claims detected` are now treated as supporting claim
context rather than two full standalone sections.

Changes:

- provenance is a compact metadata row
- known attribution shows speaker + attribution status on one line
- unattributed claims keep the Find original source action
- detected claims use smaller typography
- the two areas share one context stack
- vertical spacing is reduced substantially
- `Should I trust this claim?` arrives sooner and carries more visual authority

The goal is density without losing scanability.


# V2.3.4 — unified claim context

The claim context area has been restructured again after visual review.

Instead of separate mini-sections and repeated horizontal rules, provenance and
detected claims now share the same two-column grid.

Desktop structure:

```text
QUOTE PROVENANCE   Kemi Badenoch · Attributed in the submitted text

CLAIMS DETECTED    1 testable claim · explanatory note
                   C1 · claiming benefits in the UK is too easy
```

Changes:

- one shared alignment system
- Kemi Badenoch now aligns with the detected-claim content
- `1 testable claim` and `C1` live in the same content column
- internal horizontal rules removed
- only the outer top/bottom boundary remains
- less visual fragmentation before the main verdict


# V2.3.5 — opening spacing correction

Small visual refinement to the report opening:

- removed the top border from the claim-context block
- removes the apparent double horizontal rule
- reduced the gap between the evidence-backed analysis notice and Quote provenance
- preserves the single bottom boundary below the claim context

This makes provenance and detected claims read as a continuation of the opening
analysis metadata rather than as a separate section.


# V2.3.6 — opening metadata tightening

Final refinement of the opening report hierarchy:

- removed the decorative bullet beside `Subclaim evidence-backed analysis`
- reduced vertical spacing around the verification metadata
- pulled Quote provenance / Claims detected closer to it
- aligned `C1` to the same text baseline as the detected claim statement

The evidence-backed analysis now reads as supporting metadata rather than a
standalone content section.


# V2.3.7 — actual hero-gap fix

The large blank space beneath `Subclaim evidence-backed analysis` was traced to
the global `.section { padding: 88px 0; }` rule on the hero itself.

Previous adjustments targeted the verification notice, but the remaining gap
was parent-section padding.

Fix:

- hero bottom padding reduced from the global 88px to 24px
- hero bottom border removed
- verification bottom margin removed
- claim context begins directly after the opening metadata
- mobile hero bottom padding reduced to 18px

This fixes the whitespace at its actual source rather than compensating for it
with negative margins.


# V2.3.8 — proposition-first verdicts

This fixes a semantic issue where provenance could leak into the trust judgement.

Example input:

```text
Kemi Badenoch: claiming benefits in the UK is too easy
```

The app now treats these as two separate questions:

```text
PROVENANCE
Did Kemi Badenoch make the statement?

CLAIM JUDGEMENT
Is "claiming benefits in the UK is too easy" justified by the evidence?
```

## New generation rules

The following fields must evaluate the proposition, not the attribution:

- verdict
- verdictSummary
- scoreThemes
- rhetoricalCertainty
- evidenceCertainty
- certaintyGapSummary
- defensibleRewrite
- plainEnglish
- bottomLine

Confirmation that a politician said something cannot increase factual grounding
of the underlying proposition.

For evaluative statements such as:

```text
claiming benefits is too easy
```

the model should identify the value judgement and assess whether the evidence
supports the implied factual basis rather than treating accurate attribution as
truth of the claim.

## Cache

The browser cache namespace has been bumped so earlier provenance-contaminated
verdicts are not reused.


# V2.4 — layman-first language

This release simplifies the product for general readers.

## Changes

### Verdict language
The main verdict now aims for short, everyday wording such as:

- Not enough evidence
- Mostly opinion
- Well supported
- Mixed evidence
- Misleading as stated

### Bottom line
The Bottom line is now instructed to be one short sentence, ideally 12–22 words.

### Removed: A more defensible version
The rewrite section has been removed from the user-facing report. It was repetitive
and did not directly answer the user's main question.

### Plain English
`What does this mean?` is now labelled `In plain English`.

### Score labels
The four score labels are now written for a general audience:

- Based on facts
- Strong evidence
- Enough context
- Fair wording

All four now follow the same direction:

```text
higher score = better
```

`Fair wording` replaces `Rhetorical loading`, so a high score means the wording is
balanced rather than heavily loaded.

## Cache
The cache namespace has been bumped so older reports with the previous labels and
wording are not reused.


# V2.4.1 — statement anatomy typography refinement

Small typography refinement to the `Statement anatomy` section.

Changes:
- reduced the main statement size
- softened the visual weight of the statement
- tightened line-height slightly
- reduced negative letter-spacing slightly
- preserved strong contrast for the selected phrase highlight

This gives the section heading clearer priority while keeping the analysed
statement large and readable.


# V2.5 — quality and reliability harness

V2.5 is deliberately not an end-user feature release.

It adds a regression corpus and automated checks for the reasoning pipeline.

## Run the free checks

```bash
npm install
npm run quality
```

No Gemini or Tavily quota is used.

## Optional live comparison

With the development server running:

```bash
npm run quality:live -- --group benefits-attribution
```

This defaults to two analyses to keep API usage low.

## Parser hardening

The attribution parser is now more conservative around colon syntax.

It still recognises:

```text
Kemi Badenoch: claiming benefits in the UK is too easy
BBC News: inflation fell in June
```

but avoids incorrectly treating topic labels as speakers:

```text
UK inflation: 3.2%
NHS waiting lists: 7.4 million
```

See `quality/README.md` for the test philosophy and corpus.


# V2.6 — automatic quality checks and repair

Fresh analyses now go through a quality gate before being returned to the UI.

```text
claim
↓
retrieval
↓
Gemini analysis
↓
deterministic quality checks
   ↓ pass
   show result
   ↓ fail
one repair attempt
↓
quality checks again
   ↓ pass
   show repaired result
   ↓ fail
show result as Low confidence assessment
```

The repair uses the same retrieved evidence and does not trigger another Tavily
search. It does consume one additional Gemini request, but only when the initial
analysis fails a quality check.

The UI verification label now makes the outcome visible:

- `Quality checked analysis`
- `Quality checked · Repaired`
- `Low confidence assessment`

The cache namespace is bumped so older unchecked analyses are not reused.


# V2.6.1 — diagnostics + score semantics

This release responds directly to the first 10-claim validation run.

## Why the repair rate was 100%

The quality gate expected the new plain-English score labels, but the JSON shape
in the primary Gemini prompt still asked for the older labels:

- Factual grounding
- Evidence strength
- Context completeness

That meant otherwise-usable first responses could fail the score-label check and
trigger a repair.

V2.6.1 fixes the prompt so the first response asks for:

- Based on facts
- Evidence quality
- Enough context
- Fair wording

## Evidence quality

`Strong evidence` is renamed to `Evidence quality`.

It now has one unambiguous meaning:

> How reliable and useful is the evidence available to judge this claim?

This is deliberately different from `evidenceCertainty`, which means:

> How strongly does the evidence support the proposition itself?

Therefore a clearly false claim can correctly show:

```text
Based on facts      0
Evidence quality   90
Evidence support    5
```

because strong evidence may clearly contradict it.

## Controlled verdict vocabulary

The model must use one of:

- Well supported
- Mostly supported
- Mixed evidence
- Not enough evidence
- Mostly opinion
- Misleading as stated
- Not supported by reliable evidence
- False

`False` should be reserved for claims directly contradicted by cited evidence.
Where a number or assertion simply lacks reliable evidence, use
`Not supported by reliable evidence`.

## Diagnostics

Successful results now record:

```json
{
  "initialQualityIssues": [
    {
      "code": "bottom_line_too_long",
      "message": "..."
    }
  ],
  "finalQualityIssues": []
}
```

Failed analyses now include a stage such as:

```text
evidence_retrieval
initial_generation
initial_json_parse
initial_schema_validation
initial_quality_check
repair_generation
repair_json_parse
repair_schema_validation
repair_quality_check
```

This makes the next validation run diagnostic rather than just pass/fail.

## 10-claim runner included

With the development server running:

```bash
npm run quality:10
```

The report is saved to:

```text
quality/results/ten-claim-validation-v2-6-1.json
```

The terminal summary also shows:

- success/failure count
- repair rate
- most common initial quality failures
- failure stage for any hard failures


# V2.6.2 — local fixes before AI repair

V2.6.2 reduces unnecessary second Gemini calls.

## New flow

```text
Gemini analysis
↓
safe local cleanup
↓
quality check
↓
PASS → show result
↓
substantive failure
one Gemini repair attempt
```

Local cleanup handles only deterministic, meaning-preserving changes:

- maps known verdict wording to the approved vocabulary
- normalises score labels
- removes duplicate source URLs inside a score
- replaces a small set of known jargon terms with plain English

Examples:

```text
Completely false → False
Needs context → Misleading as stated
Political opinion → Mostly opinion
Unsubstantiated → Not enough evidence / Not supported by reliable evidence
```

The last mapping uses the available Evidence quality score to distinguish
"we do not have enough useful evidence" from "reliable evidence does not support
the claim".

## AI repair is now substantive

A second Gemini call is reserved for issues that cannot safely be fixed in code,
for example:

- attribution leaking into the verdict
- unsupported high scores
- a false verdict without contradictory evidence
- invalid statement annotations
- Bottom line requiring a meaningful rewrite

## Retrieval quality

The API now records:

```text
usable
limited
insufficient
none
```

`insufficient` means search returned sources but the final analysis could not use
any of them as evidence.

This makes cases like:

```text
8 sources retrieved
0 sources cited
```

visible as a retrieval problem rather than silently treating retrieval as
successful.

## Validation

Run:

```bash
npm run quality:10
```

The new report is saved as:

```text
quality/results/ten-claim-validation-v2-6-2.json
```

It records both:

- `localQualityFixes`
- `initialQualityIssues`

so the next run will show how many problems were solved without another Gemini
request and how many genuinely required AI repair.


# V2.6.3 — provider resilience + retrieval fallback

This is the final validation hardening pass before another 10-claim run.

## Temporary Gemini failures

Initial and repair Gemini calls now retry automatically on temporary provider
errors such as:

```text
429
503
high demand
temporarily unavailable
```

Retry policy:

```text
first request
↓ temporary failure
~0.9s delay
↓
retry
↓ temporary failure
~1.8s delay
↓
final retry
```

The system still gives up after two retries rather than looping indefinitely.

## Better local verdict mapping

More first-pass verdict variants are normalised locally, including phrases such
as:

```text
Broadly accurate
Mostly accurate
Partly accurate
Strongly supported
Supported by official figures
Not established
Not verified
```

This should reduce quality-repair calls further.

## Targeted retrieval fallback

When:

```text
search results > 0
cited evidence = 0
```

How Sure? now runs one narrower Tavily search using the claim's highest-value
terms plus official/statistical source cues.

Example style:

```text
Britain fastest economic growth G7 2026
official statistics ONS OECD government data
```

If the fallback finds better evidence, the claim is re-evaluated once using the
expanded evidence set.

The fallback is deliberately bounded:

- maximum one extra Tavily search
- maximum one fallback Gemini evaluation
- only runs when the first retrieval produced zero cited evidence

## New diagnostics

Validation output now records:

- initial provider retry count
- repair provider retry count
- retrieval fallback attempted
- number of new fallback sources

## Final validation

Run:

```bash
npm run quality:10
```

Output:

```text
quality/results/ten-claim-validation-v2-6-3.json
```

Target before moving to V3:

- 10/10 analyses complete
- no more than 2 AI quality repairs
- no unresolved quality failures
- claim #3 improves through retrieval fallback or remains explicitly insufficient

# V3.0 — from prototype to shareable product

V3.0 keeps the validated V2.6.3 reasoning pipeline and adds the infrastructure
needed to run How Sure? as a small public product.

## What is new

### Persistent analyses

Every completed assessment is saved in PostgreSQL. The full result includes the
original claim, scores, reasons, evidence, sources, quality information and the
pipeline version used to create it.

### Shareable URLs

A saved result receives a permanent route:

```text
/analysis/{id}
```

The result page includes a **Copy link** action. Opening the link reads the
stored result rather than running Gemini or Tavily again.

### Shared server cache

Before spending an AI or search request, the server checks whether the same
normalised claim has already been analysed by the current pipeline version.
Valid results can be reused for the configured cache period.

### API protection

Only fresh analyses count towards the limits. Existing stored results and
server-cache hits remain available.

Default limits:

```text
10 fresh analyses per visitor per hour
100 fresh analyses across the deployment per day
```

Both values can be changed through environment variables.

### Basic observability

Each run records operational information such as:

- success, error or server-cache hit
- duration
- failure stage
- sources retrieved and cited
- whether quality repair was required
- provider retry count
- whether retrieval fallback ran

No raw IP address is stored. Visitor rate-limit keys are one-way hashes salted
with `RATE_LIMIT_SALT`.

## About How Sure? panel

The information icon in the top-right opens a large editorial panel explaining:

- why the project exists
- the effect of social media on misleading claims
- how a claim is analysed
- what each score means
- why evidence and methodology are visible
- the quality-control process
- the limitations of the tool
- the technical architecture

The content is written for a general audience. Technical terms are translated
into everyday language, with deeper implementation detail placed near the end.

## Set up V3.0

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

Copy `.env.example` and provide:

```text
GEMINI_API_KEY
TAVILY_API_KEY
DATABASE_URL
RATE_LIMIT_SALT
```

### 3. Create the database tables

Run the SQL in:

```text
db/001_v3.sql
```

against the PostgreSQL database in `DATABASE_URL`.

This works with standard PostgreSQL services, including Neon and Supabase's
Postgres database.

### 4. Start locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment controls

```text
ANALYSIS_RATE_LIMIT_PER_HOUR=10
ANALYSIS_DAILY_LIMIT=100
SERVER_CACHE_TTL_HOURS=168
```

`SERVER_CACHE_TTL_HOURS=168` reuses a successful result for seven days. The
saved shareable result itself remains in the database after the cache window;
the window only controls whether it can answer a new matching request without a
fresh analysis.

## V3 architecture

```text
Claim
  ↓
Server cache lookup
  ├─ hit → return saved analysis
  ↓ miss
Rate-limit check
  ↓
Attribution and proposition separation
  ↓
Subclaim retrieval
  ↓
Gemini analysis
  ↓
Local deterministic cleanup
  ↓
Quality checks
  ├─ pass → continue
  └─ fail → one bounded repair
  ↓
Save analysis + operational record
  ↓
Return shareable URL
```

# V3.0.3 — claim-first report hierarchy

This release responds to usability feedback from the live product.

## Changes

### Result closer to the claim

The opening order is now:

```text
Original claim
↓
Verdict and short explanation
↓
About this assessment
```

Source provenance, detected claims and quality metadata no longer delay the main
answer. They are available inside a compact disclosure immediately after the
verdict.

### Source is clearly optional

Unknown-source wording now says:

```text
No source added
That is optional. How Sure? searched for evidence independently.
```

This avoids implying that the user forgot a required step.

### Analyse another claim in the sticky header

Once the original claim leaves the screen, the sticky claim header includes a
prominent `Analyse another claim` action. The quiet duplicate action has been
removed from the normal report header.

# V3.0.4 — clearer assessment sources

The expanded **About this assessment** area now has a dedicated, clearly interactive
**View cited sources** control. It states how many sources were used and expands a
source list inside the assessment details.

The source list explains that sources may support, challenge or contextualise the
assessment and lets the reader open each original source.

Extra inherited dividers inside the expanded assessment area have been removed so
there is one clear outer boundary rather than several competing horizontal rules.


# V3.0.5 — new claim access

`Analyse another claim` is now available in both report navigation states:

- the normal header at the top of the report
- the sticky claim header shown after scrolling

Both actions return the user to the claim input. The normal header action uses
the same primary visual treatment as the sticky action, while `Copy link`
remains secondary.


# V3.0.6 — card-local mobile evidence

On screens up to 760px wide, opening a score now inserts its evidence directly
beneath that score card instead of after the full four-card group.

Desktop behaviour remains unchanged: the selected evidence panel appears beneath
the full score grid.

Every evidence panel now also ends with a clear `Close evidence` action. On
mobile, this bottom action spans the available width so users do not need to
scroll back to the top of a long evidence section to close it.


# V3.0.7 — mobile evidence alignment

The mobile evidence expansion now uses one consistent 14px inset for its header, reasoning, sources and footer. Source cards are constrained to the panel width, long text can wrap safely, and the final `Close evidence` button aligns with the expanded content rather than the viewport or outer grid.


# V3.0.8 — report action order

The normal report header now shows:

```text
Copy link | Analyse another claim
```

`Analyse another claim` remains the primary action and stays on the right. The
sticky header is unchanged.


# V3.0.9 — report CTA alignment

The normal report-header actions now use the same typography and proportions as
the sticky-header `Analyse another claim` CTA:

- uppercase labels
- matching letter-spacing
- compact 34px height
- square corners
- matching border and padding
- consistent font weight and line height

`Copy link` remains the outlined secondary action, while
`Analyse another claim` remains the filled primary action.


# V3.1.0 — performance foundation

This release improves fresh-analysis latency without removing evidence searches
or weakening the quality harness.

## Parallel evidence retrieval

When a statement contains several testable claims, Tavily searches now run in
parallel rather than one after another.

Before:

```text
search C1 → wait → search C2 → wait → search C3 → wait
```

Now:

```text
search C1
search C2  → wait for the group
search C3
```

If one subclaim search fails but the others succeed, How Sure? continues with
the useful evidence. It still fails safely when every search fails.

## Telemetry no longer delays the result

The `analysis_runs` observability insert is scheduled with Next.js `after()`.
The response can be returned to the user before that non-critical logging write
finishes.

Saving the analysis itself remains synchronous so a returned share link always
points to a persisted result.

## Server timing

The `/api/analyse` response now exposes a `Server-Timing` header with:

- cache lookup
- evidence retrieval
- Gemini generation
- persistence
- total server time

Inspect the request in the browser Network panel to identify the dominant stage
using production data.

## Remote timeout

Each Tavily request has a 12-second timeout so one remote search cannot hold the
whole analysis open indefinitely.

## Character limit

The server-side limit is now aligned with the interface at 500 characters.


# V3.1.1 — critical-thinking favicon

How Sure? now uses Lucide's `BrainCircuit` icon as its favicon.

The icon represents:

- critical thinking
- connected evidence
- AI-assisted analysis

It is rendered as a high-contrast black mark on the product's warm off-white
background so it remains legible at browser-tab sizes.

The favicon is generated through Next.js `app/icon.tsx`, so Next.js includes it
in the page metadata automatically.

A new dependency is included:

```bash
npm install lucide-react
```


# V3.1.2 — CTA consistency and sharing language

## Homepage CTA

`Analyse claim` now uses the same compact uppercase typography, height, padding,
square corners and primary treatment as the report and sticky-header CTAs.

## Share analysis

The report action is renamed from `Copy link` to `Share analysis` and now uses
Lucide's `Share2` icon.

This describes the user's goal rather than the technical action. The button still
copies the permanent analysis URL to the clipboard and temporarily confirms with
`Link copied`.


# V3.2.0 — faster analysis + better perceived loading

## Gemini latency

The first analysis pass now uses Gemini 3.6 Flash with `thinkingLevel: "low"`
instead of the model's default reasoning effort.

The existing deterministic quality harness remains unchanged. If the first pass
fails a substantive quality check, the one repair attempt uses
`thinkingLevel: "medium"` for additional reasoning depth.

The rare retrieval-fallback re-analysis also starts at `low`.

This creates a deliberate architecture:

```text
fast first pass (low)
        ↓
quality harness
        ↓
PASS → show result
FAIL → medium-reasoning repair
```

After this change, rerun the 10-claim quality harness before treating the latency
improvement as validated.

## Loading experience

The old four large numbered steps have been removed.

The new loading state:

- keeps the submitted claim visible
- uses one compact animated progress line
- shows elapsed time
- rotates plain-English explanations of the analysis
- avoids pretending that a time-based animation is a real backend progress meter
- uses much less vertical space on mobile

After roughly 12 seconds, the copy acknowledges that the analysis is taking
longer instead of leaving the user wondering whether it has stalled.


# V3.2.1 — favicon build fix

The V3.2.0 build could fail while prerendering `/icon` because `app/icon.tsx`
attempted to use `lucide-react` inside Next.js' server-rendered metadata route.

V3.2.1 removes that React icon route and replaces it with:

```text
app/icon.svg
```

The favicon keeps the Brain Circuit visual direction but is now a static SVG
metadata asset. `lucide-react` remains installed because the application still
uses Lucide icons in client UI such as Share analysis and the loading state.


# V3.2.2 — public analysis activity

The homepage now includes a quiet activity signal beneath the analysis
disclaimer:

```text
128 claims examined against live evidence · 943 sources inspected
```

## Counting rules

- Claims are counted once by normalized claim hash.
- If the same claim was re-analysed under a newer pipeline version, only its
  latest saved assessment is counted.
- Sources inspected is the cumulative number of retrieved sources attached to
  those latest assessments.
- The stats only include saved assessments whose quality status is passed.
- The public stats request is cached for 60 seconds and never blocks the claim
  input from rendering.


# V3.2.3 — Gemini thinking-level type fix

The installed `@google/genai` SDK exposes thinking levels as an enum rather than
accepting string literals.

The analysis route now imports:

```ts
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
```

and uses:

```ts
ThinkingLevel.LOW
ThinkingLevel.MEDIUM
```

for the initial/fallback and repair passes respectively.
