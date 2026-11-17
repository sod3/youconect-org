import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const origin = process.env.TEST_BASE_URL || "http://localhost:3000";
let cookie = "";
async function request(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const start = performance.now();
  const response = await fetch(`${origin}/api/${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${path}: ${json.error}`);
  const session = response.headers.get("set-cookie");
  if (session) cookie = session.split(";")[0];
  return { ms: Math.round(performance.now() - start), data: json };
}
const measurements: Record<string, unknown> = {};
measurements.login = (
  await request("auth/login", {
    email: "ayla@demo.youconect.local",
    password: "YouConect-demo-2026!",
  })
).ms;
const testPosts = (await request("posts")).data.items as {
  id: string;
  content: string;
  author_id: string;
}[];
for (const post of testPosts)
  if (
    post.author_id === "demo-ayla" &&
    post.content.startsWith("E2E connected thought ")
  )
    await request(`posts/${post.id}`, {}, "DELETE");
for (const [name, path] of [
  ["feed", "posts?mode=foryou"],
  ["search", "search?q=campus"],
  ["organization", "organizations/northstar"],
  ["history", "conversations/dm-zara"],
] as const) {
  await request(path);
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) samples.push((await request(path)).ms);
  const sorted = [...samples].sort((a, b) => a - b);
  measurements[name] = {
    samples_ms: samples,
    median_ms: sorted[2],
    max_ms: sorted.at(-1),
  };
}
const message = await request("conversations/dm-zara/messages", {
  client_id: randomUUID(),
  content: "Performance probe · fictional development data",
});
measurements.message_persistence_ms = message.ms;
await request(`messages/${message.data.id}`, {}, "DELETE");
const started = performance.now();
const concurrent = await Promise.allSettled(
  Array.from({ length: 10 }, () => request("posts?mode=foryou")),
);
measurements.ten_concurrent_feed_reads = {
  elapsed_ms: Math.round(performance.now() - started),
  successful: concurrent.filter((x) => x.status === "fulfilled").length,
  total: 10,
};
const result = {
  measured_at: new Date().toISOString(),
  environment:
    "Local Windows development server with embedded PostgreSQL and fictional fixtures",
  scope:
    "Small development smoke measurement. Not a p75 Core Web Vitals measurement or a production scalability claim.",
  measurements,
};
await mkdir("docs", { recursive: true });
await writeFile(
  "docs/PERFORMANCE.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
