import type { ClaimAnalysis } from "@/types/claim";

export const claimExample: ClaimAnalysis = {
  statement:
    "Islam is not up for reform or negotiation – so we have no other choice than to fight it.",
  detectedClaims: [
    {
      id: "C1",
      text: "Islam is not up for reform or negotiation."
    },
    {
      id: "C2",
      text: "There is no other choice than to fight Islam."
    }
  ],
  speaker: "Tommy Robinson",
  type: "Political statement",
  verdict: "Misleading as stated",
  verdictSummary:
    "The statement makes a sweeping claim about Islam and then presents confrontation as the only possible response. The historical record and the structure of the argument do not justify that level of certainty.",
  scoreThemes: [
    {
      id: "factual",
      label: "Based on facts",
      score: 25,
      summary: "Weak support for the statement's broad factual premise.",
      rationale: [
        "The claim treats Islam as a single, fixed system.",
        "Historical scholarship documents multiple traditions of reform and reinterpretation.",
        "The absolute wording is much broader than the evidence supports."
      ],
      sources: [
        {
          title: "The Oxford Handbook of Islamic Reform",
          publisher: "Oxford Academic",
          type: "Academic synthesis",
          role: "Contradicts",
          quality: "High",
          relevance:
            "Documents historical and contemporary Islamic reform movements and debates, directly challenging the absolute claim that reform is impossible.",
          url: "https://academic.oup.com/edited-volume/62861"
        },
        {
          title: "Islamic Reform: Politics and Social Change",
          publisher: "Oxford Academic",
          type: "Academic chapter",
          role: "Contextualises",
          quality: "High",
          relevance:
            "Provides historical context on reform, reinterpretation, and political change within Islamic thought.",
          url: "https://academic.oup.com/edited-volume/62861"
        },
        {
          title: "Islamic Modernism and Reform",
          publisher: "Encyclopaedia Britannica",
          type: "Reference source",
          role: "Defines",
          quality: "Medium",
          relevance:
            "Provides accessible background on reformist and modernist movements within Islam.",
          url: "https://www.britannica.com/topic/Islamic-modernism"
        }
      ]
    },
    {
      id: "evidence",
      label: "Evidence quality",
      score: 20,
      summary: "Little evidence supports the universal wording used.",
      rationale: [
        "The statement provides no supporting evidence for the claim that reform is impossible.",
        "A universal claim requires much stronger evidence than is available.",
        "The conclusion depends on the premise being true, but that premise is contested."
      ],
      sources: [
        {
          title: "The Oxford Handbook of Islamic Reform",
          publisher: "Oxford Academic",
          type: "Academic synthesis",
          role: "Contradicts",
          quality: "High",
          relevance:
            "Provides a broad evidence base showing that Islamic reform movements exist across multiple periods and contexts.",
          url: "https://academic.oup.com/edited-volume/62861"
        },
        {
          title: "Islamic Modernism and Reform",
          publisher: "Encyclopaedia Britannica",
          type: "Reference source",
          role: "Contextualises",
          quality: "Medium",
          relevance:
            "Shows that reform is a recognised historical phenomenon, weakening the evidential basis for a universal negative claim.",
          url: "https://www.britannica.com/topic/Islamic-modernism"
        }
      ]
    },
    {
      id: "context",
      label: "Enough context",
      score: 18,
      summary: "Important historical and theological variation is omitted.",
      rationale: [
        "Islam is treated as homogeneous despite major variation across movements and schools of thought.",
        "The meaning of 'negotiation' is left undefined.",
        "The claim does not acknowledge reformist traditions or differing political and theological contexts."
      ],
      sources: [
        {
          title: "The Oxford Handbook of Islamic Reform",
          publisher: "Oxford Academic",
          type: "Academic synthesis",
          role: "Contextualises",
          quality: "High",
          relevance:
            "Shows substantial variation in reform movements, theological debates, and political contexts.",
          url: "https://academic.oup.com/edited-volume/62861"
        },
        {
          title: "Islamic Modernism and Reform",
          publisher: "Encyclopaedia Britannica",
          type: "Reference source",
          role: "Defines",
          quality: "Medium",
          relevance:
            "Offers accessible context on the variety of reformist responses within Islam.",
          url: "https://www.britannica.com/topic/Islamic-modernism"
        }
      ]
    },
    {
      id: "rhetoric",
      label: "Fair wording",
      score: 8,
      summary: "The wording strongly pushes the reader toward one conclusion.",
      rationale: [
        "The phrase 'no other choice' presents a false dilemma.",
        "The phrase 'fight it' is loaded and prescriptive.",
        "Absolute language reduces uncertainty and makes a contested premise sound settled."
      ],
      sources: []
    }
  ],
  rhetoricalCertainty: 97,
  evidenceCertainty: 24,
  certaintyGapSummary:
    "The claim expresses substantially more confidence than the available evidence supports.",
  annotations: [
    {
      phrase: "not",
      label: "Absolute claim",
      explanation: "The statement allows no exceptions or qualification."
    },
    {
      phrase: "reform",
      label: "Evidence conflict",
      explanation:
        "Historical scholarship documents Islamic reform movements and reinterpretation."
    },
    {
      phrase: "negotiation",
      label: "Ambiguous",
      explanation:
        "It is unclear whether this means theology, politics, law, or coexistence."
    },
    {
      phrase: "no other choice",
      label: "False dilemma",
      explanation:
        "The statement excludes alternative responses without demonstrating that they are unavailable."
    },
    {
      phrase: "fight it",
      label: "Loaded / prescriptive",
      explanation:
        "The phrase calls for opposition while leaving the form of that opposition unclear."
    }
  ],
  defensibleRewrite: "",
  plainEnglish:
    "Islam is too broad and diverse to reasonably claim that it cannot change. The statement takes a disputed idea, presents it as certain, and then uses that certainty to argue that confrontation is unavoidable.",
  bottomLine:
    "There is good reason not to rely on this statement as presented."
};
