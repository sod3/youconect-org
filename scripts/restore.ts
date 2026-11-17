import "dotenv/config";
import path from "node:path";
import { readFile, writeFile, copyFile, rename, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
if (process.env.DATABASE_URL)
  throw new Error(
    "For external PostgreSQL, use pg_restore into a new database and verify before switching.",
  );
const source = process.argv[2];
if (!source || !process.argv.includes("--confirm"))
  throw new Error(
    "Usage: npm run db:restore -- path/to/backup.json --confirm. Stop the preview first.",
  );
const root = path.resolve(process.env.DATA_DIR || ".data"),
  target = path.join(root, "postgres.json");
try {
  const lock = JSON.parse(
    await readFile(path.join(root, "postgres.lock"), "utf8"),
  );
  let alive = false;
  try {
    process.kill(lock.pid, 0);
    alive = true;
  } catch {}
  if (alive) throw new Error("Stop the preview before restoring.");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const input = JSON.parse(await readFile(path.resolve(source), "utf8"));
let payload: string;
if (input.payload && input.sha256) {
  payload = input.payload;
  if (createHash("sha256").update(payload).digest("hex") !== input.sha256)
    throw new Error("Backup checksum does not match.");
} else {
  if (input.format !== "youconect-local-snapshot-v1" || !input.tables)
    throw new Error("Unsupported backup format.");
  payload = JSON.stringify({
    format: "youconect-postgres-v1",
    tables: input.tables,
  });
}
const decoded = JSON.parse(payload);
if (
  decoded.format !== "youconect-postgres-v1" ||
  typeof decoded.tables !== "object"
)
  throw new Error("Invalid backup.");
await mkdir(root, { recursive: true });
const backupDir = path.join(root, "backups");
await mkdir(backupDir, { recursive: true });
try {
  await copyFile(
    target,
    path.join(backupDir, `before-restore-${Date.now()}.json`),
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
await writeFile(
  `${target}.restore`,
  JSON.stringify({
    payload,
    sha256: createHash("sha256").update(payload).digest("hex"),
  }),
  { mode: 0o600 },
);
await rename(`${target}.restore`, target);
console.log("Local backup restored. The previous snapshot was preserved.");
