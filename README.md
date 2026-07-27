# How Sure?

**How Sure?** is a critical-thinking tool for inspecting public statements before accepting them at face value.

Paste in a claim, quote or political statement and How Sure? separates attribution from the underlying proposition, searches the web for relevant evidence, examines context and wording, and returns an inspectable assessment.

It is not a truth machine and it does not tell the user what to think. Its job is to make the reasoning, evidence and limitations behind an assessment visible.

> **Pause before accepting a confident statement at face value.**

## What the product does

A How Sure? analysis moves through a simple sequence:

1. The user submits a statement.
2. Attribution is separated from what is actually being claimed.
3. Checkable propositions are identified.
4. Tavily searches the web for evidence.
5. Gemini analyses the proposition, retrieved evidence, context and wording.
6. Deterministic checks review the result and repair safe, predictable issues.
7. The user sees the conclusion, reasons, evidence and inspectable language analysis.

The loading state reinforces the same principle:

> **Checking before concluding.**

## Result structure

The main result page is deliberately layered so a user can stop at the level of detail they need.

### 1. Original claim

The submitted statement is shown first, alongside attribution and claim-type metadata where available.

### 2. Should I trust this claim?

A plain-English verdict summarises how the statement should initially be treated, for example:

- Well supported
- Mostly opinion
- Not enough evidence
- Misleading
- False

The verdict is accompanied by a short explanation rather than a score alone.

### 3. Why we reached this conclusion

The assessment is broken into four dimensions.

#### Based on facts
**Can the proposition be objectively tested as written?**

This dimension is about factual testability, not simply whether a source exists. A value judgement may score low because no objective standard can establish it as true or false.

#### Evidence quality
**How direct, relevant, reliable and independent is the available evidence?**

Source cards show what each source actually contributes to the assessment rather than treating every related article as proof.

#### Enough context
**Is important context missing that could change how the statement is understood?**

This can include qualifiers, examples, definitions, timeframes, comparison standards or surrounding context.

#### Fair wording
**Does the wording use vague, broad, categorical, evaluative or loaded language?**

This dimension can be based on the proposition itself. External sources are not required when the relevant issue is linguistic.

Each detailed evidence view separates:

- **What we found**
- **Why it matters**
- the evidence or language analysis used for that dimension

## Evidence roles

Sources are assigned roles so the UI can explain what they actually do:

- **Supports proposition**
- **Contradicts proposition**
- **Adds context**
- **Defines term**
- **Verifies attribution**

Verification of attribution is deliberately separated from verification of truth. Showing that somebody said something does not establish that the underlying proposition is correct.

Source quality is also separate from source role. A high-quality source can still be irrelevant to whether a proposition is true.

## Claim vs evidence

The **Claim vs evidence** section compares how certain a statement sounds with how strongly the available evidence supports the underlying proposition.

Two diagnostics are used:

- **Claim confidence** — how certain the statement sounds
- **Evidence support** — how strongly the available evidence supports the proposition

The application derives a confidence balance:

`evidence support - claim confidence`

Negative values indicate that the statement sounds more certain than the evidence can justify or establish. Values near zero are aligned. Positive values indicate wording that is more cautious than the evidence requires.

The result is expressed in plain language, such as **Strong overclaim**, alongside a visual scale.

The expanded explanation focuses on **why the gap exists** rather than repeating the evidence cards already available in the four assessment dimensions:

- what makes the claim sound certain
- what the evidence establishes
- what the evidence does not establish

## Statement Anatomy

**What words are doing the work?** lets the user inspect phrases inside the statement.

Inspectable phrases use a dashed underline. Selecting one reveals:

- the selected language
- what that language is doing
- a short linguistic or rhetorical explanation

The analysis is intentionally about the function of the wording, not whether the phrase itself is true or false.

Typical annotation types include:

- Value judgement
- Undefined term
- Vague term
- Categorical wording
- Absolute wording
- Broad scope
- Broad generalisation
- Loaded framing
- Evaluative wording
- Comparison standard
- Qualifier

The active phrase is shown with a stronger selected state.

## Bottom line and What this means

The result page uses two different summaries:

### Bottom line
The primary conclusion of the assessment.

### What this means
A quieter interpretation layer explaining how the statement should be understood or used.

They intentionally have different jobs even when both appear on dark backgrounds.

## About this assessment

The compact **About this assessment** panel records:

- what was assessed
- attribution
- how many cited sources were used

It does not repeat the full source browser; detailed evidence belongs in the relevant Why sections.

## Quality control

The AI's first response is not automatically shown.

How Sure? uses a quality-control layer to catch predictable problems before a result reaches the user.

Checks include:

- confirming attribution must not make the proposition appear more factual
- ensuring each dimension matches the reasoning and evidence shown for it
- allowing citations only to sources actually retrieved by the search system
- reserving **False** for cases where evidence directly contradicts the proposition
- preferring plain language over technical jargon
- keeping the four analytical dimensions semantically consistent

Safe formatting or consistency problems can be repaired locally in code. Substantive issues can trigger one AI repair attempt. If uncertainty remains, the assessment can be marked as lower confidence.

## Methodology

The methodology panel exposes the underlying process rather than asking the user to trust a hidden answer.

At a high level:

**Retrieve → Separate attribution → Interpret → Check → Calculate**

The panel also documents:

- the four assessment dimensions
- confidence balance
- source roles
- source quality
- limitations

How Sure? intentionally keeps source retrieval, model interpretation and application logic conceptually separate so the result is easier to inspect.

## Limitations

How Sure? is **not a truth machine**.

It can:

- miss useful evidence
- retrieve weak or incomplete sources
- misunderstand an unclear statement
- misclassify wording or context
- produce an incorrect model interpretation

Some propositions are moral, political or philosophical value judgements rather than factual claims. How Sure? can analyse their assumptions, language, attribution and surrounding evidence, but it cannot objectively decide a user's values for them.

Visible evidence and language-analysis panels are therefore part of the audit trail, not decoration.

## Technical architecture

How Sure? combines generative AI with conventional application logic.

### AI and retrieval

- **Google Gemini 3.6 Flash** — statement interpretation, evidence analysis, structured output and language analysis
- **Tavily** — web evidence retrieval

### Application

- **Next.js 16.2.11**
- **React 19**
- **TypeScript**
- **Motion**
- **Zod**
- **Postgres**
- **Lucide React**

Conventional software handles tasks such as scoring rules, source checks, caching, quality controls and saved/shared analyses.

## Local development

### Requirements

- Node.js compatible with Next.js 16
- npm
- Gemini API key
- Tavily API key

### Environment variables

Create a `.env.local` file in the project root.

```bash
GEMINI_API_KEY=
TAVILY_API_KEY=

# Optional / deployment-specific
DATABASE_URL=
HOW_SURE_BASE_URL=
RATE_LIMIT_SALT=
SERVER_CACHE_TTL_HOURS=
```

Do not commit real API keys.

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Then open the local URL shown by Next.js.

### Production build

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

## Quality checks

The repository includes additional validation scripts:

```bash
npm run quality
npm run quality:live
npm run quality:10
```

These cover deterministic logic checks, live analysis checks and the multi-claim validation runner.

## Design principles

A few principles guide the product:

**Evidence ≠ relevance**  
A related source is not automatically proof.

**Attribution ≠ truth**  
Showing that somebody said something does not make the proposition true.

**Confidence ≠ evidence**  
A statement can sound highly certain while resting on limited or non-testable support.

**AI ≠ oracle**  
The model is one part of a wider process that includes retrieval, deterministic rules, validation and visible evidence.

**Inspectability over authority**  
Showing the method does not guarantee that an answer is correct. It makes the answer easier to question, inspect and hold accountable.

## Creator

Designed and built by **Aqeel Akbar**, a UX engineer focused on making complex systems easier to understand, question and use.

The product links to the creator's portfolio and LinkedIn profile from the About panel.
