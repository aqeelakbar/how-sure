"use client";

import type { Annotation } from "@/types/claim";
import { Reveal } from "@/components/Reveal";

type Props = {
  annotation: Annotation;
};

export function QuestionClarification({ annotation }: Props) {
  return (
    <section className="section question-clarification-section">
      <Reveal>
        <p className="section-label">One thing to clarify</p>
        <blockquote className="question-clarification-phrase">
          “{annotation.phrase}”
        </blockquote>
        <p className="question-clarification-copy">{annotation.explanation}</p>
      </Reveal>
    </section>
  );
}
