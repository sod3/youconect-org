"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Network,
  ArrowUpRight,
  Plus,
  Check,
  Users,
  LockKeyhole,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  X,
  MessageCircle,
  UserPlus,
} from "lucide-react";
import { api, useResource } from "@/lib/client";
import type { Bridge, Organization, User } from "@/lib/types";
import { useApp } from "./app-context";
import { QuickComposer, PostFeed } from "./social";
import {
  SectionHeading,
  Badge,
  Button,
  ButtonLink,
  Modal,
  EmptyState,
  ErrorState,
  PageSkeleton,
  useToast,
} from "./ui";
export function BridgesPage() {
  const { data, error, isPending } = useResource<{ items: Bridge[] }>(
    "bridges",
  );
  const [create, setCreate] = useState(false),
    [filter, setFilter] = useState("All Bridges");
  const items = data?.items.filter(
    (b) =>
      filter === "All Bridges" ||
      (filter === "Active" && b.status === "active") ||
      (filter === "Pending" && b.status === "pending"),
  );
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="GO FURTHER, TOGETHER"
        title="Great things happen in between."
        description="Approved shared spaces. New possibilities between organizations."
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={16} /> Propose a Bridge
        </Button>
      </SectionHeading>
      <div className="bridge-banner">
        <span>
          <Network size={38} />
        </span>
        <div>
          <h2>Build a connection. Keep your boundaries.</h2>
          <p>
            A Bridge brings organizations together around a shared purpose. Both
            sides approve, members are explicitly invited, and private
            workspaces stay private.
          </p>
        </div>
      </div>
      <div className="filter-pills" style={{ marginBottom: 25 }}>
        {["All Bridges", "Active", "Pending"].map((f) => (
          <button
            className={filter === f ? "active" : ""}
            key={f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {isPending ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <div className="directory-grid">
          {items?.map((b) => (
            <Link
              href={`/app/bridges/${b.id}`}
              className="bridge-card card"
              key={b.id}
            >
              <div className="bridge-card-art">
                <span>{b.proposer_name}</span>
                <Network size={27} />
                <span>{b.target_name}</span>
              </div>
              <Badge
                color={
                  b.status === "active"
                    ? "teal"
                    : b.status === "pending"
                      ? "amber"
                      : "rose"
                }
              >
                {b.status === "active" ? (
                  <Check size={11} />
                ) : (
                  <LockKeyhole size={11} />
                )}{" "}
                {b.status}
              </Badge>
              <h2>{b.name}</h2>
              <p>{b.description}</p>
              <div className="bridge-card-footer">
                <span>
                  <Users size={13} />
                  {b.member_count} approved members
                </span>
                <span className="text-link">
                  {b.status === "pending"
                    ? "Review proposal"
                    : "Explore this Bridge"}
                  <ArrowUpRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {items && !items.length && (
        <EmptyState
          icon={Network}
          title="Your next collaboration is out there."
          description="Propose a shared space between organizations. Both sides will review before anyone gets access."
        >
          <Button variant="secondary" onClick={() => setCreate(true)}>
            Propose a Bridge <Plus size={15} />
          </Button>
        </EmptyState>
      )}
      <BridgeForm open={create} onOpenChange={setCreate} />
    </div>
  );
}
function BridgeForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: app, refresh } = useApp(),
    router = useRouter();
  const { data: orgs } = useResource<{ items: Organization[] }>(
    open ? "organizations" : null,
  );
  const [proposer, setProposer] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const admin = app.organizations.filter((o) =>
    ["owner", "admin"].includes(o.role || ""),
  );
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="A new connection between communities"
      description="Propose a shared purpose. The other organization decides whether to join."
      wide
    >
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const fields = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api<{ id: string }>("bridges", fields);
            await refresh();
            onOpenChange(false);
            router.push(`/app/bridges/${result.id}`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Bridge name
          <input
            name="name"
            required
            minLength={3}
            maxLength={100}
            placeholder="A shared purpose deserves a good name"
          />
        </label>
        <label>
          What could you build together?
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
          />
        </label>
        <div className="form-two-columns">
          <label>
            Your organization
            <select
              name="proposer_org_id"
              value={proposer}
              onChange={(e) => setProposer(e.target.value)}
              required
            >
              <option value="">Choose an organization you manage</option>
              {admin.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Connect with
            <select name="target_org_id" required>
              <option value="">Choose a verified organization</option>
              {orgs?.items
                .filter((o) => o.verified && o.id !== proposer)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="info-notice">
          <ShieldCheck size={19} />
          <p>
            Bridges require a Growth plan or above at both organizations. A
            different authorized administrator on the receiving side must
            approve. No content or members are shared automatically.
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy}>
          Send your proposal <ArrowUpRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
export function BridgeDetail({ id }: { id: string }) {
  const { data, error, isPending } = useResource<{ bridge: Bridge }>(
    `bridges/${id}`,
  );
  const { data: app, refresh } = useApp(),
    toast = useToast();
  const [busy, setBusy] = useState(false),
    [manage, setManage] = useState(false),
    [close, setClose] = useState(false),
    [memberOrg, setMemberOrg] = useState("");
  const { data: members } = useResource<{ items: User[] }>(
    manage && memberOrg ? `organizations/${memberOrg}/members` : null,
  );
  const { data: approved } = useResource<{
    items: { id: string; name: string; organization_id: string }[];
  }>(manage ? `bridges/${id}/members` : null);
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} />;
  const b = data.bridge;
  const adminOrgs = app.organizations.filter(
    (o) =>
      [b.proposer_org_id, b.target_org_id].includes(o.id) &&
      ["owner", "admin"].includes(o.role || ""),
  );
  const canApprove =
    b.status === "pending" && adminOrgs.some((o) => o.id === b.target_org_id);
  async function action(action: string, body: unknown = {}) {
    setBusy(true);
    try {
      await api(`bridges/${id}/${action}`, body);
      await refresh();
      toast(
        action === "approve"
          ? "Both organizations have approved. Your Bridge is active."
          : action === "close"
            ? "Bridge closed. Shared access has been revoked."
            : "Your change is saved.",
      );
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="standard-page">
      <Link href="/app/bridges" className="back-link">
        <ArrowLeft size={16} /> Your connected organizations
      </Link>
      <div className="bridge-detail-head">
        <Badge color={b.status === "active" ? "teal" : "amber"}>
          <Network size={12} />
          {b.status.toUpperCase()} BRIDGE
        </Badge>
        <h1>{b.name}</h1>
        <p>{b.description}</p>
        <div className="bridge-org-labels">
          <BuildingMark />
          {b.proposer_name}
          <Network size={19} />
          {b.target_name}
        </div>
        <div className="bridge-detail-actions">
          {canApprove && (
            <>
              <Button loading={busy} onClick={() => void action("approve")}>
                <Check size={15} /> Approve collaboration
              </Button>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void action("reject")}
              >
                Decline proposal
              </Button>
            </>
          )}
          {b.status === "active" && adminOrgs.length > 0 && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setMemberOrg(adminOrgs[0].id);
                  setManage(true);
                }}
              >
                <UserPlus size={15} /> Manage approved members
              </Button>
              <Button variant="ghost" onClick={() => setClose(true)}>
                <X size={15} /> Close this Bridge
              </Button>
            </>
          )}
        </div>
      </div>
      {b.status === "active" && b.joined ? (
        <div className="organization-feed">
          <div>
            <QuickComposer scope={{ bridge_id: id, audience: "bridge" }} />
            <PostFeed bridge={id} />
          </div>
          <aside className="card organization-about">
            <span className="eyebrow">A SHARED SPACE. CLEAR BOUNDARIES.</span>
            <h3>Good things, together.</h3>
            <p>
              This feed is visible only to explicitly approved members with an
              active membership at either organization. Closing a Bridge revokes
              shared access.
            </p>
            <Badge color="teal">
              <ShieldCheck size={12} /> Approved by both organizations
            </Badge>
          </aside>
        </div>
      ) : (
        <EmptyState
          icon={LockKeyhole}
          title={
            b.status === "pending"
              ? "A new possibility, waiting for approval."
              : b.status === "closed"
                ? "This collaboration has closed."
                : "Your place is waiting for approval."
          }
          description={
            b.status === "pending"
              ? "The receiving organization needs to review this proposal before a shared space opens."
              : "An authorized administrator must explicitly add you as a participant before you can access shared content."
          }
        />
      )}
      <Modal
        open={manage}
        onOpenChange={setManage}
        title="The right people, explicitly invited"
        description="You can approve members of the organizations you administer."
      >
        <div className="stack-form">
          <label>
            Your organization
            <select
              value={memberOrg}
              onChange={(e) => setMemberOrg(e.target.value)}
            >
              {adminOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {members?.items.map((p) => {
                  const hasAccess = approved?.items.some((a) => a.id === p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={busy}
                          onClick={async () => {
                            await action("members", {
                              user_id: p.id,
                              remove: hasAccess,
                            });
                          }}
                        >
                          {hasAccess ? (
                            <>
                              <Check size={12} /> Remove access
                            </>
                          ) : (
                            <>
                              <Plus size={12} /> Approve member
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
      <Modal
        open={close}
        onOpenChange={setClose}
        title="Close this Bridge?"
        description="All participants will lose access to the shared feed and channels. Existing content is retained for the deployment’s retention policy."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setClose(false)}>
            Keep the connection
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              await action("close");
              setClose(false);
            }}
          >
            Close Bridge
          </Button>
        </div>
      </Modal>
    </div>
  );
}
function BuildingMark() {
  return <ShieldCheck size={16} />;
}
