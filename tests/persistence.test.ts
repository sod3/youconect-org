import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
test(
  "acknowledged data survives an abrupt process exit and a second clean restart",
  { timeout: 180000 },
  async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "youconect-durability-"));
    const probe = (mode: string) =>
      new Promise<string>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["--import", "tsx", "scripts/persistence-probe.ts", mode],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              DATABASE_URL: "",
              DATA_DIR: dir,
              DEMO_ENABLED: "false",
              LOCAL_DB_EPHEMERAL: "false",
            },
            windowsHide: true,
          },
        );
        let output = "";
        child.stdout.on("data", (d) => {
          output += d.toString();
        });
        child.stderr.on("data", (d) => {
          output += d.toString().slice(-500);
        });
        child.on("error", reject);
        child.on("exit", (code) =>
          code === 0 ? resolve(output) : reject(new Error(output)),
        );
      });
    try {
      assert.match(await probe("write"), /Acknowledged/);
      assert.match(await probe("read"), /Recovered acknowledged data/);
      assert.match(await probe("read"), /Recovered acknowledged data/);
    } finally {
      const safe = path.resolve(dir);
      assert(safe.startsWith(path.join(tmpdir(), "youconect-durability-")));
      await rm(safe, { recursive: true, force: true });
    }
  },
);
