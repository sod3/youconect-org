"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Users,
  FileText,
  CalendarDays,
  MessageCircle,
  Plus,
  Check,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Hash,
  Settings,
  Download,
  X,
  AlertCircle,
  Building2,
  CreditCard,
  Activity,
  Network,
} from "lucide-react";
import { api, useResource, downloadJson, formatDate } from "@/lib/client";
import { useApp } from "./app-context";
import { NewConversationModal } from "./messages";
import { CreateEventForm, CreateOpportunityForm } from "./events";
import {
  SectionHeading,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Modal,
  ErrorState,
  EmptyState,
  PageSkeleton,
  useToast,
} from "./ui";
type Member = {
  user_id: string;
  name: string;
  email: string;
  avatar: string;
  headline: string;
  role: string;
  status: string;
};
type Report = {
  id: string;
  resource_type: string;
  resource_id: string;
  reason: string;
  reporter_name: string;
  status: string;
  created_at: string;
};
type Plan = {
  id: string;
  name: string;
  price_pkr: number | null;
  member_limit: number;
  admin_limit: number;
};
type Invoice = {
  id: string;
  organization_id: string;
  organization_name?: string;
  amount_pkr: number;
  status: string;
  plan_id: string;
  reference: string;
  created_at: string;
};
type Registration = {
  user_id: string;
  event_id: string;
  name: string;
  email: string;
  event_title: string;
  attended: boolean;
};
type Application = {
  id: string;
  name: string;
  email: string;
  opportunity_title: string;
  note: string;
  status: string;
};
type AdminData = {
  members: Member[];
  reports: Report[];
  logs: {
    id: string;
    action: string;
    actor_name: string;
    resource_id: string;
    created_at: string;
  }[];
  subscription: {
    plan_id: string;
    plan_name: string;
    status: string;
    price_pkr: number;
    member_limit: number;
    admin_limit: number;
    renews_at: string;
  };
  invoices: Invoice[];
  registrations: Registration[];
  applications: Application[];
  metrics: {
    members: number;
    pending: number;
    posts: number;
    events: number;
    messages: number;
  };
  plans: Plan[];
};
export function AdminPage({ organizationId }: { organizationId?: string }) {
  const { data: app, refresh, openComposer } = useApp(),
    toast = useToast();
  const adminOrgs = app.organizations.filter((o) =>
    ["owner", "admin"].includes(o.role || ""),
  );
  const [chosen, setChosen] = useState(
    organizationId || adminOrgs[0]?.id || "",
  );
  const { data, error, isPending } = useResource<AdminData>(
    chosen ? `admin/${chosen}` : null,
  );
  const { data: org } = useResource<{
    organization: { description: string; location: string; website: string };
    departments: { id: string; name: string }[];
    channels: { id: string; name: string; announcements_only: boolean }[];
  }>(chosen ? `organizations/${chosen}` : null);
  const [tab, setTab] = useState("Overview"),
    [filter, setFilter] = useState(""),
    [channel, setChannel] = useState(false),
    [event, setEvent] = useState(false),
    [opportunity, setOpportunity] = useState(false),
    [busy, setBusy] = useState(false),
    [department, setDepartment] = useState(false),
    [transfer, setTransfer] = useState(false);
  const own = adminOrgs.find((o) => o.id === chosen)?.role === "owner";
  async function action(name: string, body: unknown) {
    setBusy(true);
    try {
      const result = await api<{ message?: string }>(
        `admin/${chosen}/${name}`,
        body,
      );
      await refresh();
      toast(result.message || "Your change is saved.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  if (!chosen)
    return (
      <EmptyState
        icon={ShieldCheck}
        title="A little more responsibility."
        description="Organization administration is available to owners and administrators."
      >
        <ButtonLink href="/app/organizations" variant="secondary">
          Find your organization <ArrowUpRight size={15} />
        </ButtonLink>
      </EmptyState>
    );
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} />;
  const tabs = [
    "Overview",
    "Members",
    "Channels",
    "Events & applications",
    "Moderation",
    "Billing",
    "Audit log",
    "Settings",
  ];
  const memberTable = (members: Member[]) => (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Role</th>
            <th>Membership</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user_id}>
              <td>
                <div className="row">
                  <Avatar name={m.name} color={m.avatar} size="sm" />
                  <span>
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </span>
                </div>
              </td>
              <td>
                {m.role === "owner" ? (
                  <Badge color="blue">Owner</Badge>
                ) : (
                  <select
                    aria-label={`Role for ${m.name}`}
                    disabled={!own || busy}
                    value={m.role}
                    onChange={(e) =>
                      void action("membership", {
                        user_id: m.user_id,
                        role: e.target.value,
                      })
                    }
                  >
                    {[
                      "admin",
                      "department_admin",
                      "staff",
                      "society_admin",
                      "moderator",
                      "member",
                      "guest",
                    ].map((r) => (
                      <option value={r} key={r}>
                        {r.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td>
                <Badge
                  color={
                    m.status === "active"
                      ? "teal"
                      : m.status === "pending"
                        ? "amber"
                        : "rose"
                  }
                >
                  {m.status}
                </Badge>
              </td>
              <td>
                {m.status === "pending" ? (
                  <div className="row">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void action("membership", {
                          user_id: m.user_id,
                          status: "active",
                        })
                      }
                    >
                      <Check size={12} /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void action("membership", {
                          user_id: m.user_id,
                          status: "rejected",
                        })
                      }
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  m.role !== "owner" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void action("membership", {
                          user_id: m.user_id,
                          status:
                            m.status === "active" ? "suspended" : "active",
                        })
                      }
                    >
                      {m.status === "active"
                        ? "Suspend access"
                        : "Restore access"}
                    </Button>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!members.length && (
        <div className="admin-table-empty">
          No membership requests to review. You’re all caught up.
        </div>
      )}
    </div>
  );
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="A LITTLE CARE FOR YOUR COMMUNITY"
        title="Your organization, connected."
        description="Clear permissions. Thoughtful tools. A stronger sense of together."
      >
        <select
          style={{ maxWidth: 225, fontSize: 11 }}
          value={chosen}
          aria-label="Organization to administer"
          onChange={(e) => {
            setChosen(e.target.value);
            setTab("Overview");
          }}
        >
          {adminOrgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </SectionHeading>
      <div className="admin-metrics">
        {[
          {
            name: "Connected members",
            value: data.metrics.members,
            icon: Users,
            note: `${data.subscription.member_limit.toLocaleString()} on your plan`,
          },
          {
            name: "Membership requests",
            value: data.metrics.pending,
            icon: ShieldCheck,
            note: "Waiting for a closer look",
          },
          {
            name: "Shared posts",
            value: data.metrics.posts,
            icon: FileText,
            note: "From your organization",
          },
          {
            name: "Upcoming & past events",
            value: data.metrics.events,
            icon: CalendarDays,
            note: "Reasons to come together",
          },
        ].map((m) => (
          <div className="metric-card card" key={m.name}>
            <span>
              {m.name}
              <m.icon size={17} />
            </span>
            <strong>{m.value}</strong>
            <small>{m.note}</small>
          </div>
        ))}
      </div>
      <div className="page-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t}
            {t === "Members" && data.metrics.pending > 0
              ? ` (${data.metrics.pending})`
              : ""}
          </button>
        ))}
      </div>
      {tab === "Overview" && (
        <>
          <div className="admin-section-title">
            <h2>A few people waiting to belong.</h2>
            <Button variant="secondary" onClick={() => setTab("Members")}>
              All members <ArrowUpRight size={14} />
            </Button>
          </div>
          {memberTable(data.members.filter((m) => m.status === "pending"))}
          <div className="admin-split">
            <section className="card">
              <h3>Give your people an update.</h3>
              <p>
                Share an official announcement in your organization’s feed.
                Choose the organization audience to keep it within your space.
              </p>
              <Button
                onClick={() =>
                  openComposer({
                    organization_id: chosen,
                    audience: "organization",
                  })
                }
              >
                <Plus size={15} /> Create an announcement
              </Button>
            </section>
            <section className="card">
              <h3>A little transparency.</h3>
              <p>
                These counts come from your organization’s stored records.
                Membership and moderation changes are captured in the audit log.
              </p>
              <Button variant="secondary" onClick={() => setTab("Audit log")}>
                <Activity size={15} /> View the audit log
              </Button>
            </section>
          </div>
        </>
      )}
      {tab === "Members" && (
        <>
          <div className="admin-section-title">
            <h2>The people in your space.</h2>
            <div className="inline-search">
              <Search size={15} />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a member…"
                aria-label="Search members"
              />
            </div>
          </div>
          {memberTable(
            data.members.filter((m) =>
              (m.name + " " + m.email)
                .toLowerCase()
                .includes(filter.toLowerCase()),
            ),
          )}
        </>
      )}
      {tab === "Channels" && (
        <>
          <div className="admin-section-title">
            <h2>A place for every conversation.</h2>
            <Button onClick={() => setChannel(true)}>
              <Plus size={15} /> Create channel
            </Button>
          </div>
          <div className="channel-directory">
            {org?.channels.map((c) => (
              <div className="channel-row card" key={c.id}>
                <span className="feature-icon tone-blue">
                  <Hash size={21} />
                </span>
                <div>
                  <h3>{c.name}</h3>
                  <p>
                    {c.announcements_only
                      ? "Announcements only"
                      : "Open organization discussion"}
                  </p>
                </div>
                <ButtonLink href={`/app/messages/${c.id}`} variant="secondary">
                  Open channel <ArrowUpRight size={14} />
                </ButtonLink>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "Events & applications" && (
        <>
          <div className="admin-section-title">
            <h2>Bring your people together.</h2>
            <div className="row">
              <Button variant="secondary" onClick={() => setOpportunity(true)}>
                <Plus size={14} /> Opportunity
              </Button>
              <Button onClick={() => setEvent(true)}>
                <Plus size={14} /> Event
              </Button>
            </div>
          </div>
          <div className="admin-section-title">
            <h2>Event registrations</h2>
            <Button
              variant="secondary"
              onClick={() =>
                downloadJson(`${chosen}-attendees.json`, data.registrations)
              }
            >
              <Download size={14} /> Export attendees
            </Button>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Event</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {data.registrations.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{r.name}</strong>
                      <small>{r.email}</small>
                    </td>
                    <td>{r.event_title}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void action("attendance", {
                            event_id: r.event_id,
                            user_id: r.user_id,
                            attended: !r.attended,
                          })
                        }
                      >
                        {r.attended ? (
                          <>
                            <Check size={12} /> Attended
                          </>
                        ) : (
                          "Record attendance"
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.registrations.length && (
              <div className="admin-table-empty">
                Your next event’s registrations will appear here.
              </div>
            )}
          </div>
          <div className="admin-section-title">
            <h2>Opportunity introductions</h2>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Opportunity</th>
                  <th>Introduction</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.applications.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.name}</strong>
                      <small>{a.email}</small>
                    </td>
                    <td>{a.opportunity_title}</td>
                    <td>
                      <p className="application-note">{a.note}</p>
                    </td>
                    <td>
                      <Badge color="teal">{a.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.applications.length && (
              <div className="admin-table-empty">
                When someone applies, their introduction will be waiting here.
              </div>
            )}
          </div>
        </>
      )}
      {tab === "Moderation" && (
        <>
          <div className="admin-section-title">
            <h2>A little care goes a long way.</h2>
            <span className="muted" style={{ fontSize: 10 }}>
              {data.reports.filter((r) => r.status === "pending").length}{" "}
              reports to review
            </span>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reported content</th>
                  <th>Concern</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.resource_type}
                      {r.resource_type === "post" && (
                        <small>
                          <Link
                            className="text-link"
                            href={`/app/post/${r.resource_id}`}
                          >
                            View post <ArrowUpRight size={11} />
                          </Link>
                        </small>
                      )}
                    </td>
                    <td>
                      <p className="application-note">{r.reason}</p>
                      <small>{r.reporter_name}</small>
                    </td>
                    <td>
                      <Badge color={r.status === "pending" ? "amber" : "teal"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td>
                      {r.status === "pending" && (
                        <div className="row">
                          {r.resource_type === "post" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                void action("moderate", {
                                  report_id: r.id,
                                  decision: "remove",
                                })
                              }
                            >
                              Remove post
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void action("moderate", {
                                report_id: r.id,
                                decision: "dismiss",
                              })
                            }
                          >
                            Dismiss report
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.reports.length && (
              <div className="admin-table-empty">
                No reports from your community. Keep looking out for each other.
              </div>
            )}
          </div>
        </>
      )}
      {tab === "Billing" && (
        <>
          <div className="billing-plan-card card">
            <div>
              <Badge color="teal">
                {data.subscription.status.toUpperCase()}
              </Badge>
              <h2>{data.subscription.plan_name}</h2>
              <p>
                Up to {data.subscription.member_limit.toLocaleString()} members
                · {data.subscription.admin_limit} administrative seats
              </p>
            </div>
            <div>
              <strong>
                PKR {data.subscription.price_pkr?.toLocaleString() || "0"}
                <span style={{ fontSize: 12, fontWeight: 400 }}>
                  {" "}
                  /mo equivalent
                </span>
              </strong>
              <small>
                {data.subscription.renews_at
                  ? `Current period ends ${formatDate(data.subscription.renews_at, { month: "long", day: "numeric", year: "numeric" })}`
                  : "Public listing · no private workspace"}
              </small>
            </div>
          </div>
          {data.subscription.plan_id === "listing" && (
            <div className="info-notice" style={{ marginBottom: 23 }}>
              <ShieldCheck size={20} />
              <div>
                <p>
                  Once your organization is verified, you can activate a 14-day
                  Campus Starter trial.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void action("trial", {})}
                  style={{ marginTop: 12 }}
                >
                  Start a 14-day trial <ArrowUpRight size={13} />
                </Button>
              </div>
            </div>
          )}
          <div className="info-notice" style={{ marginBottom: 25 }}>
            <CreditCard size={19} />
            <p>
              No payment gateway is configured. Requesting an invoice records a
              request only. A platform administrator must reconcile an actual
              payment before a paid plan is activated.
            </p>
          </div>
          <div className="billing-plans">
            {data.plans
              .filter((p) => ["starter", "growth", "pro"].includes(p.id))
              .map((p) => (
                <div className="card" key={p.id}>
                  <h3>{p.name}</h3>
                  <p>
                    PKR {p.price_pkr?.toLocaleString()}/month equivalent
                    <br />
                    PKR {((p.price_pkr || 0) * 12).toLocaleString()} billed
                    annually
                  </p>
                  <Button
                    variant="secondary"
                    disabled={busy || !own}
                    onClick={() => void action("invoice", { plan_id: p.id })}
                  >
                    Request annual invoice <ArrowUpRight size={14} />
                  </Button>
                </div>
              ))}
          </div>
          <div className="admin-section-title">
            <h2>Your billing records</h2>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Plan</th>
                  <th>Annual amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i.id}>
                    <td>{formatDate(i.created_at)}</td>
                    <td>{i.plan_id}</td>
                    <td>PKR {i.amount_pkr.toLocaleString()}</td>
                    <td>
                      <Badge color={i.status === "paid" ? "teal" : "amber"}>
                        {i.status}
                      </Badge>
                    </td>
                    <td>{i.reference || "Awaiting review"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.invoices.length && (
              <div className="admin-table-empty">
                Your organization has no billing records yet.
              </div>
            )}
          </div>
        </>
      )}
      {tab === "Audit log" && (
        <>
          <div className="admin-section-title">
            <h2>A clear record of important changes.</h2>
            <Button
              variant="secondary"
              onClick={() =>
                downloadJson(`${chosen}-audit-log.json`, data.logs)
              }
            >
              <Download size={14} /> Export log
            </Button>
          </div>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>By</th>
                  <th>When</th>
                  <th>Resource</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((l) => (
                  <tr key={l.id}>
                    <td className="audit-action">{l.action}</td>
                    <td>{l.actor_name || "Former user"}</td>
                    <td>{new Date(l.created_at).toLocaleString()}</td>
                    <td>{l.resource_id.slice(0, 20)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.logs.length && (
              <div className="admin-table-empty">
                Important administrative changes will appear here.
              </div>
            )}
          </div>
        </>
      )}
      {tab === "Settings" && (
        <>
          <section className="card settings-card">
            <h2>A little more about your organization.</h2>
            <p>Keep your public information clear and current.</p>
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await action(
                  "settings",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
              }}
            >
              <label>
                About
                <textarea
                  name="description"
                  defaultValue={org?.organization.description}
                  rows={4}
                  maxLength={3000}
                />
              </label>
              <label>
                Location
                <input
                  name="location"
                  defaultValue={org?.organization.location}
                  maxLength={150}
                />
              </label>
              <label>
                Official website
                <input
                  name="website"
                  defaultValue={org?.organization.website}
                  type="url"
                  pattern="https://.*"
                  maxLength={300}
                />
              </label>
              <Button type="submit" loading={busy}>
                Save organization details <Check size={15} />
              </Button>
            </form>
          </section>
          <section className="card settings-card">
            <div className="row between">
              <h2>Departments</h2>
              <Button variant="secondary" onClick={() => setDepartment(true)}>
                <Plus size={14} /> Add department
              </Button>
            </div>
            <div className="interest-chips" style={{ marginTop: 20 }}>
              {org?.departments.map((d) => (
                <Badge key={d.id}>{d.name}</Badge>
              ))}
            </div>
          </section>
          {own && (
            <section className="card settings-card">
              <h2>Pass the responsibility along.</h2>
              <p>
                Transfer ownership to an active administrator. You will become
                an administrator.
              </p>
              <Button variant="secondary" onClick={() => setTransfer(true)}>
                Transfer ownership <ArrowRightSmall />
              </Button>
            </section>
          )}
        </>
      )}
      <NewConversationModal
        open={channel}
        onOpenChange={setChannel}
        organizationId={chosen}
      />
      <CreateEventForm open={event} onOpenChange={setEvent} />
      <CreateOpportunityForm open={opportunity} onOpenChange={setOpportunity} />
      <Modal
        open={department}
        onOpenChange={setDepartment}
        title="A place for your department"
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await action("department", {
              name: new FormData(e.currentTarget).get("name"),
            });
            setDepartment(false);
          }}
        >
          <label>
            Department name
            <input name="name" required minLength={2} maxLength={100} />
          </label>
          <Button type="submit" loading={busy}>
            Add department
          </Button>
        </form>
      </Modal>
      <Modal
        open={transfer}
        onOpenChange={setTransfer}
        title="Transfer organization ownership"
        description="This gives the selected administrator full control of the organization."
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await action("transfer", {
              user_id: new FormData(e.currentTarget).get("user_id"),
            });
            setTransfer(false);
          }}
        >
          <label>
            New owner
            <select name="user_id" required>
              <option value="">Choose an active administrator</option>
              {data.members
                .filter((m) => m.status === "active" && m.role === "admin")
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit" loading={busy}>
            Transfer ownership
          </Button>
        </form>
      </Modal>
    </div>
  );
}
function ArrowRightSmall() {
  return <ArrowUpRight size={14} />;
}
export function PlatformPage() {
  const { data: app, refresh } = useApp(),
    toast = useToast();
  const { data, error, isPending } = useResource<{
    organizations: {
      id: string;
      name: string;
      type: string;
      verification_status: string;
      requester_name: string;
      requester_email: string;
    }[];
    invoices: Invoice[];
    reports: Report[];
    contacts: {
      id: string;
      name: string;
      email: string;
      organization: string;
      message: string;
      created_at: string;
    }[];
  }>("platform");
  const [tab, setTab] = useState("Verification"),
    [invoice, setInvoice] = useState<Invoice | null>(null),
    [busy, setBusy] = useState(false);
  async function action(action: string, body: unknown) {
    setBusy(true);
    try {
      await api(`platform/${action}`, body);
      await refresh();
      toast("Review recorded in the audit log.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} />;
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="PLATFORM ADMINISTRATION"
        title="A little care for the whole network."
        description="Verification, moderation, and billing reviews across the platform."
      />
      <div className="info-notice" style={{ marginBottom: 25 }}>
        <ShieldCheck size={20} />
        <p>
          Restricted to platform administrators. All verification and financial
          reconciliation actions are audited. Administrative MFA is required for
          production administrative access. Enable an authenticator in account
          settings.
        </p>
      </div>
      <div className="page-tabs">
        {["Verification", "Moderation", "Billing", "Inquiries"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Verification" && (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Requested by</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {data.organizations.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.name}</strong>
                    <small>{o.type}</small>
                  </td>
                  <td>
                    {o.requester_name}
                    <small>{o.requester_email}</small>
                  </td>
                  <td>
                    <Badge
                      color={
                        o.verification_status === "approved" ? "teal" : "amber"
                      }
                    >
                      {o.verification_status}
                    </Badge>
                  </td>
                  <td>
                    <div className="row">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy || o.verification_status === "approved"}
                        onClick={() =>
                          void action("verify", {
                            organization_id: o.id,
                            approved: true,
                          })
                        }
                      >
                        <Check size={12} /> Approve verification
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void action("verify", {
                            organization_id: o.id,
                            approved: false,
                          })
                        }
                      >
                        Decline / revoke
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "Moderation" && (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Concern</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.resource_type}</td>
                  <td>
                    <p className="application-note">{r.reason}</p>
                  </td>
                  <td>
                    <div className="row">
                      {r.resource_type === "post" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void action("moderate", {
                              report_id: r.id,
                              remove: true,
                            })
                          }
                        >
                          Remove post
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void action("moderate", {
                            report_id: r.id,
                            remove: false,
                          })
                        }
                      >
                        Dismiss report
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.reports.length && (
            <div className="admin-table-empty">
              No pending platform reports.
            </div>
          )}
        </div>
      )}
      {tab === "Billing" && (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Plan</th>
                <th>Annual amount</th>
                <th>Status</th>
                <th>Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.organization_name}</strong>
                  </td>
                  <td>{i.plan_id}</td>
                  <td>PKR {i.amount_pkr.toLocaleString()}</td>
                  <td>
                    <Badge color={i.status === "paid" ? "teal" : "amber"}>
                      {i.status}
                    </Badge>
                  </td>
                  <td>
                    {i.status !== "paid" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setInvoice(i)}
                      >
                        Record verified bank payment
                      </Button>
                    ) : (
                      i.reference
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.invoices.length && (
            <div className="admin-table-empty">No invoice requests yet.</div>
          )}
        </div>
      )}
      {tab === "Inquiries" && (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>Organization</th>
                <th>Message</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    <small>{c.email}</small>
                  </td>
                  <td>{c.organization || "Individual"}</td>
                  <td>
                    <p className="application-note">{c.message}</p>
                  </td>
                  <td>{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.contacts.length && (
            <div className="admin-table-empty">
              Contact inquiries will appear here.
            </div>
          )}
        </div>
      )}
      <Modal
        open={!!invoice}
        onOpenChange={(o) => {
          if (!o) setInvoice(null);
        }}
        title="Record an actual verified payment"
        description="Only continue after independently confirming this organization’s bank payment. This activates the annual subscription."
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await action("reconcile", {
              invoice_id: invoice!.id,
              reference: new FormData(e.currentTarget).get("reference"),
            });
            setInvoice(null);
          }}
        >
          <div className="info-notice">
            <AlertCircle size={20} />
            <p>
              This is manual reconciliation. No payment provider is called.
              Record real payment evidence and an identifiable bank reference.
            </p>
          </div>
          <label>
            Bank payment reference
            <input
              name="reference"
              required
              minLength={5}
              maxLength={200}
              placeholder="Verified transfer reference"
            />
          </label>
          <Button type="submit" loading={busy}>
            Record payment & activate plan
          </Button>
        </form>
      </Modal>
    </div>
  );
}
