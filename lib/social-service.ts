import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query, getDb } from "./db";
import { invariant } from "./errors";
import { requireVerified, audit } from "./auth";
import {
  requireMember,
  PUBLISH_ROLES,
  requirePost,
  postVisibility,
  canAccessBridge,
} from "./permissions";
import type { User, Post } from "./types";
import { notify } from "./realtime";
import { requireWorkspace } from "./entitlements";

const postSelect = `SELECT p.*,u.name author_name,u.avatar author_avatar,u.headline author_headline,o.name organization_name,o.color organization_color,c.name community_name,
 (SELECT count(*)::int FROM reactions r WHERE r.post_id=p.id) reaction_count,(SELECT count(*)::int FROM comments pc WHERE pc.post_id=p.id) comment_count,
 EXISTS(SELECT 1 FROM reactions r WHERE r.post_id=p.id AND r.user_id=$1) liked,EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id=p.id AND sp.user_id=$1) saved,
 (SELECT option_index FROM poll_votes pv WHERE pv.post_id=p.id AND pv.user_id=$1) my_vote,
 COALESCE((SELECT json_agg(v) FROM (SELECT option_index,count(*)::int count FROM poll_votes pv WHERE pv.post_id=p.id GROUP BY option_index) v),'[]') votes
 FROM posts p JOIN users u ON u.id=p.author_id LEFT JOIN organizations o ON o.id=p.organization_id LEFT JOIN communities c ON c.id=p.community_id`;
export async function listPosts(userId: string, params: URLSearchParams) {
  const values: unknown[] = [userId],
    conditions = [postVisibility()];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };
  if (params.get("id")) add("p.id=?", params.get("id"));
  if (params.get("organization"))
    add("p.organization_id=?", params.get("organization"));
  if (params.get("community")) add("p.community_id=?", params.get("community"));
  if (params.get("bridge")) add("p.bridge_id=?", params.get("bridge"));
  if (params.get("author")) add("p.author_id=?", params.get("author"));
  if (params.get("q"))
    add("p.content ILIKE ?", `%${params.get("q")!.slice(0, 120)}%`);
  if (params.get("mode") === "following")
    conditions.push(
      "EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.following_id=p.author_id)",
    );
  if (params.get("mode") === "organizations")
    conditions.push(
      "EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=$1 AND m.organization_id=p.organization_id AND m.status='active')",
    );
  if (params.get("mode") === "communities")
    conditions.push(
      "EXISTS(SELECT 1 FROM community_members cm WHERE cm.user_id=$1 AND cm.community_id=p.community_id)",
    );
  if (params.get("mode") === "saved")
    conditions.push(
      "EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.user_id=$1 AND sp.post_id=p.id)",
    );
  const cursor = params.get("cursor");
  if (cursor) {
    const split = cursor.indexOf("|");
    if (split > 0) {
      const date = z.iso.datetime().parse(cursor.slice(0, split));
      values.push(date, cursor.slice(split + 1));
      conditions.push(
        `(p.created_at,p.id)<($${values.length - 1}::timestamptz,$${values.length})`,
      );
    }
  }
  const take = 20;
  const rows = await query<Post>(
    `${postSelect} WHERE ${conditions.join(" AND ")} ORDER BY p.created_at DESC,p.id DESC LIMIT ${take + 1}`,
    values,
  );
  const more = rows.length > take;
  const items = rows.slice(0, take);
  const last = items.at(-1);
  return {
    items,
    nextCursor: more && last ? `${last.created_at}|${last.id}` : null,
  };
}
const createSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write something before publishing.")
    .max(12000),
  kind: z
    .enum([
      "text",
      "image",
      "question",
      "announcement",
      "poll",
      "article",
      "link",
    ])
    .default("text"),
  audience: z
    .enum(["public", "organization", "community", "bridge"])
    .default("public"),
  organization_id: z.string().nullable().optional(),
  community_id: z.string().nullable().optional(),
  bridge_id: z.string().nullable().optional(),
  official: z.boolean().default(false),
  media: z.array(z.string().max(160)).max(4).default([]),
  poll: z
    .object({
      question: z.string().trim().min(1).max(200),
      options: z.array(z.string().trim().min(1).max(100)).min(2).max(6),
    })
    .nullable()
    .optional(),
});
export async function createPost(user: User, body: unknown) {
  requireVerified(user);
  const input = createSchema.parse(body);
  if (input.organization_id && input.audience !== "public")
    await requireWorkspace(input.organization_id);
  if (input.official) {
    const [org] = await query(
      "SELECT verified FROM organizations WHERE id=$1",
      [input.organization_id],
    );
    invariant(
      org?.verified,
      "Only a verified organization can publish official updates.",
    );
  }
  if (input.organization_id)
    await requireMember(
      user.id,
      input.organization_id,
      input.official ? PUBLISH_ROLES : undefined,
    );
  invariant(
    !input.official || !!input.organization_id,
    "Official posts require an organization.",
  );
  if (input.community_id) {
    const [community] = await query("SELECT * FROM communities WHERE id=$1", [
      input.community_id,
    ]);
    invariant(community);
    invariant(
      (
        await query(
          "SELECT 1 FROM community_members WHERE community_id=$1 AND user_id=$2",
          [input.community_id, user.id],
        )
      ).length,
      "Join this community before publishing.",
    );
    if (community.organization_id) {
      await requireMember(user.id, community.organization_id);
      invariant(
        input.organization_id === community.organization_id,
        "Select the community’s organization.",
      );
    }
    invariant(
      community.visibility === "public" || input.audience === "community",
      "Private community content cannot be published publicly.",
    );
  }
  if (input.audience === "organization")
    invariant(input.organization_id, "Choose an organization.", 400);
  if (input.audience === "community")
    invariant(input.community_id, "Choose a community.", 400);
  if (input.audience === "bridge") {
    invariant(
      input.bridge_id && (await canAccessBridge(user.id, input.bridge_id)),
    );
    invariant(
      !input.organization_id && !input.community_id,
      "Bridge content has a separate scope.",
      400,
    );
  }
  invariant(
    input.audience === "bridge" || !input.bridge_id,
    "Select the Bridge audience.",
    400,
  );
  invariant(
    input.kind !== "poll" || input.poll,
    "Add a poll question and options.",
    400,
  );
  for (const id of input.media) {
    const [upload] = await query(
      "SELECT id FROM uploads WHERE id=$1 AND owner_id=$2",
      [id, user.id],
    );
    invariant(upload, "An attachment is missing or belongs to someone else.");
  }
  const id = randomUUID();
  await query(
    "INSERT INTO posts(id,author_id,organization_id,community_id,bridge_id,content,kind,audience,official,media,poll) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      id,
      user.id,
      input.organization_id || null,
      input.community_id || null,
      input.bridge_id || null,
      input.content,
      input.kind,
      input.audience,
      input.official,
      JSON.stringify(input.media),
      input.poll ? JSON.stringify(input.poll) : null,
    ],
  );
  return (await listPosts(user.id, new URLSearchParams({ id }))).items[0];
}
export async function postAction(
  user: User,
  id: string,
  action: string,
  body: Record<string, unknown>,
  method: string,
) {
  const post = await requirePost(user.id, id);
  requireVerified(user);
  if (action === "reaction") {
    await query(
      "INSERT INTO reactions(post_id,user_id) VALUES($1,$2) ON CONFLICT(post_id,user_id) DO NOTHING",
      [id, user.id],
    );
    if (body.active === false)
      await query("DELETE FROM reactions WHERE post_id=$1 AND user_id=$2", [
        id,
        user.id,
      ]);
    return { ok: true };
  }
  if (action === "save") {
    if (body.active === false)
      await query("DELETE FROM saved_posts WHERE post_id=$1 AND user_id=$2", [
        id,
        user.id,
      ]);
    else
      await query(
        "INSERT INTO saved_posts(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, user.id],
      );
    return { ok: true };
  }
  if (action === "vote") {
    const index = z.number().int().min(0).parse(body.option);
    invariant(
      post.poll && index < post.poll.options.length,
      "Choose a valid poll option.",
      400,
    );
    await query(
      "INSERT INTO poll_votes(post_id,user_id,option_index) VALUES($1,$2,$3) ON CONFLICT(post_id,user_id) DO UPDATE SET option_index=excluded.option_index",
      [id, user.id, index],
    );
    return { ok: true };
  }
  if (action === "report") {
    const reason = z.string().trim().min(5).max(1000).parse(body.reason);
    await query(
      "INSERT INTO reports(id,reporter_id,organization_id,resource_type,resource_id,reason) VALUES($1,$2,$3,'post',$4,$5)",
      [randomUUID(), user.id, post.organization_id, id, reason],
    );
    return { ok: true };
  }
  if (method === "DELETE") {
    if (post.author_id !== user.id) {
      invariant(post.organization_id);
      await requireMember(user.id, post.organization_id, [
        "owner",
        "admin",
        "moderator",
      ]);
    }
    await (
      await getDb()
    ).transaction(async (tx) => {
      await tx.query("DELETE FROM posts WHERE id=$1", [id]);
      await audit(tx, user.id, post.organization_id, "post.deleted", id);
    });
    return { ok: true };
  }
  if (method === "PATCH") {
    invariant(post.author_id === user.id);
    const content = z.string().trim().min(1).max(12000).parse(body.content);
    await query("UPDATE posts SET content=$1,edited_at=now() WHERE id=$2", [
      content,
      id,
    ]);
    return { ok: true };
  }
  invariant(false, "Unknown post action.", 404);
}
export async function comments(
  user: User,
  id: string,
  body?: Record<string, unknown>,
) {
  const post = await requirePost(user.id, id);
  if (body) {
    requireVerified(user);
    const input = z
      .object({
        content: z.string().trim().min(1).max(3000),
        parent_id: z.string().nullable().optional(),
      })
      .parse(body);
    if (input.parent_id)
      invariant(
        (
          await query("SELECT 1 FROM comments WHERE id=$1 AND post_id=$2", [
            input.parent_id,
            id,
          ])
        ).length,
      );
    const commentId = randomUUID();
    await query(
      "INSERT INTO comments(id,post_id,author_id,content,parent_id) VALUES($1,$2,$3,$4,$5)",
      [commentId, id, user.id, input.content, input.parent_id || null],
    );
    if (post.author_id !== user.id)
      await notify(
        post.author_id,
        "A new conversation on your post",
        `${user.name} commented on your post.`,
        `/app/post/${id}`,
        "comment",
      );
  }
  return {
    items: await query(
      "SELECT c.*,u.name author_name,u.avatar author_avatar FROM comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=$1 ORDER BY c.created_at LIMIT 100",
      [id],
    ),
  };
}
