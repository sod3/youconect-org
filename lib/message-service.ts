import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, query } from "./db";
import { invariant, AppError } from "./errors";
import {
  requireConversation,
  requireMember,
  ADMIN_ROLES,
  canAccessBridge,
} from "./permissions";
import { requireVerified, requireAdminMfa } from "./auth";
import { emitToUser } from "./realtime";
import type { User, Message, Conversation } from "./types";
import { requireWorkspace } from "./entitlements";

export async function listConversations(userId: string) {
  const rows = await query<Conversation>(
    `SELECT c.*,cp.muted,cp.pinned,COALESCE(o.name,'') organization_name,
 CASE WHEN c.kind='direct' THEN (SELECT u.name FROM conversation_participants other JOIN users u ON u.id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>$1 LIMIT 1) ELSE c.name END name,
 CASE WHEN c.kind='direct' THEN (SELECT u.avatar FROM conversation_participants other JOIN users u ON u.id=other.user_id WHERE other.conversation_id=c.id AND other.user_id<>$1 LIMIT 1) ELSE 'blue' END avatar,
 (SELECT content FROM messages m WHERE m.conversation_id=c.id AND NOT m.deleted ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_message,
 COALESCE((SELECT max(created_at) FROM messages m WHERE m.conversation_id=c.id),c.created_at) last_at,
 (SELECT count(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1 AND m.created_at>cp.last_read_at) unread,
 (SELECT count(*)::int FROM conversation_participants allp WHERE allp.conversation_id=c.id) participant_count
 FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id AND cp.user_id=$1 LEFT JOIN organizations o ON o.id=c.organization_id
 ORDER BY cp.pinned DESC,last_at DESC`,
    [userId],
  );
  const allowed: Conversation[] = [];
  for (const row of rows) {
    try {
      await requireConversation(userId, row.id);
      allowed.push(row);
    } catch {
      /* Revoked memberships disappear from the unified inbox. */
    }
  }
  return { items: allowed };
}
export async function conversationDetail(
  userId: string,
  id: string,
  params: URLSearchParams,
) {
  const conversation = await requireConversation(userId, id);
  const values: unknown[] = [id];
  let cursor = "";
  if (params.get("before")) {
    const [timestamp, messageId] = params.get("before")!.split("|");
    z.iso.datetime().parse(timestamp);
    values.push(timestamp, messageId);
    cursor = " AND (m.created_at,m.id)<($2::timestamptz,$3)";
  }
  const search = params.get("q")?.slice(0, 120);
  if (search) {
    values.push(`%${search}%`);
    cursor += ` AND m.content ILIKE $${values.length}`;
  }
  const rows = await query<Message>(
    `SELECT m.*,u.name sender_name,u.avatar sender_avatar,
 COALESCE((SELECT json_agg(r) FROM(SELECT emoji,count(*)::int count FROM message_reactions mr WHERE mr.message_id=m.id GROUP BY emoji) r),'[]') reactions
 FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=$1 ${cursor} ORDER BY m.created_at DESC,m.id DESC LIMIT 41`,
    values,
  );
  const more = rows.length > 40;
  const items = rows.slice(0, 40).reverse();
  const first = items[0];
  const participants = await query(
    "SELECT u.id,u.name,u.avatar,cp.role,cp.last_read_at,u.privacy FROM conversation_participants cp JOIN users u ON u.id=cp.user_id WHERE cp.conversation_id=$1",
    [id],
  );
  return {
    conversation,
    items,
    participants: participants.map(({ privacy, ...p }) => ({
      ...p,
      presenceVisible: privacy?.presence !== false,
    })),
    nextCursor: more && first ? `${first.created_at}|${first.id}` : null,
  };
}
const messageSchema = z
  .object({
    conversation_id: z.string().min(1),
    client_id: z.string().uuid(),
    content: z.string().trim().max(6000),
    reply_to: z.string().nullable().optional(),
    attachment_id: z.string().nullable().optional(),
  })
  .refine(
    (x) => x.content.length > 0 || x.attachment_id,
    "Write a message or attach a file.",
  );
export async function sendMessage(user: User, body: unknown): Promise<Message> {
  requireVerified(user);
  const input = messageSchema.parse(body);
  const conversation = await requireConversation(
    user.id,
    input.conversation_id,
  );
  if (conversation.organization_id)
    await requireWorkspace(conversation.organization_id);
  if (conversation.announcements_only) requireAdminMfa(user);
  if (
    conversation.announcements_only &&
    conversation.participant_role !== "admin"
  ) {
    invariant(conversation.organization_id);
    await requireMember(user.id, conversation.organization_id, ADMIN_ROLES);
  }
  const [blocked] = await query(
    `SELECT 1 FROM blocks b JOIN conversation_participants cp ON cp.conversation_id=$1 AND cp.user_id<>$2 WHERE (b.blocker_id=$2 AND b.blocked_id=cp.user_id) OR (b.blocked_id=$2 AND b.blocker_id=cp.user_id) LIMIT 1`,
    [input.conversation_id, user.id],
  );
  invariant(!blocked, "Messaging is unavailable for this conversation.");
  if (input.reply_to)
    invariant(
      (
        await query(
          "SELECT 1 FROM messages WHERE id=$1 AND conversation_id=$2",
          [input.reply_to, input.conversation_id],
        )
      ).length,
      "Reply to a message in this conversation.",
      400,
    );
  if (input.attachment_id)
    invariant(
      (
        await query("SELECT 1 FROM uploads WHERE id=$1 AND owner_id=$2", [
          input.attachment_id,
          user.id,
        ])
      ).length,
    );
  const id = randomUUID();
  const [inserted] = await query(
    `INSERT INTO messages(id,client_id,conversation_id,sender_id,content,reply_to,attachment_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(sender_id,client_id) DO NOTHING RETURNING *`,
    [
      id,
      input.client_id,
      input.conversation_id,
      user.id,
      input.content,
      input.reply_to || null,
      input.attachment_id || null,
    ],
  );
  const row =
    inserted ||
    (
      await query(
        "SELECT * FROM messages WHERE sender_id=$1 AND client_id=$2",
        [user.id, input.client_id],
      )
    )[0];
  invariant(
    row.conversation_id === input.conversation_id &&
      row.content === input.content,
    "This message ID has already been used for a different message.",
    409,
  );
  const message = {
    ...row,
    sender_name: user.name,
    sender_avatar: user.avatar,
    status: "sent",
  } as Message;
  if (inserted) {
    const participants = await query(
      "SELECT user_id FROM conversation_participants WHERE conversation_id=$1",
      [input.conversation_id],
    );
    for (const person of participants) {
      try {
        await requireConversation(person.user_id, input.conversation_id);
        emitToUser(person.user_id, "message", message);
      } catch {
        /* Do not emit private data to revoked members. */
      }
    }
  }
  return message;
}
export async function createConversation(user: User, body: unknown) {
  requireVerified(user);
  const input = z
    .object({
      kind: z.enum(["direct", "group", "channel"]),
      name: z.string().trim().max(100).default(""),
      participants: z.array(z.string()).max(50).default([]),
      organization_id: z.string().nullable().optional(),
      bridge_id: z.string().nullable().optional(),
      announcements_only: z.boolean().default(false),
    })
    .parse(body);
  const people = [...new Set([user.id, ...input.participants])];
  if (input.organization_id) await requireWorkspace(input.organization_id);
  if (input.kind === "direct")
    invariant(people.length === 2, "Choose one person to message.", 400);
  else invariant(input.name.length > 0, "Give your conversation a name.", 400);
  if (input.kind === "channel") {
    invariant(
      input.organization_id || input.bridge_id,
      "Choose an organization or Bridge.",
      400,
    );
    if (input.organization_id)
      await requireMember(user.id, input.organization_id, ADMIN_ROLES);
    if (input.bridge_id)
      invariant(await canAccessBridge(user.id, input.bridge_id));
  }
  for (const person of people) {
    const [target] = await query(
      "SELECT id,privacy,email_verified FROM users WHERE id=$1",
      [person],
    );
    invariant(
      target && target.email_verified,
      "This person is not available for messages.",
      400,
    );
    const blocked = await query(
      "SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)",
      [user.id, person],
    );
    invariant(!blocked.length, "Messaging is unavailable for this person.");
    if (input.organization_id)
      await requireMember(person, input.organization_id);
    if (input.bridge_id)
      invariant(await canAccessBridge(person, input.bridge_id));
    if (person !== user.id)
      invariant(
        target.privacy?.dmRequests !== false,
        "This person is not accepting new conversations.",
      );
  }
  const directKey = input.kind === "direct" ? people.sort().join(":") : null;
  if (directKey) {
    const [existing] = await query(
      "SELECT id FROM conversations WHERE direct_key=$1",
      [directKey],
    );
    if (existing) return existing;
  }
  const id = randomUUID();
  try {
    await (
      await getDb()
    ).transaction(async (tx) => {
      await tx.query(
        "INSERT INTO conversations(id,name,kind,organization_id,bridge_id,created_by,direct_key,announcements_only,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          id,
          input.name,
          input.kind,
          input.organization_id || null,
          input.bridge_id || null,
          user.id,
          directKey,
          input.announcements_only,
          input.kind === "channel" ? "organization" : "private",
        ],
      );
      for (const person of people)
        await tx.query(
          "INSERT INTO conversation_participants(conversation_id,user_id,role) VALUES($1,$2,$3)",
          [id, person, person === user.id ? "admin" : "member"],
        );
    });
  } catch (error) {
    if (directKey && (error as { code?: string }).code === "23505")
      return (
        await query("SELECT id FROM conversations WHERE direct_key=$1", [
          directKey,
        ])
      )[0];
    throw error;
  }
  return { id };
}
export async function conversationAction(
  user: User,
  id: string,
  action: string,
  body: Record<string, unknown>,
) {
  const conversation = await requireConversation(user.id, id);
  if (action === "read") {
    await query(
      "UPDATE conversation_participants SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2",
      [id, user.id],
    );
    const recipients = await query(
      "SELECT user_id FROM conversation_participants WHERE conversation_id=$1",
      [id],
    );
    for (const r of recipients)
      emitToUser(r.user_id, "read", {
        conversation_id: id,
        user_id: user.id,
        at: new Date().toISOString(),
      });
    return { ok: true };
  }
  if (action === "preferences") {
    const input = z
      .object({ muted: z.boolean().optional(), pinned: z.boolean().optional() })
      .parse(body);
    if (input.muted !== undefined)
      await query(
        "UPDATE conversation_participants SET muted=$1 WHERE conversation_id=$2 AND user_id=$3",
        [input.muted, id, user.id],
      );
    if (input.pinned !== undefined)
      await query(
        "UPDATE conversation_participants SET pinned=$1 WHERE conversation_id=$2 AND user_id=$3",
        [input.pinned, id, user.id],
      );
    return { ok: true };
  }
  if (action === "participants") {
    invariant(conversation.participant_role === "admin");
    invariant(conversation.kind !== "direct");
    const target = z.string().parse(body.user_id);
    if (conversation.organization_id)
      await requireMember(target, conversation.organization_id);
    if (conversation.bridge_id)
      invariant(await canAccessBridge(target, conversation.bridge_id));
    await query(
      "INSERT INTO conversation_participants(conversation_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [id, target],
    );
    return { ok: true };
  }
  if (action === "report") {
    const reason = z.string().trim().min(5).max(1000).parse(body.reason);
    await query(
      "INSERT INTO reports(id,reporter_id,organization_id,resource_type,resource_id,reason) VALUES($1,$2,$3,'conversation',$4,$5)",
      [randomUUID(), user.id, conversation.organization_id, id, reason],
    );
    return { ok: true };
  }
  throw new AppError(404, "This conversation action does not exist.");
}
export async function messageAction(
  user: User,
  id: string,
  body: Record<string, unknown>,
  method: string,
) {
  const [message] = await query("SELECT * FROM messages WHERE id=$1", [id]);
  invariant(message);
  await requireConversation(user.id, message.conversation_id);
  if (body.emoji) {
    const emoji = z.enum(["❤️", "👍", "✨", "😂", "🎉"]).parse(body.emoji);
    await query(
      "INSERT INTO message_reactions(message_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT(message_id,user_id) DO UPDATE SET emoji=excluded.emoji",
      [id, user.id, emoji],
    );
  } else {
    invariant(message.sender_id === user.id);
    if (method === "DELETE")
      await query(
        "UPDATE messages SET content='Message deleted',attachment_id=NULL,deleted=true,edited_at=now() WHERE id=$1",
        [id],
      );
    else
      await query(
        "UPDATE messages SET content=$1,edited_at=now() WHERE id=$2",
        [z.string().trim().min(1).max(6000).parse(body.content), id],
      );
  }
  const participants = await query(
    "SELECT user_id FROM conversation_participants WHERE conversation_id=$1",
    [message.conversation_id],
  );
  for (const p of participants)
    emitToUser(p.user_id, "message-updated", {
      conversation_id: message.conversation_id,
      id,
    });
  return { ok: true };
}
