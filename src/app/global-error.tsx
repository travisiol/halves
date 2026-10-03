"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0A0C0B", color: "#F2F4EF", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 480, padding: 32, background: "#111413", border: "1px solid #1E2320", borderRadius: 18 }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px", fontWeight: 500 }}>Something went wrong.</h1>
          <p style={{ color: "#A3A9A1", fontSize: 16, lineHeight: 1.5 }}>{error.message || "An unexpected error interrupted the page."}</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, background: "#F2F4EF", color: "#0A0C0B", border: 0, padding: "14px 24px", borderRadius: 11, cursor: "pointer", fontWeight: 700, fontSize: 16 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
