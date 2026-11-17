import "dotenv/config";
import { getDb } from "../lib/db";
const db = await getDb();
console.log("Database migrations applied.");
await db.close();
