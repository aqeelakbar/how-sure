type Props = {
  label?: string;
  detail?: string;
};

export function VerificationNotice({
  label = "Evidence-backed AI analysis",
  detail = "This result uses live web retrieval. Open the evidence panels to inspect the cited sources.",
}: Props) {
  return (
    <aside className="verification-notice" role="note">
      <span className="verification-dot" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </aside>
  );
}
