import {
  readFile,
  mkdir,
  readdir,
  open,
  rename,
  unlink,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool, type PoolClient } from "pg";
import { createHash } from "node:crypto";

// SQL is deliberately parameterized at this boundary. All drivers use PostgreSQL.
export type Row = Record<string, any>; // Dynamic SQL row boundary; domain types live in types.ts.
export interface SqlConnection {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}
export interface Database extends SqlConnection {
  transaction<T>(fn: (tx: SqlConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
declare global {
  var __youconectDb: Promise<Database> | undefined;
}
export const dataDir = () => path.resolve(process.env.DATA_DIR || ".data");
export const demoEnabled = () =>
  process.env.DEMO_ENABLED === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.DEMO_ENABLED !== "false");
const normalize = <T>(value: T): T => JSON.parse(JSON.stringify(value));

async function initialize(): Promise<Database> {
  let db: Database;
  let enablePersistence: (() => Promise<void>) | undefined;
  let restoreLocal: (() => Promise<void>) | undefined;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
    const wrap = (client: Pool | PoolClient): SqlConnection => ({
      query: async (sql, params = []) =>
        normalize((await client.query(sql, params)).rows),
    });
    db = {
      ...wrap(pool),
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(wrap(client));
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  } else {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "Production requires DATABASE_URL. Embedded PostgreSQL is a local development fallback.",
      );
    await mkdir(dataDir(), { recursive: true });
    // Load an atomic archive into PostgreSQL's memory filesystem. This avoids
    // NodeFS WAL recovery failures after abrupt Windows process termination.
    // The last acknowledged write always has a complete durable archive.
    const lockFile = path.join(dataDir(), "postgres.lock");
    try {
      const lock = JSON.parse(await readFile(lockFile, "utf8")) as {
        pid: number;
      };
      let alive = false;
      try {
        process.kill(lock.pid, 0);
        alive = true;
      } catch {}
      if (alive)
        throw new Error(
          "The local database is already in use. Stop the preview before running a separate database command.",
        );
      await unlink(lockFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const lock = await open(lockFile, "wx", 0o600);
    await lock.writeFile(JSON.stringify({ pid: process.pid }));
    await lock.close();
    const snapshotPath = path.join(dataDir(), "postgres.json");
    let logical: { format: string; tables: Record<string, Row[]> } | undefined;
    let snapshot: Buffer | undefined;
    try {
      const envelope = JSON.parse(await readFile(snapshotPath, "utf8")) as {
        payload: string;
        sha256: string;
      };
      if (
        createHash("sha256").update(envelope.payload).digest("hex") !==
        envelope.sha256
      )
        throw new Error(
          "Local snapshot checksum failed. The original and previous files are preserved.",
        );
      logical = JSON.parse(envelope.payload);
      if (logical?.format !== "youconect-postgres-v1")
        throw new Error("Unsupported local snapshot format.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!logical)
      try {
        snapshot = await readFile(path.join(dataDir(), "postgres.snapshot"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    const pg = new PGlite(
      snapshot ? { loadDataDir: new Blob([new Uint8Array(snapshot)]) } : {},
    );
    await pg.waitReady;
    let persistence = false,
      chain: Promise<unknown> = Promise.resolve();
    const serialize = <T>(work: () => Promise<T>) => {
      const task = chain.then(work, work);
      chain = task.catch(() => {});
      return task;
    };
    const persist = async () => {
      if (!persistence) return;
      const tables = (
        await pg.query<{ tablename: string }>(
          "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
        )
      ).rows;
      const records = await pg.transaction(async (tx) => {
        const result: Record<string, unknown> = {};
        for (const { tablename } of tables) {
          if (!/^[a-z_]+$/.test(tablename))
            throw new Error("Unexpected local table identifier");
          result[tablename] = (
            await tx.query(`SELECT * FROM "${tablename}"`)
          ).rows;
        }
        return result;
      });
      const payload = JSON.stringify({
        format: "youconect-postgres-v1",
        tables: records,
      });
      const encoded = JSON.stringify({
        payload,
        sha256: createHash("sha256").update(payload).digest("hex"),
      });
      const temp = `${snapshotPath}.tmp`;
      const file = await open(temp, "w", 0o600);
      try {
        await file.writeFile(encoded);
        await file.sync();
      } finally {
        await file.close();
      }
      try {
        await copyFile(snapshotPath, `${snapshotPath}.previous`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await rename(temp, snapshotPath);
    };
    if (logical)
      restoreLocal = async () => {
        const known = (
          await pg.query<{ tablename: string }>(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'",
          )
        ).rows.map((t) => t.tablename);
        for (const table of Object.keys(logical!.tables))
          if (!known.includes(table))
            throw new Error(`Unknown table in local snapshot: ${table}`);
        await pg.transaction(async (tx) => {
          await tx.query("SET LOCAL session_replication_role=replica");
          await tx.query(
            `TRUNCATE ${known.map((t) => `"${t}"`).join(",")} CASCADE`,
          );
          for (const [table, rows] of Object.entries(logical!.tables)) {
            for (const row of rows) {
              const columns = Object.keys(row);
              if (columns.some((c) => !/^[a-z_]+$/.test(c)))
                throw new Error("Invalid local snapshot column");
              const values = columns.map((c) => {
                const value = row[c];
                return value && typeof value === "object"
                  ? JSON.stringify(value)
                  : value;
              });
              await tx.query(
                `INSERT INTO "${table}"(${columns.map((c) => `"${c}"`).join(",")}) VALUES(${values.map((_, i) => `$${i + 1}`).join(",")})`,
                values,
              );
            }
          }
        });
      };
    db = {
      query: async (sql, params = []) => {
        if (/^\s*(SELECT|SHOW|EXPLAIN)\b/i.test(sql))
          return normalize((await pg.query(sql, params)).rows) as never;
        return serialize(async () => {
          const rows = normalize((await pg.query(sql, params)).rows);
          await persist();
          return rows as never;
        });
      },
      transaction: (fn) =>
        serialize(async () => {
          const result = await pg.transaction((tx) =>
            fn({
              query: async (sql, params = []) =>
                normalize((await tx.query(sql, params)).rows) as never,
            }),
          );
          await persist();
          return result;
        }),
      close: async () => {
        await chain;
        try {
          await persist();
          await pg.close();
        } finally {
          await unlink(lockFile).catch(() => {});
        }
      },
    };
    enablePersistence = async () => {
      persistence = process.env.LOCAL_DB_EPHEMERAL !== "true";
      await persist();
    };
  }
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const files = (await readdir(path.resolve("migrations")))
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();
  async function applyMigrations() {
    for (const file of files) {
      const version = file.split("_")[0];
      if (
        (
          await db.query("SELECT 1 FROM schema_migrations WHERE version=$1", [
            version,
          ])
        ).length
      )
        continue;
      const migration = await readFile(
        path.resolve("migrations", file),
        "utf8",
      );
      await db.transaction(async (tx) => {
        for (const statement of migration
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean))
          await tx.query(statement);
        await tx.query(
          "INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING",
          [version],
        );
      });
    }
  }
  await applyMigrations();
  await restoreLocal?.();
  if (restoreLocal) await applyMigrations();
  if (demoEnabled()) {
    const { seed } = await import("./seed");
    await seed(db);
  }
  await enablePersistence?.();
  return db;
}
export function getDb(): Promise<Database> {
  return (globalThis.__youconectDb ??= initialize());
}
export async function query<T extends Row = Row>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}
