import Link from "next/link";

export default function NotFound() {
  return (
    <div className="doc">
      <div className="wrap" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1>Nothing here.</h1>
        <p className="sub">This page does not exist.</p>
        <p>
          <Link className="btn acc" href="/">
            Back to the start
          </Link>
        </p>
      </div>
    </div>
  );
}
