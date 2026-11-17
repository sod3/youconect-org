import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query, getDb } from "./db";
import { invariant } from "./errors";
import {
  requireMember,
  PUBLISH_ROLES,
  canAccessBridge,
  postVisibility,
} from "./permissions";
import { requireVerified } from "./auth";
import { notify } from "./realtime";
import type { User, Event, Opportunity } from "./types";
import { requireWorkspace } from "./entitlements";
export const eventVisibility = `(e.visibility='public' OR (e.visibility='organization' AND EXISTS(SELECT 1 FROM memberships m WHERE m.organization_id=e.organization_id AND m.user_id=$1 AND m.status='active')) OR (e.visibility='bridge' AND EXISTS(SELECT 1 FROM bridges b JOIN bridge_members bm ON bm.bridge_id=b.id AND bm.user_id=$1 WHERE b.id=e.bridge_id AND b.status='active' AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=$1 AND m.status='active' AND m.organization_id IN(b.proposer_org_id,b.target_org_id)))))`;
export const opportunityVisibility = `(o.visibility='public' OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=$1 AND m.organization_id=o.organization_id AND m.status='active'))`;
export async function listEvents(
  userId: string,
  params = new URLSearchParams(),
) {
  const values: unknown[] = [userId];
  let filter = "";
  if (params.get("id")) {
    values.push(params.get("id"));
    filter += " AND e.id=$2";
  }
  if (params.get("organization")) {
    values.push(params.get("organization"));
    filter += ` AND e.organization_id=$${values.length}`;
  }
  return {
    items: await query<Event>(
      `SELECT e.*,COALESCE(o.name,u.name) organization_name,EXISTS(SELECT 1 FROM registrations r WHERE r.event_id=e.id AND r.user_id=$1) registered,(SELECT count(*)::int FROM registrations r WHERE r.event_id=e.id) attendee_count FROM events e LEFT JOIN organizations o ON o.id=e.organization_id JOIN users u ON u.id=e.host_id WHERE ${eventVisibility}${filter} ORDER BY e.starts_at LIMIT 100`,
      values,
    ),
  };
}
export async function createEvent(user: User, body: unknown) {
  requireVerified(user);
  const input = z
    .object({
      title: z.string().trim().min(3).max(150),
      description: z.string().trim().min(10).max(5000),
      organization_id: z.string().nullable().optional(),
      bridge_id: z.string().nullable().optional(),
      starts_at: z.iso.datetime(),
      ends_at: z.iso.datetime(),
      timezone: z.string().max(80).default("Asia/Karachi"),
      location: z.string().trim().min(1).max(200),
      category: z.string().max(40).default("Workshop"),
      capacity: z.number().int().min(1).max(100000).default(100),
      visibility: z
        .enum(["public", "organization", "bridge"])
        .default("public"),
    })
    .parse(body);
  invariant(
    new Date(input.starts_at) > new Date(),
    "Schedule your event in the future.",
    400,
  );
  invariant(
    new Date(input.ends_at) > new Date(input.starts_at),
    "The event must end after it starts.",
    400,
  );
  try {
    Intl.DateTimeFormat("en", { timeZone: input.timezone });
  } catch {
    invariant(false, "Choose a valid timezone.", 400);
  }
  if (input.organization_id)
    await requireMember(user.id, input.organization_id, PUBLISH_ROLES);
  if (input.visibility === "organization")
    invariant(input.organization_id, "Choose an organization.", 400);
  if (input.visibility === "bridge")
    invariant(
      input.bridge_id && (await canAccessBridge(user.id, input.bridge_id)),
    );
  const id = randomUUID();
  await query(
    "INSERT INTO events(id,title,description,organization_id,bridge_id,host_id,starts_at,ends_at,timezone,location,category,capacity,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
    [
      id,
      input.title,
      input.description,
      input.organization_id || null,
      input.bridge_id || null,
      user.id,
      input.starts_at,
      input.ends_at,
      input.timezone,
      input.location,
      input.category,
      input.capacity,
      input.visibility,
    ],
  );
  return { id };
}
export async function rsvp(user: User, id: string, cancel = false) {
  requireVerified(user);
  const event = (await listEvents(user.id, new URLSearchParams({ id })))
    .items[0];
  invariant(event, "This event is not available.", 404);
  if (cancel)
    await query("DELETE FROM registrations WHERE event_id=$1 AND user_id=$2", [
      id,
      user.id,
    ]);
  else
    await (
      await getDb()
    ).transaction(async (tx) => {
      const [row] = await tx.query(
        "SELECT * FROM events WHERE id=$1 FOR UPDATE",
        [id],
      );
      invariant(
        new Date(row.starts_at) > new Date(),
        "Registration for this event has closed.",
        400,
      );
      const [existing] = await tx.query(
        "SELECT 1 FROM registrations WHERE event_id=$1 AND user_id=$2",
        [id, user.id],
      );
      if (existing) return;
      const [count] = await tx.query(
        "SELECT count(*)::int total FROM registrations WHERE event_id=$1",
        [id],
      );
      invariant(count.total < row.capacity, "This event is at capacity.", 409);
      await tx.query(
        "INSERT INTO registrations(event_id,user_id) VALUES($1,$2)",
        [id, user.id],
      );
    });
  if (!cancel)
    await notify(
      user.id,
      "You’re on the list",
      `Your registration for ${event.title} is confirmed.`,
      `/app/events/${id}`,
      "event",
    );
  return { ok: true };
}
export async function listOpportunities(
  userId: string,
  params = new URLSearchParams(),
) {
  const values: unknown[] = [userId];
  let filter = "";
  if (params.get("id")) {
    values.push(params.get("id"));
    filter += " AND o.id=$2";
  }
  return {
    items: await query<Opportunity>(
      `SELECT o.*,COALESCE(org.name,u.name) organization_name,COALESCE(org.color,'blue') color,EXISTS(SELECT 1 FROM saved_opportunities s WHERE s.opportunity_id=o.id AND s.user_id=$1) saved,EXISTS(SELECT 1 FROM applications a WHERE a.opportunity_id=o.id AND a.user_id=$1) applied FROM opportunities o LEFT JOIN organizations org ON org.id=o.organization_id JOIN users u ON u.id=o.created_by WHERE ${opportunityVisibility}${filter} ORDER BY o.deadline LIMIT 100`,
      values,
    ),
  };
}
export async function createOpportunity(user: User, body: unknown) {
  requireVerified(user);
  const input = z
    .object({
      title: z.string().trim().min(3).max(150),
      description: z.string().trim().min(10).max(6000),
      organization_id: z.string().nullable().optional(),
      category: z.string().min(1).max(60),
      location: z.string().min(1).max(150),
      deadline: z.iso.datetime(),
      compensation: z.string().max(100).default(""),
      eligibility: z.string().max(1000).default(""),
      visibility: z.enum(["public", "organization"]).default("public"),
    })
    .parse(body);
  if (input.organization_id)
    await requireMember(user.id, input.organization_id, PUBLISH_ROLES);
  invariant(
    input.visibility !== "organization" || input.organization_id,
    "Choose an organization.",
    400,
  );
  invariant(
    new Date(input.deadline) > new Date(),
    "Choose a future deadline.",
    400,
  );
  const id = randomUUID();
  await query(
    "INSERT INTO opportunities(id,title,description,organization_id,created_by,category,location,deadline,compensation,eligibility,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      id,
      input.title,
      input.description,
      input.organization_id || null,
      user.id,
      input.category,
      input.location,
      input.deadline,
      input.compensation,
      input.eligibility,
      input.visibility,
    ],
  );
  return { id };
}
export async function opportunityAction(
  user: User,
  id: string,
  action: string,
  body: Record<string, unknown>,
) {
  const opportunity = (
    await listOpportunities(user.id, new URLSearchParams({ id }))
  ).items[0];
  invariant(opportunity, "This opportunity is not available.", 404);
  if (action === "save") {
    if (body.active === false)
      await query(
        "DELETE FROM saved_opportunities WHERE opportunity_id=$1 AND user_id=$2",
        [id, user.id],
      );
    else
      await query(
        "INSERT INTO saved_opportunities(opportunity_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, user.id],
      );
    return { ok: true };
  }
  if (action === "apply") {
    requireVerified(user);
    invariant(
      new Date(opportunity.deadline) > new Date(),
      "Applications have closed.",
      400,
    );
    const note = z
      .string()
      .trim()
      .min(20, "Write at least 20 characters for your introduction.")
      .max(4000)
      .parse(body.note);
    await query(
      "INSERT INTO applications(id,opportunity_id,user_id,note) VALUES($1,$2,$3,$4) ON CONFLICT(opportunity_id,user_id) DO NOTHING",
      [randomUUID(), id, user.id, note],
    );
    return { ok: true };
  }
  invariant(false, "Unknown opportunity action.", 404);
}
export async function search(userId: string, q: string) {
  const term = `%${q.trim().slice(0, 120)}%`;
  if (q.trim().length < 2) return { groups: [] };
  const [
    people,
    organizations,
    communities,
    posts,
    events,
    opportunities,
    messages,
  ] = await Promise.all([
    query(
      `SELECT u.id,u.name,u.headline,u.avatar FROM users u WHERE (u.name ILIKE $2 OR u.headline ILIKE $2) AND (u.privacy->>'profile'='public' OR u.id=$1 OR EXISTS(SELECT 1 FROM memberships a JOIN memberships b ON a.organization_id=b.organization_id WHERE a.user_id=$1 AND b.user_id=u.id AND a.status='active' AND b.status='active')) AND NOT EXISTS(SELECT 1 FROM blocks bl WHERE (bl.blocker_id=$1 AND bl.blocked_id=u.id) OR (bl.blocked_id=$1 AND bl.blocker_id=u.id)) LIMIT 8`,
      [userId, term],
    ),
    query(
      "SELECT id,name,type FROM organizations WHERE name ILIKE $1 AND verification_status='approved' LIMIT 8",
      [term],
    ),
    query(
      `SELECT c.id,c.name,c.category FROM communities c WHERE c.name ILIKE $2 AND (c.visibility='public' OR (c.visibility='organization' AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=$1 AND m.organization_id=c.organization_id AND m.status='active')) OR (EXISTS(SELECT 1 FROM community_members cm WHERE cm.user_id=$1 AND cm.community_id=c.id) AND (c.organization_id IS NULL OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=$1 AND m.organization_id=c.organization_id AND m.status='active')))) LIMIT 8`,
      [userId, term],
    ),
    query(
      `SELECT p.id,left(p.content,120) name FROM posts p WHERE p.content ILIKE $2 AND ${postVisibility()} LIMIT 8`,
      [userId, term],
    ),
    query(
      `SELECT e.id,e.title name,e.category FROM events e WHERE e.title ILIKE $2 AND ${eventVisibility} LIMIT 8`,
      [userId, term],
    ),
    query(
      `SELECT o.id,o.title name,o.category FROM opportunities o WHERE o.title ILIKE $2 AND ${opportunityVisibility} LIMIT 8`,
      [userId, term],
    ),
    query(
      `SELECT m.id,m.conversation_id,left(m.content,100) name FROM messages m JOIN conversation_participants cp ON cp.conversation_id=m.conversation_id AND cp.user_id=$1 JOIN conversations c ON c.id=m.conversation_id WHERE m.content ILIKE $2 AND NOT m.deleted AND (c.organization_id IS NULL OR EXISTS(SELECT 1 FROM memberships mm WHERE mm.organization_id=c.organization_id AND mm.user_id=$1 AND mm.status='active')) AND (c.community_id IS NULL OR EXISTS(SELECT 1 FROM community_members cm WHERE cm.community_id=c.community_id AND cm.user_id=$1)) AND (c.bridge_id IS NULL OR EXISTS(SELECT 1 FROM bridges b JOIN bridge_members bm ON bm.bridge_id=b.id AND bm.user_id=$1 WHERE b.id=c.bridge_id AND b.status='active' AND EXISTS(SELECT 1 FROM memberships mm WHERE mm.user_id=$1 AND mm.organization_id IN(b.proposer_org_id,b.target_org_id) AND mm.status='active'))) LIMIT 8`,
      [userId, term],
    ),
  ]);
  return {
    groups: [
      {
        title: "People",
        items: people.map((p) => ({ ...p, href: `/app/profile/${p.id}` })),
      },
      {
        title: "Organizations",
        items: organizations.map((p) => ({
          ...p,
          href: `/app/organizations/${p.id}`,
        })),
      },
      {
        title: "Communities",
        items: communities.map((p) => ({
          ...p,
          href: `/app/communities/${p.id}`,
        })),
      },
      {
        title: "Posts",
        items: posts.map((p) => ({ ...p, href: `/app/post/${p.id}` })),
      },
      {
        title: "Events",
        items: events.map((p) => ({ ...p, href: `/app/events/${p.id}` })),
      },
      {
        title: "Opportunities",
        items: opportunities.map((p) => ({
          ...p,
          href: `/app/opportunities/${p.id}`,
        })),
      },
      {
        title: "Messages",
        items: messages.map((p) => ({
          ...p,
          href: `/app/messages/${p.conversation_id}`,
        })),
      },
    ].filter((g) => g.items.length),
  };
}
