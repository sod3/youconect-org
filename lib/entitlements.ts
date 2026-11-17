import { query } from "./db";
import { invariant } from "./errors";
export async function requireWorkspace(
  orgId: string,
  feature:
    "private_workspace" | "bridges" | "opportunities" = "private_workspace",
) {
  const [row] = await query(
    "SELECT o.verified,s.status,s.renews_at,p.* FROM organizations o JOIN subscriptions s ON s.organization_id=o.id JOIN plans p ON p.id=s.plan_id WHERE o.id=$1",
    [orgId],
  );
  invariant(
    row?.verified,
    "Your organization must be verified before using its private workspace.",
  );
  invariant(
    ["active", "trial"].includes(row.status) &&
      (!row.renews_at || new Date(row.renews_at) > new Date()),
    "Your organization needs an active subscription or trial.",
  );
  const allowed =
    feature === "opportunities"
      ? ["growth", "pro", "enterprise"].includes(row.id)
      : row[feature];
  invariant(
    allowed,
    "This feature is not included in your organization’s current plan.",
  );
  return row;
}
