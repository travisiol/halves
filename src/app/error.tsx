"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="doc">
      <div className="wrap" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1>Something went wrong.</h1>
        <p className="sub">{error.message || "An unexpected error interrupted the page."}</p>
        <p>
          <button type="button" className="btn acc" onClick={() => reset()}>
            Try again
          </button>
        </p>
      </div>
    </div>
  );
}
