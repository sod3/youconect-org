import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, query } from "./db";
import { invariant, AppError } from "./errors";
import { requireVerified, audit } from "./auth";
import { requireMember, ADMIN_ROLES, canAccessBridge } from "./permissions";
import { notify } from "./realtime";
import type { User, Organization, Community, Bridge } from "./types";
import { requireWorkspace } from "./entitlements";
export async function listOrganizations(userId: string, onlyMine = false) {
  return {
    items: await query<Organization>(
      `SELECT o.*,m.role,m.status membership_status,(SELECT count(*)::int FROM memberships a WHERE a.organization_id=o.id AND a.status='active') member_count FROM organizations o LEFT JOIN memberships m ON m.organization_id=o.id AND m.user_id=$1 ${onlyMine ? "WHERE m.status='active'" : "WHERE o.verification_status='approved' OR m.user_id=$1"} ORDER BY o.created_at,o.name`,
      [userId],
    ),
  };
}
export async function organizationDetail(userId: string, id: string) {
  const [org] = await query(
    `SELECT o.*,m.role,m.status membership_status,(SELECT count(*)::int FROM memberships a WHERE a.organization_id=o.id AND a.status='active') member_count FROM organizations o LEFT JOIN memberships m ON m.organization_id=o.id AND m.user_id=$1 WHERE (o.id=$2 OR o.slug=$2) AND (o.verification_status='approved' OR m.user_id=$1)`,
    [userId, id],
  );
  invariant(org, "Organization not found.", 404);
  return {
    organization: org,
    departments:
      org.membership_status === "active"
        ? await query("SELECT * FROM departments WHERE organization_id=$1", [
            org.id,
          ])
        : [],
    channels:
      org.membership_status === "active"
        ? await query(
            `SELECT c.id,c.name,c.description,c.announcements_only,EXISTS(SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id=c.id AND cp.user_id=$2) joined FROM conversations c WHERE c.organization_id=$1 AND c.kind='channel' AND (c.visibility='organization' OR EXISTS(SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id=c.id AND cp.user_id=$2))`,
            [org.id, userId],
          )
        : [],
  };
}
export async function createOrganization(user: User, body: unknown) {
  requireVerified(user);
  const input = z
    .object({
      name: z.string().trim().min(3).max(100),
      type: z.string().min(1).max(50),
      description: z.string().trim().min(20).max(2000),
      location: z.string().trim().max(100),
      website: z
        .string()
        .max(300)
        .refine((s) => !s || /^https:\/\//.test(s), "Use an HTTPS website URL.")
        .default(""),
    })
    .parse(body);
  const id = randomUUID(),
    slug =
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 70) +
      "-" +
      id.slice(0, 6);
  await (
    await getDb()
  ).transaction(async (tx) => {
    await tx.query(
      "INSERT INTO organizations(id,slug,name,type,description,location,website,initials,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        slug,
        input.name,
        input.type,
        input.description,
        input.location,
        input.website,
        input.name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
        user.id,
      ],
    );
    await tx.query(
      "INSERT INTO memberships(organization_id,user_id,role,status) VALUES($1,$2,'owner','active')",
      [id, user.id],
    );
    await tx.query(
      "INSERT INTO subscriptions(organization_id,plan_id) VALUES($1,'listing')",
      [id],
    );
    await audit(tx, user.id, id, "organization.requested", id);
  });
  return { id, slug };
}
export async function requestMembership(user: User, id: string) {
  requireVerified(user);
  const [org] = await query(
    "SELECT id,verified FROM organizations WHERE id=$1 AND verification_status='approved'",
    [id],
  );
  invariant(org, "This organization is not accepting requests.", 404);
  const [plan] = await query(
    "SELECT p.*,s.status FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1",
    [id],
  );
  invariant(
    plan?.private_workspace,
    "This organization has a public listing. Private memberships are not enabled.",
    400,
  );
  const existing = await query(
    "SELECT status FROM memberships WHERE user_id=$1 AND organization_id=$2",
    [user.id, id],
  );
  invariant(
    !existing.length || existing[0].status === "rejected",
    "You already have a membership or pending request.",
    409,
  );
  await query(
    "INSERT INTO memberships(organization_id,user_id,status) VALUES($1,$2,'pending') ON CONFLICT(organization_id,user_id) DO UPDATE SET status='pending'",
    [id, user.id],
  );
  for (const admin of await query(
    "SELECT user_id FROM memberships WHERE organization_id=$1 AND role IN('owner','admin') AND status='active'",
    [id],
  ))
    await notify(
      admin.user_id,
      "A new membership request",
      `${user.name} would like to join your organization.`,
      `/app/admin/${id}`,
      "membership",
    );
  return { ok: true };
}
export async function listCommunities(userId: string) {
  return {
    items: await query<Community>(
      `SELECT c.*,o.name organization_name,(SELECT count(*)::int FROM community_members a WHERE a.community_id=c.id) member_count,EXISTS(SELECT 1 FROM community_members cm WHERE cm.community_id=c.id AND cm.user_id=$1) joined FROM communities c LEFT JOIN organizations o ON o.id=c.organization_id WHERE c.visibility='public' OR (c.visibility='organization' AND EXISTS(SELECT 1 FROM memberships m WHERE m.organization_id=c.organization_id AND m.user_id=$1 AND m.status='active')) OR (c.visibility='private' AND EXISTS(SELECT 1 FROM community_members cm WHERE cm.community_id=c.id AND cm.user_id=$1) AND (c.organization_id IS NULL OR EXISTS(SELECT 1 FROM memberships m WHERE m.organization_id=c.organization_id AND m.user_id=$1 AND m.status='active'))) ORDER BY c.name`,
      [userId],
    ),
  };
}
export async function joinCommunity(user: User, id: string, leave = false) {
  requireVerified(user);
  const [community] = await query("SELECT * FROM communities WHERE id=$1", [
    id,
  ]);
  invariant(community);
  if (community.organization_id)
    await requireMember(user.id, community.organization_id);
  if (leave) {
    invariant(
      community.owner_id !== user.id,
      "Transfer community ownership before leaving.",
      400,
    );
    await query(
      "DELETE FROM community_members WHERE community_id=$1 AND user_id=$2",
      [id, user.id],
    );
  } else {
    invariant(
      community.visibility !== "private",
      "This community is invitation only.",
    );
    await query(
      "INSERT INTO community_members(community_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [id, user.id],
    );
  }
  return { ok: true };
}
export async function createCommunity(user: User, body: unknown) {
  requireVerified(user);
  const input = z
    .object({
      name: z.string().trim().min(3).max(100),
      description: z.string().trim().min(10).max(2000),
      category: z.string().max(50).default("General"),
      organization_id: z.string().nullable().optional(),
      visibility: z
        .enum(["public", "organization", "private"])
        .default("public"),
    })
    .parse(body);
  if (input.organization_id)
    await requireMember(user.id, input.organization_id, ADMIN_ROLES);
  invariant(
    input.visibility !== "organization" || input.organization_id,
    "Choose an organization.",
    400,
  );
  const id = randomUUID();
  await (
    await getDb()
  ).transaction(async (tx) => {
    await tx.query(
      "INSERT INTO communities(id,name,description,category,organization_id,visibility,owner_id,color) VALUES($1,$2,$3,$4,$5,$6,$7,'teal')",
      [
        id,
        input.name,
        input.description,
        input.category,
        input.organization_id || null,
        input.visibility,
        user.id,
      ],
    );
    await tx.query(
      "INSERT INTO community_members(community_id,user_id,role) VALUES($1,$2,'owner')",
      [id, user.id],
    );
  });
  return { id };
}
export async function listBridges(userId: string) {
  return {
    items: await query<Bridge>(
      `SELECT b.*,a.name proposer_name,z.name target_name,EXISTS(SELECT 1 FROM bridge_members bm WHERE bm.bridge_id=b.id AND bm.user_id=$1) joined,(SELECT count(*)::int FROM bridge_members bm WHERE bm.bridge_id=b.id) member_count FROM bridges b JOIN organizations a ON a.id=b.proposer_org_id JOIN organizations z ON z.id=b.target_org_id WHERE EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=$1 AND m.status='active' AND m.organization_id IN(b.proposer_org_id,b.target_org_id) AND (m.role IN('owner','admin') OR EXISTS(SELECT 1 FROM bridge_members bm WHERE bm.bridge_id=b.id AND bm.user_id=$1))) ORDER BY b.created_at DESC`,
      [userId],
    ),
  };
}
export async function createBridge(user: User, body: unknown) {
  requireVerified(user);
  const input = z
    .object({
      name: z.string().trim().min(3).max(100),
      description: z.string().trim().min(10).max(2000),
      proposer_org_id: z.string(),
      target_org_id: z.string(),
    })
    .parse(body);
  invariant(
    input.proposer_org_id !== input.target_org_id,
    "Select two different organizations.",
    400,
  );
  await requireMember(user.id, input.proposer_org_id, ADMIN_ROLES);
  const orgs = await query(
    "SELECT id FROM organizations WHERE id IN($1,$2) AND verified=true",
    [input.proposer_org_id, input.target_org_id],
  );
  invariant(
    orgs.length === 2,
    "Both organizations must be verified before creating a Bridge.",
    400,
  );
  await requireWorkspace(input.proposer_org_id, "bridges");
  const [plan] = await query(
    "SELECT p.bridges FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1 AND s.status IN('active','trial')",
    [input.proposer_org_id],
  );
  invariant(plan?.bridges, "Your plan does not include Bridges.", 403);
  const id = randomUUID();
  await (
    await getDb()
  ).transaction(async (tx) => {
    await tx.query(
      "INSERT INTO bridges(id,name,description,proposer_org_id,target_org_id,created_by) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        input.name,
        input.description,
        input.proposer_org_id,
        input.target_org_id,
        user.id,
      ],
    );
    await audit(tx, user.id, input.proposer_org_id, "bridge.proposed", id);
  });
  return { id };
}
export async function bridgeAction(
  user: User,
  id: string,
  action: string,
  body: Record<string, unknown>,
) {
  const [bridge] = await query("SELECT * FROM bridges WHERE id=$1", [id]);
  invariant(bridge);
  if (action === "approve" || action === "reject") {
    await requireMember(user.id, bridge.target_org_id, ADMIN_ROLES);
    invariant(
      bridge.created_by !== user.id,
      "A different authorized administrator must approve the receiving organization’s participation.",
    );
    invariant(
      bridge.status === "pending",
      "This Bridge has already been reviewed.",
      409,
    );
    await requireWorkspace(bridge.target_org_id, "bridges");
    const [plan] = await query(
      "SELECT p.bridges FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1 AND s.status IN('active','trial')",
      [bridge.target_org_id],
    );
    invariant(
      plan?.bridges,
      "The receiving organization’s plan does not include Bridges.",
    );
    await (
      await getDb()
    ).transaction(async (tx) => {
      const [row] = await tx.query(
        "UPDATE bridges SET status=$1,approved_by=$2,approved_at=now() WHERE id=$3 AND status='pending' RETURNING id",
        [action === "approve" ? "active" : "rejected", user.id, id],
      );
      invariant(row, "The Bridge has already been reviewed.", 409);
      await audit(tx, user.id, bridge.target_org_id, `bridge.${action}d`, id);
    });
    return { ok: true };
  }
  if (action === "close") {
    const member = await query(
      "SELECT 1 FROM memberships WHERE user_id=$1 AND organization_id IN($2,$3) AND status='active' AND role IN('owner','admin')",
      [user.id, bridge.proposer_org_id, bridge.target_org_id],
    );
    invariant(member.length);
    await (
      await getDb()
    ).transaction(async (tx) => {
      await tx.query("UPDATE bridges SET status='closed' WHERE id=$1", [id]);
      await audit(tx, user.id, null, "bridge.closed", id);
    });
    return { ok: true };
  }
  if (action === "members") {
    const target = z.string().parse(body.user_id);
    const [m] = await query(
      "SELECT organization_id FROM memberships WHERE user_id=$1 AND organization_id IN($2,$3) AND status='active' LIMIT 1",
      [target, bridge.proposer_org_id, bridge.target_org_id],
    );
    invariant(
      m,
      "The person must have an active membership at a participating organization.",
      400,
    );
    await requireMember(user.id, m.organization_id, ADMIN_ROLES);
    invariant(
      bridge.status === "active",
      "Approve this Bridge before adding members.",
      400,
    );
    if (body.remove === true)
      await query(
        "DELETE FROM bridge_members WHERE bridge_id=$1 AND user_id=$2",
        [id, target],
      );
    else
      await query(
        "INSERT INTO bridge_members(bridge_id,user_id,added_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [id, target, user.id],
      );
    await audit(
      await getDb(),
      user.id,
      m.organization_id,
      body.remove ? "bridge.member_removed" : "bridge.member_added",
      id,
      { userId: target },
    );
    return { ok: true };
  }
  throw new AppError(404, "This Bridge action does not exist.");
}
