import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone-state">
      <span className="eyebrow">404 · A little off the map</span>
      <h1>Let’s reconnect.</h1>
      <p>This page has moved or doesn’t exist.</p>
      <Link className="button button-primary" href="/">
        Back to YouConect
      </Link>
    </main>
  );
}
