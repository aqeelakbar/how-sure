import Link from "next/link";

export default function NotFound() {
  return (
    <main className="input-page">
      <div className="input-shell">
        <p className="brand">How Sure?</p>
        <div className="input-copy">
          <p className="eyebrow">Analysis not found</p>
          <h1>This shared result is not available.</h1>
          <p className="lede">The link may be incorrect, or the saved analysis may have been removed.</p>
          <Link className="share-action" href="/">Analyse a claim</Link>
        </div>
      </div>
    </main>
  );
}
