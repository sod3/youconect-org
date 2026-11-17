import "dotenv/config";
import { getDb } from "../lib/db";
import { seed } from "../lib/seed";
if (
  process.env.NODE_ENV === "production" &&
  process.env.DEMO_ENABLED !== "true"
)
  throw new Error("Demo seeds are disabled in production.");
const db = await getDb();
await seed(db);
console.log("Fictional demonstration fixtures are ready.");
await db.close();
