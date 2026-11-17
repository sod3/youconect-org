import { query, type SqlConnection } from "./db";
import { invariant } from "./errors";
export const ADMIN_ROLES = ["owner", "admin"];
export const PUBLISH_ROLES = [
  "owner",
  "admin",
  "department_admin",
  "staff",
  "society_admin",
];
export async function membership(
  userId: string,
  orgId: string,
  tx?: SqlConnection,
) {
  const [row] = await (tx?.query.bind(tx) || query)(
    "SELECT * FROM memberships WHERE user_id=$1 AND organization_id=$2 AND status='active'",
    [userId, orgId],
  );
  return row;
}
export async function requireMember(
  userId: string,
  orgId: string,
  roles?: string[],
  tx?: SqlConnection,
) {
  const row = await membership(userId, orgId, tx);
  invariant(row && (!roles || roles.includes(row.role)));
  return row;
}
export async function canAccessBridge(
  userId: string,
  bridgeId: string,
  tx?: SqlConnection,
) {
  const rows = await (tx?.query.bind(tx) || query)(
    `SELECT b.id FROM bridges b JOIN bridge_members bm ON bm.bridge_id=b.id AND bm.user_id=$1 WHERE b.id=$2 AND b.status='active' AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=$1 AND m.status='active' AND m.organization_id IN (b.proposer_org_id,b.target_org_id))`,
    [userId, bridgeId],
  );
  return rows.length > 0;
}
export async function requireConversation(userId: string, id: string) {
  const [conversation] = await query(
    `SELECT c.*,cp.role AS participant_role FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id AND cp.user_id=$1 WHERE c.id=$2`,
    [userId, id],
  );
  invariant(conversation);
  if (conversation.organization_id)
    await requireMember(userId, conversation.organization_id);
  if (conversation.bridge_id)
    invariant(await canAccessBridge(userId, conversation.bridge_id));
  if (conversation.community_id)
    invariant(
      (
        await query(
          "SELECT 1 FROM community_members WHERE user_id=$1 AND community_id=$2",
          [userId, conversation.community_id],
        )
      ).length,
    );
  return conversation;
}
// One predicate reused by feeds, detail routes, comments, reactions, search and downloads.
export function postVisibility(alias = "p", userParam = "$1") {
  const p = alias,
    u = userParam;
  return `(
 (${p}.audience='public' AND (${p}.community_id IS NULL OR EXISTS(SELECT 1 FROM communities vc WHERE vc.id=${p}.community_id AND vc.visibility='public')))
 OR (${p}.audience='organization' AND EXISTS(SELECT 1 FROM memberships vm WHERE vm.organization_id=${p}.organization_id AND vm.user_id=${u} AND vm.status='active'))
 OR (${p}.audience='community' AND EXISTS(SELECT 1 FROM community_members vcm JOIN communities vc ON vc.id=vcm.community_id WHERE vcm.community_id=${p}.community_id AND vcm.user_id=${u} AND (vc.organization_id IS NULL OR EXISTS(SELECT 1 FROM memberships vm WHERE vm.organization_id=vc.organization_id AND vm.user_id=${u} AND vm.status='active'))))
 OR (${p}.audience='bridge' AND EXISTS(SELECT 1 FROM bridges vb JOIN bridge_members vbm ON vbm.bridge_id=vb.id AND vbm.user_id=${u} WHERE vb.id=${p}.bridge_id AND vb.status='active' AND EXISTS(SELECT 1 FROM memberships vm WHERE vm.user_id=${u} AND vm.status='active' AND vm.organization_id IN(vb.proposer_org_id,vb.target_org_id))))
 ) AND NOT EXISTS(SELECT 1 FROM blocks vbl WHERE (vbl.blocker_id=${u} AND vbl.blocked_id=${p}.author_id) OR (vbl.blocked_id=${u} AND vbl.blocker_id=${p}.author_id))`;
}
export async function requirePost(userId: string, id: string) {
  const [post] = await query(
    `SELECT p.* FROM posts p WHERE p.id=$2 AND ${postVisibility()}`,
    [userId, id],
  );
  invariant(post);
  return post;
}
