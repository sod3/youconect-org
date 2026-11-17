import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { dataDir, getDb } from "../lib/db";
const dir = path.join(dataDir(), "backups");
await mkdir(dir, { recursive: true });
const filename = `youconect-${new Date().toISOString().replace(/[:.]/g, "-")}`;
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL),
    output = path.join(dir, `${filename}.dump`);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
    PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
  };
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pg_dump", ["--format=custom", "--file", output], {
      env,
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`pg_dump exited with code ${code}`)),
    );
  });
  console.log(`PostgreSQL backup saved: ${output}`);
} else {
  const db = await getDb();
  const output = path.join(dir, `${filename}.json`);
  const tables = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const snapshot = await db.transaction(async (tx) => {
    const data: Record<string, unknown> = {};
    for (const row of tables) {
      if (!/^[a-z_]+$/.test(row.tablename))
        throw new Error("Unexpected table identifier");
      data[row.tablename] = await tx.query(`SELECT * FROM "${row.tablename}"`);
    }
    return data;
  });
  await writeFile(
    output,
    JSON.stringify({
      format: "youconect-local-snapshot-v1",
      at: new Date().toISOString(),
      tables: snapshot,
    }),
    { mode: 0o600 },
  );
  await db.close();
  console.log(
    `Local development snapshot saved: ${output}. Keep it private: it includes account and session data.`,
  );
}
