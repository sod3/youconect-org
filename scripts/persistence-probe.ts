import { getDb } from "../lib/db";
const db = await getDb();
if (process.argv[2] === "write") {
  await db.query(
    "INSERT INTO contact_requests(id,name,email,message) VALUES('durability-probe','Durability test','probe@example.test','survives-abrupt-exit') ON CONFLICT(id) DO NOTHING",
  );
  console.log("Acknowledged");
  process.exit(0);
}
const [row] = await db.query(
  "SELECT message FROM contact_requests WHERE id='durability-probe'",
);
if (row?.message !== "survives-abrupt-exit")
  throw new Error("Acknowledged data was not durable.");
console.log("Recovered acknowledged data");
await db.close();
