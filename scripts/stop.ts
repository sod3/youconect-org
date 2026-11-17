import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
const dir = path.resolve(process.env.DATA_DIR || ".data"),
  file = path.join(dir, "dev-control.key");
await mkdir(dir, { recursive: true });
let token: string;
try {
  token = await readFile(file, "utf8");
} catch {
  token = randomBytes(32).toString("hex");
  await writeFile(file, token, { mode: 0o600, flag: "wx" });
}
const origin =
  process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const response = await fetch(`${origin}/api/dev/shutdown`, {
  method: "POST",
  headers: {
    Origin: origin,
    "Content-Type": "application/json",
    "X-YouConect-Control": token,
  },
  body: "{}",
});
if (!response.ok)
  throw new Error(`Preview shutdown failed: ${response.status}`);
console.log("Preview is shutting down cleanly.");
const lockFile = path.join(dir, "postgres.lock");
let released = false;
for (let attempt = 0; attempt < 300; attempt++) {
  try {
    const lock = JSON.parse(await readFile(lockFile, "utf8")) as {
      pid: number;
    };
    try {
      process.kill(lock.pid, 0);
    } catch {
      released = true;
      break;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      released = true;
      break;
    }
    throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!released)
  throw new Error(
    "The preview has not finished shutting down. Check its terminal before restarting.",
  );
console.log("Preview stopped; the local database is released.");
