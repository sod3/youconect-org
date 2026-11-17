import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { query, getDb, demoEnabled } from "./db";
import { AppError, invariant } from "./errors";
import {
  hashPassword,
  verifyPassword,
  createSession,
  hashToken,
  requireUser,
  requireVerified,
  rateLimit,
  cookieToken,
  audit,
} from "./auth";
import { sendMail } from "./mail";
import { mfaEnabled, verifyMfa } from "./mfa";
const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128);
const emailSchema = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase().trim());
export async function authAction(
  action: string,
  request: Request,
  body: Record<string, unknown>,
) {
  const ip =
    process.env.TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")?.split(",")[0] || "local"
      : "local";
  await rateLimit(`auth:${action}:${ip}`, action === "login" ? 30 : 60, 600);
  if (action === "login") {
    const input = z
      .object({
        email: emailSchema,
        password: z.string().min(1).max(128),
        code: z.string().max(30).optional(),
      })
      .parse(body);
    const [row] = await query("SELECT * FROM users WHERE email=$1", [
      input.email,
    ]);
    // Equal work for unknown addresses prevents trivial credential enumeration.
    const valid = await verifyPassword(
      input.password,
      row?.password_hash ||
        "00000000000000000000000000000000:" + "00".repeat(64),
    );
    invariant(row && valid, "The email or password is incorrect.", 401);
    const mfa = await mfaEnabled(row.id);
    if (mfa && !input.code) return { data: { mfaRequired: true } };
    if (mfa) await verifyMfa(row.id, input.code!);
    return {
      token: await createSession(row.id, mfa),
      data: {
        ok: true,
        verified: row.email_verified,
        onboarding: row.onboarding_complete,
      },
    };
  }
  if (action === "signup") {
    const input = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: emailSchema,
        password: passwordSchema,
      })
      .parse(body);
    if (process.env.NODE_ENV === "production")
      invariant(
        process.env.SMTP_URL && process.env.MAIL_FROM,
        "Email delivery is not configured.",
        503,
      );
    const userId = randomUUID(),
      token = randomBytes(32).toString("hex");
    const hash = await hashPassword(input.password);
    try {
      await (
        await getDb()
      ).transaction(async (tx) => {
        await tx.query(
          "INSERT INTO users(id,email,password_hash,name) VALUES($1,$2,$3,$4)",
          [userId, input.email, hash, input.name],
        );
        await tx.query(
          "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'verify',now()+interval '24 hours')",
          [hashToken(token), userId],
        );
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new AppError(
          409,
          "An account with this email already exists. Please sign in.",
        );
      throw e;
    }
    const link = `${process.env.APP_URL || new URL(request.url).origin}/verify-email?token=${token}`;
    await sendMail(
      input.email,
      "Verify your YouConect email",
      `Welcome, ${input.name}. Verify your email: ${link}`,
    );
    return {
      token: await createSession(userId),
      data: {
        ok: true,
        ...(process.env.NODE_ENV !== "production"
          ? { devVerificationUrl: link }
          : {}),
      },
    };
  }
  if (action === "demo") {
    invariant(demoEnabled(), "The demonstration environment is disabled.", 404);
    const key = z
      .enum(["ayla", "zara", "omar", "daniel"])
      .default("ayla")
      .parse(body.person);
    const [user] = await query("SELECT id FROM users WHERE id=$1", [
      `demo-${key}`,
    ]);
    invariant(user, "Run the demo seed first.", 503);
    return { token: await createSession(user.id), data: { ok: true } };
  }
  if (action === "verify") {
    const token = z.string().min(32).max(128).parse(body.token);
    await (
      await getDb()
    ).transaction(async (tx) => {
      const [row] = await tx.query(
        "SELECT * FROM auth_tokens WHERE token_hash=$1 AND purpose='verify' AND expires_at>now() AND used_at IS NULL FOR UPDATE",
        [hashToken(token)],
      );
      invariant(row, "This verification link is invalid or has expired.", 400);
      await tx.query("UPDATE users SET email_verified=true WHERE id=$1", [
        row.user_id,
      ]);
      await tx.query(
        "UPDATE auth_tokens SET used_at=now() WHERE token_hash=$1",
        [hashToken(token)],
      );
    });
    return { data: { ok: true } };
  }
  if (action === "forgot-password") {
    const email = emailSchema.parse(body.email);
    await rateLimit(`recovery:${hashToken(email)}`, 3, 900);
    const [user] = await query("SELECT id FROM users WHERE email=$1", [email]);
    let devResetUrl: string | undefined;
    if (user) {
      const token = randomBytes(32).toString("hex");
      await query(
        "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '30 minutes')",
        [hashToken(token), user.id],
      );
      const link = `${process.env.APP_URL || new URL(request.url).origin}/reset-password?token=${token}`;
      await sendMail(
        email,
        "Reset your YouConect password",
        `Reset your password: ${link}`,
      );
      if (process.env.NODE_ENV !== "production") devResetUrl = link;
    }
    return {
      data: {
        ok: true,
        message: "If an account exists, a recovery link has been sent.",
        ...(devResetUrl ? { devResetUrl } : {}),
      },
    };
  }
  if (action === "reset-password") {
    const input = z
      .object({ token: z.string().min(32).max(128), password: passwordSchema })
      .parse(body);
    const hash = await hashPassword(input.password);
    await (
      await getDb()
    ).transaction(async (tx) => {
      const [row] = await tx.query(
        "SELECT * FROM auth_tokens WHERE token_hash=$1 AND purpose='reset' AND expires_at>now() AND used_at IS NULL FOR UPDATE",
        [hashToken(input.token)],
      );
      invariant(row, "This recovery link is invalid or has expired.", 400);
      await tx.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        hash,
        row.user_id,
      ]);
      await tx.query(
        "UPDATE auth_tokens SET used_at=now() WHERE user_id=$1 AND purpose='reset'",
        [row.user_id],
      );
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [row.user_id]);
    });
    return { data: { ok: true } };
  }
  if (action === "logout") {
    const user = await requireUser(request);
    await query("DELETE FROM sessions WHERE token_hash=$1 AND user_id=$2", [
      hashToken(cookieToken(request.headers.get("cookie"))),
      user.id,
    ]);
    return { token: "", data: { ok: true } };
  }
  if (action === "onboarding") {
    const user = await requireUser(request);
    requireVerified(user);
    const input = z
      .object({
        headline: z.string().trim().max(160),
        interests: z.array(z.string().max(40)).max(12),
      })
      .parse(body);
    await query(
      "UPDATE users SET headline=$1,interests=$2,onboarding_complete=true WHERE id=$3",
      [input.headline, JSON.stringify(input.interests), user.id],
    );
    return { data: { ok: true } };
  }
  throw new AppError(404, "This authentication route does not exist.");
}
