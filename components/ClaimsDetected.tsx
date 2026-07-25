import { Reveal } from "@/components/Reveal";

type Claim = {
  id: string;
  text: string;
};

type Props = {
  claims: Claim[];
};

export function ClaimsDetected({ claims }: Props) {
  if (!claims.length) return null;

  return (
    <section className="context-row claims-detected-section">
      <div className="context-row-label">
        <p className="section-label">Claims detected</p>
      </div>

      <div className="context-row-content">
        <Reveal>
          <div className="claims-detected-summary">
            <strong>
              {claims.length} testable claim{claims.length === 1 ? "" : "s"}
            </strong>

            <p>
              The proposition is tested separately from any reporting wrapper,
              then the evidence is brought back together for the overall assessment.
            </p>
          </div>
        </Reveal>

        <div className="claims-detected-list">
          {claims.map((claim, index) => (
            <Reveal key={claim.id} delay={index * 0.06}>
              <article className="detected-claim">
                <span>{claim.id}</span>
                <p>{claim.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
