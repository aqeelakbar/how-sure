export type QualityCase = {
  id: string;
  category:
    | "equivalence"
    | "attribution"
    | "subject"
    | "factual"
    | "evaluative"
    | "causal"
    | "loaded"
    | "vague";
  statement: string;
  expectedProposition?: string;
  expectedAttribution?: string | null;
  equivalenceGroup?: string;
  note: string;
};

export const qualityCorpus: QualityCase[] = [
  {
    id: "benefits-plain",
    category: "equivalence",
    statement: "claiming benefits in the UK is too easy",
    expectedProposition: "claiming benefits in the UK is too easy",
    expectedAttribution: null,
    equivalenceGroup: "benefits-attribution",
    note: "Baseline proposition.",
  },
  {
    id: "benefits-says",
    category: "equivalence",
    statement: "Kemi Badenoch says claiming benefits in the UK is too easy",
    expectedProposition: "claiming benefits in the UK is too easy",
    expectedAttribution: "Kemi Badenoch",
    equivalenceGroup: "benefits-attribution",
    note: "Reporting verb must not alter the proposition.",
  },
  {
    id: "benefits-colon",
    category: "equivalence",
    statement: "Kemi Badenoch: claiming benefits in the UK is too easy",
    expectedProposition: "claiming benefits in the UK is too easy",
    expectedAttribution: "Kemi Badenoch",
    equivalenceGroup: "benefits-attribution",
    note: "Colon attribution must converge with the plain claim.",
  },
  {
    id: "inflation-plain",
    category: "equivalence",
    statement: "inflation is falling in the UK",
    expectedProposition: "inflation is falling in the UK",
    expectedAttribution: null,
    equivalenceGroup: "inflation-attribution",
    note: "Baseline factual proposition.",
  },
  {
    id: "inflation-says",
    category: "equivalence",
    statement: "Rachel Reeves says inflation is falling in the UK",
    expectedProposition: "inflation is falling in the UK",
    expectedAttribution: "Rachel Reeves",
    equivalenceGroup: "inflation-attribution",
    note: "Speaker wrapper should not change factual target.",
  },
  {
    id: "subject-misled",
    category: "subject",
    statement: "Kemi Badenoch misled Parliament",
    expectedProposition: "Kemi Badenoch misled Parliament",
    expectedAttribution: null,
    note: "Named person is the subject and must remain in the proposition.",
  },
  {
    id: "subject-owns",
    category: "subject",
    statement: "Elon Musk owns X",
    expectedProposition: "Elon Musk owns X",
    expectedAttribution: null,
    note: "Person is substantive subject, not attribution.",
  },
  {
    id: "colon-topic-inflation",
    category: "attribution",
    statement: "UK inflation: 3.2%",
    expectedProposition: "UK inflation: 3.2%",
    expectedAttribution: null,
    note: "Topic label must not be treated as a speaker.",
  },
  {
    id: "colon-topic-nhs",
    category: "attribution",
    statement: "NHS waiting lists: 7.4 million",
    expectedProposition: "NHS waiting lists: 7.4 million",
    expectedAttribution: null,
    note: "Metric label must remain the claim.",
  },
  {
    id: "source-colon-bbc",
    category: "attribution",
    statement: "BBC News: inflation fell in June",
    expectedProposition: "inflation fell in June",
    expectedAttribution: "BBC News",
    note: "Clear source-name prefix can be attribution.",
  },
  {
    id: "according-to",
    category: "attribution",
    statement: "According to the ONS, inflation fell in June",
    expectedProposition: "inflation fell in June",
    expectedAttribution: "the ONS",
    note: "Explicit according-to wrapper.",
  },
  {
    id: "factual-number",
    category: "factual",
    statement: "UK inflation was 3.2% in June",
    note: "Specific numerical claim should be treated as testable.",
  },
  {
    id: "factual-spend",
    category: "factual",
    statement: "The government spent £10 billion on the programme last year",
    note: "Specific spending claim.",
  },
  {
    id: "evaluative-easy",
    category: "evaluative",
    statement: "The benefits system is too easy to access",
    note: "Value judgement requiring a defined standard.",
  },
  {
    id: "evaluative-unfair",
    category: "evaluative",
    statement: "The tax system is unfair",
    note: "Normative claim should not be presented as a simple fact.",
  },
  {
    id: "causal-crime",
    category: "causal",
    statement: "The new policing policy caused crime to fall",
    note: "Causal claim needs evidence beyond correlation.",
  },
  {
    id: "causal-traffic",
    category: "causal",
    statement: "The transport plan will reduce congestion",
    note: "Predictive causal claim.",
  },
  {
    id: "loaded-everyone",
    category: "loaded",
    statement: "Everyone knows the immigration system is out of control",
    note: "Absolute and loaded wording.",
  },
  {
    id: "loaded-disaster",
    category: "loaded",
    statement: "The government's housing policy is a complete disaster",
    note: "Strong evaluative framing.",
  },
  {
    id: "vague-immigration",
    category: "vague",
    statement: "Immigration has risen",
    note: "Missing timeframe and measure.",
  },
  {
    id: "vague-economy",
    category: "vague",
    statement: "The economy is doing better",
    note: "Undefined comparison and metric.",
  },
  {
    id: "multi-claim-transport",
    category: "factual",
    statement:
      "The new transport plan will reduce congestion. It will also make commuting more affordable.",
    note: "Two distinct propositions should create two retrieval claims.",
  },
  {
    id: "multi-claim-welfare",
    category: "factual",
    statement:
      "Benefit fraud is rising. The current assessment process is too lenient.",
    note: "Mixed factual and evaluative subclaims.",
  },
  {
    id: "quote-only",
    category: "evaluative",
    statement: "Claiming benefits in the UK is too easy",
    note: "Case/capitalisation should not materially change the proposition.",
  },
];
