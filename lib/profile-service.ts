import { z } from "zod";
import { query, getDb } from "./db";
import { invariant } from "./errors";
import { requireVerified } from "./auth";
import type { User } from "./types";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { users } from "./schema";
export async function getProfile(viewer: User, id: string) {
  const statement = new QueryBuilder()
    .select({
      id: users.id,
      name: users.name,
      headline: users.headline,
      bio: users.bio,
      avatar: users.avatar,
      interests: users.interests,
      privacy: users.privacy,
      created_at: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .toSQL();
  const [user] = await query<
    Pick<
      User,
      | "id"
      | "name"
      | "headline"
      | "bio"
      | "avatar"
      | "interests"
      | "privacy"
      | "created_at"
    >
  >(statement.sql, statement.params);
  invariant(user, "Profile not found.", 404);
  const shared = await query(
    "SELECT 1 FROM memberships a JOIN memberships b ON a.organization_id=b.organization_id WHERE a.user_id=$1 AND b.user_id=$2 AND a.status='active' AND b.status='active'",
    [viewer.id, id],
  );
  invariant(
    user.privacy?.profile === "public" || viewer.id === id || shared.length,
    "This profile is private.",
  );
  const orgs =
    user.privacy?.showMemberships || viewer.id === id
      ? await query(
          "SELECT o.id,o.name,o.initials,o.color FROM organizations o JOIN memberships m ON m.organization_id=o.id AND m.status='active' WHERE m.user_id=$1",
          [id],
        )
      : [];
  const [counts] = await query(
    "SELECT (SELECT count(*)::int FROM follows WHERE following_id=$1) followers,(SELECT count(*)::int FROM follows WHERE follower_id=$1) following,EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND following_id=$1) followed",
    [id, viewer.id],
  );
  return {
    user: { ...user, privacy: { profile: user.privacy.profile } },
    organizations: orgs,
    ...counts,
  };
}
export async function updateProfile(user: User, body: unknown) {
  const input = z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      headline: z.string().trim().max(160).optional(),
      bio: z.string().trim().max(2000).optional(),
      avatar: z.enum(["rose", "blue", "teal", "violet", "amber"]).optional(),
      interests: z.array(z.string().max(40)).max(15).optional(),
      privacy: z
        .object({
          profile: z.enum(["public", "private"]).optional(),
          showMemberships: z.boolean().optional(),
          presence: z.boolean().optional(),
          dmRequests: z.boolean().optional(),
          digest: z.boolean().optional(),
          quietHours: z.boolean().optional(),
          eventReminders: z.boolean().optional(),
          timezone: z.string().max(80).optional(),
        })
        .optional(),
    })
    .parse(body);
  const privacy = { ...user.privacy, ...input.privacy };
  if (privacy.timezone)
    try {
      Intl.DateTimeFormat("en", { timeZone: String(privacy.timezone) });
    } catch {
      invariant(false, "Choose a valid timezone.", 400);
    }
  await query(
    "UPDATE users SET name=$1,headline=$2,bio=$3,avatar=$4,interests=$5,privacy=$6 WHERE id=$7",
    [
      input.name ?? user.name,
      input.headline ?? user.headline,
      input.bio ?? user.bio,
      input.avatar ?? user.avatar,
      JSON.stringify(input.interests ?? user.interests),
      JSON.stringify(privacy),
      user.id,
    ],
  );
  return { ok: true };
}
export async function followUser(user: User, id: string, active = true) {
  requireVerified(user);
  invariant(id !== user.id, "You cannot follow yourself.", 400);
  await getProfile(user, id);
  if (active)
    await query(
      "INSERT INTO follows(follower_id,following_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [user.id, id],
    );
  else
    await query(
      "DELETE FROM follows WHERE follower_id=$1 AND following_id=$2",
      [user.id, id],
    );
  return { ok: true };
}
export async function blockUser(user: User, id: string, active = true) {
  invariant(user.id !== id);
  if (active)
    await query(
      "INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [user.id, id],
    );
  else
    await query("DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2", [
      user.id,
      id,
    ]);
  return { ok: true };
}
export async function deleteAccount(user: User) {
  invariant(
    !(
      await query(
        "SELECT 1 FROM memberships WHERE user_id=$1 AND role='owner' AND status='active'",
        [user.id],
      )
    ).length,
    "Transfer your organization ownership before deleting your account.",
    409,
  );
  await (
    await getDb()
  ).transaction(async (tx) => {
    await tx.query("DELETE FROM users WHERE id=$1", [user.id]);
  });
  return { ok: true };
}
export async function exportAccount(user: User) {
  const [posts, messages, memberships, registrations, applications] =
    await Promise.all([
      query("SELECT * FROM posts WHERE author_id=$1", [user.id]),
      query("SELECT * FROM messages WHERE sender_id=$1", [user.id]),
      query("SELECT * FROM memberships WHERE user_id=$1", [user.id]),
      query("SELECT * FROM registrations WHERE user_id=$1", [user.id]),
      query("SELECT * FROM applications WHERE user_id=$1", [user.id]),
    ]);
  return {
    exported_at: new Date().toISOString(),
    user,
    posts,
    messages,
    memberships,
    registrations,
    applications,
  };
}
