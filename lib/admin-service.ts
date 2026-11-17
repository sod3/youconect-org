import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb, query } from "./db";
import { audit, requireAdminMfa } from "./auth";
import { requireMember, ADMIN_ROLES } from "./permissions";
import { invariant } from "./errors";
import { notify } from "./realtime";
import type { User } from "./types";
export async function adminOverview(user: User, orgId: string) {
  requireAdminMfa(user);
  await requireMember(user.id, orgId, ADMIN_ROLES);
  const [
    members,
    reports,
    logs,
    subscription,
    invoices,
    registrations,
    applications,
  ] = await Promise.all([
    query(
      "SELECT m.*,u.name,u.email,u.avatar,u.headline FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 ORDER BY m.joined_at DESC LIMIT 250",
      [orgId],
    ),
    query(
      "SELECT r.*,u.name reporter_name FROM reports r LEFT JOIN users u ON u.id=r.reporter_id WHERE r.organization_id=$1 ORDER BY r.created_at DESC LIMIT 100",
      [orgId],
    ),
    query(
      "SELECT a.*,u.name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 100",
      [orgId],
    ),
    query(
      "SELECT s.*,p.name plan_name,p.price_pkr,p.member_limit,p.admin_limit,p.storage_mb,p.bridges FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1",
      [orgId],
    ),
    query(
      "SELECT * FROM billing_records WHERE organization_id=$1 ORDER BY created_at DESC",
      [orgId],
    ),
    query(
      "SELECT r.*,e.title event_title,u.name,u.email FROM registrations r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=r.user_id WHERE e.organization_id=$1 ORDER BY r.created_at DESC LIMIT 250",
      [orgId],
    ),
    query(
      "SELECT a.*,o.title opportunity_title,u.name,u.email FROM applications a JOIN opportunities o ON o.id=a.opportunity_id JOIN users u ON u.id=a.user_id WHERE o.organization_id=$1 ORDER BY a.created_at DESC LIMIT 250",
      [orgId],
    ),
  ]);
  const [metrics] = await query(
    `SELECT (SELECT count(*)::int FROM memberships WHERE organization_id=$1 AND status='active') members,(SELECT count(*)::int FROM memberships WHERE organization_id=$1 AND status='pending') pending,(SELECT count(*)::int FROM posts WHERE organization_id=$1) posts,(SELECT count(*)::int FROM events WHERE organization_id=$1) events,(SELECT count(*)::int FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.organization_id=$1) messages`,
    [orgId],
  );
  return {
    members,
    reports,
    logs,
    subscription: subscription[0],
    invoices,
    registrations,
    applications,
    metrics,
    plans: await query("SELECT * FROM plans ORDER BY price_pkr NULLS LAST"),
  };
}
export async function adminAction(
  user: User,
  orgId: string,
  action: string,
  body: Record<string, unknown>,
) {
  requireAdminMfa(user);
  const actor = await requireMember(user.id, orgId, ADMIN_ROLES);
  if (action === "transfer") {
    invariant(actor.role === "owner");
    const target = z.string().parse(body.user_id);
    invariant(target !== user.id, "Choose a different administrator.", 400);
    await (
      await getDb()
    ).transaction(async (tx) => {
      await tx.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
        orgId,
      ]);
      const [member] = await tx.query(
        "SELECT 1 FROM memberships WHERE user_id=$1 AND organization_id=$2 AND status='active' AND role='admin'",
        [target, orgId],
      );
      invariant(member, "Choose an active administrator.", 400);
      await tx.query(
        "UPDATE memberships SET role='admin' WHERE user_id=$1 AND organization_id=$2",
        [user.id, orgId],
      );
      await tx.query(
        "UPDATE memberships SET role='owner' WHERE user_id=$1 AND organization_id=$2",
        [target, orgId],
      );
      await audit(
        tx,
        user.id,
        orgId,
        "organization.ownership_transferred",
        target,
      );
    });
    return { ok: true };
  }
  if (action === "membership") {
    const input = z
      .object({
        user_id: z.string(),
        status: z.enum(["active", "rejected", "suspended"]).optional(),
        role: z
          .enum([
            "admin",
            "department_admin",
            "staff",
            "society_admin",
            "moderator",
            "member",
            "guest",
          ])
          .optional(),
      })
      .parse(body);
    await (
      await getDb()
    ).transaction(async (tx) => {
      await tx.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
        orgId,
      ]);
      const [target] = await tx.query(
        "SELECT * FROM memberships WHERE organization_id=$1 AND user_id=$2",
        [orgId, input.user_id],
      );
      invariant(target, "Membership not found.", 404);
      invariant(
        target.role !== "owner",
        "Organization owners cannot be changed here.",
      );
      if (input.role && input.role !== target.role)
        invariant(
          actor.role === "owner",
          "Only the owner can change member roles.",
        );
      if (input.status === "active" && target.status !== "active") {
        const [plan] = await tx.query(
          "SELECT p.member_limit,s.status,s.renews_at FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1",
          [orgId],
        );
        invariant(
          plan &&
            ["trial", "active"].includes(plan.status) &&
            (!plan.renews_at || new Date(plan.renews_at) > new Date()),
          "An active subscription or trial is required.",
        );
        const [count] = await tx.query(
          "SELECT count(*)::int total FROM memberships WHERE organization_id=$1 AND status='active'",
          [orgId],
        );
        invariant(
          count.total < plan.member_limit,
          "Your plan’s membership limit has been reached.",
          409,
        );
      }
      if (input.role === "admin" && target.role !== "admin") {
        const [count] = await tx.query(
          "SELECT count(*)::int total FROM memberships WHERE organization_id=$1 AND role IN('owner','admin') AND status='active'",
          [orgId],
        );
        const [plan] = await tx.query(
          "SELECT p.admin_limit FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.organization_id=$1",
          [orgId],
        );
        invariant(
          count.total < plan.admin_limit,
          "Your plan’s administrator limit has been reached.",
          409,
        );
      }
      await tx.query(
        "UPDATE memberships SET status=COALESCE($1,status),role=COALESCE($2,role) WHERE organization_id=$3 AND user_id=$4",
        [input.status || null, input.role || null, orgId, input.user_id],
      );
      await audit(
        tx,
        user.id,
        orgId,
        "membership.updated",
        input.user_id,
        input,
      );
    });
    if (input.status === "active")
      await notify(
        input.user_id,
        "You’re in!",
        "Your organization membership has been approved.",
        `/app/organizations/${orgId}`,
        "membership",
      );
    return { ok: true };
  }
  if (action === "settings") {
    const input = z
      .object({
        description: z.string().max(3000),
        location: z.string().max(150),
        website: z
          .string()
          .max(300)
          .refine((s) => !s || /^https:\/\//.test(s)),
      })
      .parse(body);
    await query(
      "UPDATE organizations SET description=$1,location=$2,website=$3 WHERE id=$4",
      [input.description, input.location, input.website, orgId],
    );
    await audit(await getDb(), user.id, orgId, "organization.updated", orgId);
    return { ok: true };
  }
  if (action === "department") {
    const name = z.string().trim().min(2).max(100).parse(body.name);
    await query(
      "INSERT INTO departments(id,organization_id,name) VALUES($1,$2,$3)",
      [randomUUID(), orgId, name],
    );
    return { ok: true };
  }
  if (action === "moderate") {
    const input = z
      .object({
        report_id: z.string(),
        decision: z.enum(["dismiss", "remove"]),
      })
      .parse(body);
    await (
      await getDb()
    ).transaction(async (tx) => {
      const [report] = await tx.query(
        "SELECT * FROM reports WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [input.report_id, orgId],
      );
      invariant(report);
      invariant(
        report.status === "pending",
        "This report has already been reviewed.",
        409,
      );
      if (input.decision === "remove") {
        invariant(
          report.resource_type === "post",
          "This resource requires a separate review.",
          400,
        );
        await tx.query("DELETE FROM posts WHERE id=$1 AND organization_id=$2", [
          report.resource_id,
          orgId,
        ]);
      }
      await tx.query(
        "UPDATE reports SET status=$1,reviewed_by=$2 WHERE id=$3",
        [
          input.decision === "dismiss" ? "dismissed" : "resolved",
          user.id,
          input.report_id,
        ],
      );
      await audit(
        tx,
        user.id,
        orgId,
        "moderation.reviewed",
        input.report_id,
        input,
      );
    });
    return { ok: true };
  }
  if (action === "trial") {
    invariant(actor.role === "owner");
    await (
      await getDb()
    ).transaction(async (tx) => {
      const [org] = await tx.query(
        "SELECT verified FROM organizations WHERE id=$1 FOR UPDATE",
        [orgId],
      );
      invariant(
        org.verified,
        "Your organization needs verification before starting a trial.",
      );
      const [sub] = await tx.query(
        "SELECT plan_id FROM subscriptions WHERE organization_id=$1",
        [orgId],
      );
      invariant(
        sub.plan_id === "listing",
        "A trial or subscription is already active.",
        409,
      );
      await tx.query(
        "UPDATE subscriptions SET plan_id='starter',status='trial',renews_at=now()+interval '14 days' WHERE organization_id=$1",
        [orgId],
      );
      await tx.query("UPDATE organizations SET plan='starter' WHERE id=$1", [
        orgId,
      ]);
      await audit(tx, user.id, orgId, "subscription.trial_started", orgId);
    });
    return { ok: true };
  }
  if (action === "invoice") {
    invariant(actor.role === "owner");
    const planId = z
      .enum(["starter", "growth", "pro", "enterprise"])
      .parse(body.plan_id);
    const [plan] = await query("SELECT * FROM plans WHERE id=$1", [planId]);
    invariant(
      plan.price_pkr !== null,
      "Contact the team for an Enterprise agreement.",
      400,
    );
    const id = randomUUID();
    await query(
      "INSERT INTO billing_records(id,organization_id,amount_pkr,plan_id) VALUES($1,$2,$3,$4)",
      [id, orgId, plan.price_pkr * 12, planId],
    );
    await audit(await getDb(), user.id, orgId, "billing.invoice_requested", id);
    return {
      id,
      message:
        "Invoice requested. No payment has been taken and your plan has not changed.",
    };
  }
  if (action === "attendance") {
    const input = z
      .object({
        event_id: z.string(),
        user_id: z.string(),
        attended: z.boolean(),
      })
      .parse(body);
    const [event] = await query(
      "SELECT id FROM events WHERE id=$1 AND organization_id=$2",
      [input.event_id, orgId],
    );
    invariant(event);
    await query(
      "UPDATE registrations SET attended=$1 WHERE event_id=$2 AND user_id=$3",
      [input.attended, input.event_id, input.user_id],
    );
    return { ok: true };
  }
  invariant(false, "Unknown administrative action.", 404);
}
export async function platformOverview(user: User) {
  invariant(user.platform_role === "admin");
  return {
    organizations: await query(
      "SELECT o.*,u.name requester_name,u.email requester_email FROM organizations o LEFT JOIN users u ON u.id=o.created_by ORDER BY o.created_at DESC",
    ),
    reports: await query(
      "SELECT * FROM reports WHERE status='pending' ORDER BY created_at LIMIT 100",
    ),
    invoices: await query(
      "SELECT b.*,o.name organization_name FROM billing_records b JOIN organizations o ON o.id=b.organization_id ORDER BY b.created_at DESC LIMIT 100",
    ),
    contacts: await query(
      "SELECT * FROM contact_requests ORDER BY created_at DESC LIMIT 100",
    ),
  };
}
export async function platformAction(
  user: User,
  action: string,
  body: Record<string, unknown>,
) {
  requireAdminMfa(user);
  invariant(user.platform_role === "admin");
  if (action === "verify") {
    const input = z
      .object({ organization_id: z.string(), approved: z.boolean() })
      .parse(body);
    await (
      await getDb()
    ).transaction(async (tx) => {
      await tx.query(
        "UPDATE organizations SET verified=$1,verification_status=$2 WHERE id=$3",
        [
          input.approved,
          input.approved ? "approved" : "rejected",
          input.organization_id,
        ],
      );
      await audit(
        tx,
        user.id,
        input.organization_id,
        "organization.verification_reviewed",
        input.organization_id,
        { approved: input.approved },
      );
    });
    return { ok: true };
  }
  if (action === "reconcile") {
    const input = z
      .object({
        invoice_id: z.string(),
        reference: z.string().trim().min(5).max(200),
      })
      .parse(body);
    await (
      await getDb()
    ).transaction(async (tx) => {
      const [invoice] = await tx.query(
        "SELECT * FROM billing_records WHERE id=$1 FOR UPDATE",
        [input.invoice_id],
      );
      invariant(
        invoice && invoice.status !== "paid",
        "This record is missing or already paid.",
        409,
      );
      await tx.query(
        "UPDATE billing_records SET status='paid',reference=$1 WHERE id=$2",
        [input.reference, input.invoice_id],
      );
      await tx.query(
        "UPDATE subscriptions SET plan_id=$1,status='active',renews_at=now()+interval '1 year' WHERE organization_id=$2",
        [invoice.plan_id, invoice.organization_id],
      );
      await tx.query("UPDATE organizations SET plan=$1 WHERE id=$2", [
        invoice.plan_id,
        invoice.organization_id,
      ]);
      await audit(
        tx,
        user.id,
        invoice.organization_id,
        "billing.manually_reconciled",
        invoice.id,
        { reference: input.reference },
      );
    });
    return { ok: true };
  }
  if (action === "moderate") {
    const input = z
      .object({ report_id: z.string(), remove: z.boolean() })
      .parse(body);
    await (
      await getDb()
    ).transaction(async (tx) => {
      const [report] = await tx.query(
        "SELECT * FROM reports WHERE id=$1 FOR UPDATE",
        [input.report_id],
      );
      invariant(report && report.status === "pending");
      if (input.remove) {
        if (report.resource_type === "post")
          await tx.query("DELETE FROM posts WHERE id=$1", [report.resource_id]);
        else
          invariant(
            false,
            "Only post removal is available in this review queue.",
            400,
          );
      }
      await tx.query(
        "UPDATE reports SET status=$1,reviewed_by=$2 WHERE id=$3",
        [input.remove ? "resolved" : "dismissed", user.id, input.report_id],
      );
      await audit(
        tx,
        user.id,
        report.organization_id,
        "platform.moderation_reviewed",
        input.report_id,
      );
    });
    return { ok: true };
  }
  invariant(false, "Unknown platform action.", 404);
}
