import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
import { query, type SqlConnection } from "./db";
import { AppError, invariant } from "./errors";
import type { User } from "./types";
const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "yc_session";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  return (
    expected.length === derived.length && timingSafeEqual(derived, expected)
  );
}
export function cookieToken(cookie?: string | null) {
  return (
    cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1) || ""
  );
}
export async function userFromToken(token: string): Promise<User | null> {
  if (!token) return null;
  const [user] = await query<User & { password_hash?: string }>(
    `SELECT u.*,s.mfa_verified FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [hashToken(token)],
  );
  if (!user) return null;
  delete user.password_hash;
  return user;
}
export async function requireUser(request: Request) {
  const user = await userFromToken(cookieToken(request.headers.get("cookie")));
  if (!user)
    throw new AppError(401, "Please sign in to continue.", "UNAUTHENTICATED");
  return user;
}
export function requireVerified(user: User) {
  invariant(
    user.email_verified,
    "Verify your email address before publishing or requesting access.",
  );
}
export async function createSession(userId: string, mfaVerified = false) {
  const token = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified) VALUES($1,$2,$3,$4)",
    [
      hashToken(token),
      userId,
      new Date(Date.now() + 30 * 86400000).toISOString(),
      mfaVerified,
    ],
  );
  return token;
}
export function requireAdminMfa(user: User) {
  if (process.env.NODE_ENV === "production")
    invariant(
      user.mfa_verified,
      "Enable multi-factor authentication in account settings and sign in with your authenticator before administering an organization.",
    );
}
export function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export async function rateLimit(key: string, limit = 60, windowSeconds = 60) {
  const [row] = await query(
    `INSERT INTO rate_limits(key,count,resets_at) VALUES($1,1,now()+$2::int*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.resets_at<now() THEN 1 ELSE rate_limits.count+1 END,resets_at=CASE WHEN rate_limits.resets_at<now() THEN now()+$2::int*interval '1 second' ELSE rate_limits.resets_at END RETURNING count`,
    [key, windowSeconds],
  );
  if (row.count > limit)
    throw new AppError(
      429,
      "Too many requests. Please try again shortly.",
      "RATE_LIMITED",
    );
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const allowed = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : url.origin;
  invariant(
    !!origin &&
      (origin === allowed ||
        (process.env.NODE_ENV !== "production" && origin === url.origin)),
    "This request came from an untrusted origin.",
  );
}
export async function audit(
  tx: SqlConnection,
  actorId: string,
  orgId: string | null,
  action: string,
  resourceId: string,
  metadata: object = {},
) {
  await tx.query(
    "INSERT INTO audit_logs(id,organization_id,actor_id,action,resource_id,metadata) VALUES($1,$2,$3,$4,$5,$6)",
    [
      randomUUID(),
      orgId,
      actorId,
      action,
      resourceId,
      JSON.stringify(metadata),
    ],
  );
}
