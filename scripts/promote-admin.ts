import "dotenv/config";
import { getDb } from "../lib/db";
import { audit } from "../lib/auth";
const email = process.argv[2]?.toLowerCase().trim();
if (!email)
  throw new Error("Usage: npm run admin:promote -- verified-email@example.com");
const db = await getDb();
try {
  await db.transaction(async (tx) => {
    const [user] = await tx.query(
      "SELECT id,email_verified FROM users WHERE email=$1",
      [email],
    );
    if (!user?.email_verified)
      throw new Error("A verified account must already exist.");
    await tx.query("UPDATE users SET platform_role='admin' WHERE id=$1", [
      user.id,
    ]);
    await audit(tx, user.id, null, "platform.admin_bootstrapped", user.id);
  });
  console.log(
    "Verified account promoted. Production access still requires authenticator MFA.",
  );
} finally {
  await db.close();
}
