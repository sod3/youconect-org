"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Search,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Check,
  Building2,
  Users,
  GraduationCap,
  MapPin,
  Globe2,
  ShieldCheck,
  ChevronDown,
  Network,
  LockKeyhole,
  MessageCircle,
  Hash,
  Palette,
  Rocket,
  Code2,
  Sparkles,
  CalendarDays,
  Settings,
  ArrowLeft,
  Clock3,
} from "lucide-react";
import { api, useResource } from "@/lib/client";
import type { Organization, Community, User, Bridge } from "@/lib/types";
import { useApp } from "./app-context";
import { PostFeed, QuickComposer } from "./social";
import { ContextPanel } from "./app-shell";
import {
  SectionHeading,
  Button,
  ButtonLink,
  Avatar,
  Badge,
  Verified,
  IconButton,
  Modal,
  EmptyState,
  ErrorState,
  PageSkeleton,
  useToast,
} from "./ui";
export function OrganizationCard({ org }: { org: Organization }) {
  return (
    <Link
      className="organization-card card"
      href={`/app/organizations/${org.id}`}
    >
      <div className={`organization-card-cover tone-${org.color}`}>
        <span className="organization-cover-grid" />
        <span className="organization-card-category">{org.type}</span>
        <ArrowUpRight size={20} />
      </div>
      <div className="organization-card-body">
        <span className={`org-symbol org-symbol-lg tone-${org.color}`}>
          {org.initials}
        </span>
        {org.membership_status === "active" && (
          <Badge color="teal">
            <Check size={11} /> Your organization
          </Badge>
        )}
        <h2>
          {org.name} {org.verified && <Verified />}
        </h2>
        <p>{org.description}</p>
        <span className="organization-card-location">
          <MapPin size={13} />
          {org.location || "A connected community"}
        </span>
        <div className="organization-card-footer">
          <span>
            <Users size={14} />
            {org.member_count} members
          </span>
          <strong>
            {org.membership_status === "pending"
              ? "Request pending"
              : org.membership_status === "active"
                ? "Open your space"
                : "Explore organization"}
            <ArrowRight size={14} />
          </strong>
        </div>
      </div>
    </Link>
  );
}
const communityIcons: Record<string, typeof Users> = {
  palette: Palette,
  rocket: Rocket,
  graduation: GraduationCap,
  code: Code2,
  users: Users,
};
export function CommunityCard({ community: c }: { community: Community }) {
  const { refresh } = useApp(),
    toast = useToast();
  const [busy, setBusy] = useState(false);
  const Icon = communityIcons[c.icon] || Users;
  return (
    <article className="community-card card">
      <Link
        href={`/app/communities/${c.id}`}
        className={`community-card-art tone-${c.color}`}
      >
        <span className="community-art-grid" />
        <div className="community-art-orbit" />
        <Icon size={42} />
        <ArrowUpRight size={20} />
        <span>{c.category}</span>
      </Link>
      <div className="community-card-body">
        <div className="row between">
          <Badge color={c.color}>{c.category}</Badge>
          {c.visibility !== "public" && <LockKeyhole size={13} />}
        </div>
        <Link href={`/app/communities/${c.id}`}>
          <h2>{c.name}</h2>
        </Link>
        <p>{c.description}</p>
        <div className="community-card-footer">
          <span>
            <Users size={14} />
            {c.member_count} {c.member_count === 1 ? "member" : "members"}
          </span>
          {c.joined ? (
            <ButtonLink href={`/app/communities/${c.id}`} variant="secondary">
              <Check size={14} /> Joined
            </ButtonLink>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`communities/${c.id}/join`, {});
                  await refresh();
                  toast(`You’re now part of ${c.name}.`);
                } catch (e) {
                  toast((e as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Join community <Plus size={14} />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
export function DirectoryPage({
  kind,
}: {
  kind: "organizations" | "communities";
}) {
  const { data: app } = useApp();
  const { data, error, isPending } = useResource<{
    items: Organization[] | Community[];
  }>(kind);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [create, setCreate] = useState(false);
  const org = kind === "organizations";
  const items =
    data?.items.filter(
      (i) =>
        (filter === "mine"
          ? org
            ? (i as Organization).membership_status === "active"
            : (i as Community).joined
          : filter === "all" ||
            (org ? (i as Organization).type : (i as Community).category) ===
              filter) &&
        (i.name + " " + i.description)
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  const categories = [
    ...new Set(
      data?.items.map((i) =>
        org ? (i as Organization).type : (i as Community).category,
      ),
    ),
  ];
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow={
          org ? "YOUR BELONGING, WITHOUT BOUNDARIES" : "YOUR KIND OF PEOPLE"
        }
        title={
          org ? "Many worlds. One you." : "Find a little more of your people."
        }
        description={
          org
            ? "Move between the places you belong, and discover where you could belong next."
            : "Big ideas, shared interests, and conversations worth having."
        }
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          {org ? "Bring your organization" : "Create a community"}
        </Button>
      </SectionHeading>
      <div
        className={`directory-banner ${org ? "organization-directory-banner" : "community-directory-banner"}`}
      >
        <span className="directory-banner-icon">
          {org ? <Building2 size={35} /> : <Users size={35} />}
        </span>
        <div>
          <h2>
            {org
              ? "One identity. Every organization."
              : "Good company for your next good idea."}
          </h2>
          <p>
            {org
              ? "Your university, your team, your communities. Connected, on your terms."
              : "A little inspiration. A shared purpose. A place to make things happen."}
          </p>
        </div>
        <Sparkles size={26} />
      </div>
      <div className="directory-tools">
        <div className="filter-pills">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Discover
          </button>
          <button
            className={filter === "mine" ? "active" : ""}
            onClick={() => setFilter("mine")}
          >
            {org ? "My organizations" : "My communities"}
          </button>
          {categories.slice(0, 3).map((c) => (
            <button
              className={filter === c ? "active" : ""}
              onClick={() => setFilter(c)}
              key={c}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="inline-search">
          <Search size={16} />
          <input
            aria-label={`Search ${kind}`}
            placeholder={`Search ${kind}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {isPending ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <div className="directory-grid">
          {items.map((item) =>
            org ? (
              <OrganizationCard org={item as Organization} key={item.id} />
            ) : (
              <CommunityCard community={item as Community} key={item.id} />
            ),
          )}
        </div>
      )}
      {data && !items.length && (
        <EmptyState
          icon={org ? Building2 : Users}
          title={
            filter === "mine"
              ? "Your next community is out there."
              : "A little further to look."
          }
          description="Try a different filter, or explore all the spaces available to you."
        >
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            Explore all {kind}
          </Button>
        </EmptyState>
      )}
      {org ? (
        <OrganizationForm open={create} onOpenChange={setCreate} />
      ) : (
        <CommunityForm open={create} onOpenChange={setCreate} />
      )}
    </div>
  );
}
export function OrganizationForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { refresh } = useApp(),
    toast = useToast(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="A home for your organization"
      description="Tell us about your people. We’ll review the organization before verification."
    >
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const input = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api<{ id: string }>("organizations", input);
            await refresh();
            onOpenChange(false);
            toast("Your organization has been submitted for verification.");
            router.push(`/app/organizations/${result.id}`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Official organization name
          <input
            name="name"
            required
            minLength={3}
            maxLength={100}
            placeholder="The name your community knows"
          />
        </label>
        <label>
          Organization type
          <select name="type">
            {[
              "University",
              "College",
              "School",
              "Company",
              "Nonprofit",
              "Training institute",
              "Professional association",
              "Student society",
              "Community organization",
              "Startup",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          A little about your organization
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={2000}
            rows={4}
            placeholder="What brings your people together?"
          />
        </label>
        <div className="form-two-columns">
          <label>
            Location
            <input
              name="location"
              maxLength={100}
              placeholder="City, country"
            />
          </label>
          <label>
            Official website
            <input
              name="website"
              type="url"
              pattern="https://.*"
              placeholder="https://yourorganization.com"
            />
          </label>
        </div>
        <div className="info-notice">
          <ShieldCheck size={18} />
          <p>
            New organizations start with a free public listing. Private
            workspaces require verification and a plan or trial.
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy}>
          Request your organization space <ArrowUpRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
export function NewOrganizationPage() {
  const [open, setOpen] = useState(true);
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="A NEW PLACE TO BELONG"
        title="Bring your people together."
        description="Create your organization’s place on YouConect."
      />
      <Button onClick={() => setOpen(true)}>
        <Plus size={17} /> Create your organization
      </Button>
      <OrganizationForm open={open} onOpenChange={setOpen} />
    </div>
  );
}
function CommunityForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, refresh } = useApp(),
    toast = useToast(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Make room for your people"
      description="Start a community around something that matters to you."
    >
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const fields = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await api<{ id: string }>("communities", {
              ...fields,
              organization_id: fields.organization_id || null,
            });
            await refresh();
            onOpenChange(false);
            router.push(`/app/communities/${result.id}`);
            toast("Your community has a home.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Community name
          <input
            name="name"
            required
            minLength={3}
            maxLength={100}
            placeholder="Something that feels like your people"
          />
        </label>
        <label>
          What brings you together?
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={2000}
            rows={3}
          />
        </label>
        <div className="form-two-columns">
          <label>
            Interest
            <select name="category">
              {[
                "Design",
                "Technology",
                "Entrepreneurship",
                "Education",
                "Research",
                "Arts & Culture",
                "Volunteering",
                "General",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Visibility
            <select name="visibility">
              <option value="public">Public community</option>
              <option value="organization">Organization members</option>
              <option value="private">Invitation only</option>
            </select>
          </label>
        </div>
        <label>
          Organization
          <select name="organization_id">
            <option value="">Independent community</option>
            {data.organizations
              .filter((o) => ["owner", "admin"].includes(o.role || ""))
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy}>
          Create your community <ArrowUpRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
export function OrganizationDetail({ id }: { id: string }) {
  const { data, error, isPending } = useResource<{
    organization: Organization;
    departments: { id: string; name: string }[];
    channels: {
      id: string;
      name: string;
      description: string;
      announcements_only: boolean;
      joined: boolean;
    }[];
  }>(`organizations/${id}`);
  const { data: app, refresh, setSelectedOrg } = useApp(),
    toast = useToast(),
    router = useRouter();
  const [tab, setTab] = useState("Posts"),
    [busy, setBusy] = useState(false);
  const { data: members } = useResource<{ items: User[] }>(
    tab === "People" ? `organizations/${id}/members` : null,
  );
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} />;
  const o = data.organization,
    joined = o.membership_status === "active",
    admin = ["owner", "admin"].includes(o.role || "");
  return (
    <div className="standard-page organization-detail">
      <Link className="back-link" href="/app/organizations">
        <ArrowLeft size={16} /> Your organizations
      </Link>
      <div className={`organization-hero tone-${o.color}`}>
        <span className="organization-cover-grid" />
        <div className="organization-hero-text">
          {o.type.toUpperCase()}
          <strong>
            {o.name.split(" ")[0]}
            <span>Better, together.</span>
          </strong>
        </div>
        <span className="org-cover-icon">
          <Building2 size={100} strokeWidth={0.6} />
        </span>
      </div>
      <div className="organization-profile-header">
        <span className={`org-symbol org-symbol-xl tone-${o.color}`}>
          {o.initials}
        </span>
        <div>
          <div className="row">
            <h1>{o.name}</h1>
            {o.verified && <Verified demo={app.demo} />}
          </div>
          <p>
            {o.type} <span>·</span> {o.location}
          </p>
          <span className="muted">
            <Users size={14} /> {o.member_count} members
          </span>
        </div>
        <div className="organization-profile-actions">
          {joined ? (
            <>
              {admin && (
                <ButtonLink href={`/app/admin/${o.id}`} variant="secondary">
                  <Settings size={16} /> Manage organization
                </ButtonLink>
              )}
              <Button
                onClick={() => {
                  setSelectedOrg(o.id);
                  router.push("/app");
                }}
              >
                Enter your workspace <ArrowRight size={15} />
              </Button>
            </>
          ) : o.membership_status === "pending" ? (
            <Badge color="amber">
              <Clock3 size={14} /> Membership request pending
            </Badge>
          ) : (
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`organizations/${o.id}/join`, {});
                  await refresh();
                  toast("Your membership request is with the organization.");
                } catch (e) {
                  toast((e as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Request to join <Plus size={16} />
            </Button>
          )}
        </div>
      </div>
      {!o.verified && (
        <div className="info-notice">
          <ShieldCheck size={20} />
          <p>
            Your organization is awaiting verification. It is not shown as an
            officially verified organization.
          </p>
        </div>
      )}
      <div className="page-tabs" role="tablist">
        {[
          "Posts",
          "Communities",
          ...(joined ? ["Channels", "People"] : []),
          "About",
        ].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Posts" && (
        <div className="organization-feed">
          <div>
            {joined && (
              <QuickComposer
                scope={{ organization_id: o.id, audience: "organization" }}
              />
            )}
            <PostFeed organization={o.id} />
          </div>
          <aside className="organization-about card">
            <span className="eyebrow">A LITTLE ABOUT US</span>
            <h3>{o.name}</h3>
            <p>{o.description}</p>
            <span>
              <MapPin size={15} />
              {o.location || "Connected from everywhere"}
            </span>
            {o.website && (
              <a href={o.website} target="_blank" rel="noreferrer">
                <Globe2 size={15} /> Official website <ArrowUpRight size={13} />
              </a>
            )}
            {joined && (
              <Badge color="teal">
                <Check size={12} /> You belong here
              </Badge>
            )}
          </aside>
        </div>
      )}
      {tab === "Communities" && (
        <div className="directory-grid">
          {app.communities
            .filter((c) => c.organization_id === o.id)
            .map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
        </div>
      )}
      {tab === "Channels" && (
        <div className="channel-directory">
          {data.channels.map((c) => (
            <div className="channel-row card" key={c.id}>
              <span className="feature-icon tone-blue">
                <Hash size={22} />
              </span>
              <div>
                <h3>{c.name}</h3>
                <p>
                  {c.announcements_only
                    ? "Official announcements from your organization"
                    : c.description ||
                      "A space for your organization’s conversations."}
                </p>
              </div>
              {c.joined ? (
                <ButtonLink variant="secondary" href={`/app/messages/${c.id}`}>
                  Open channel <ArrowUpRight size={15} />
                </ButtonLink>
              ) : (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await api(
                        `organizations/${o.id}/channels/${c.id}/join`,
                        {},
                      );
                      await refresh();
                      router.push(`/app/messages/${c.id}`);
                    } catch (e) {
                      toast((e as Error).message, "error");
                    }
                  }}
                >
                  Join channel <Plus size={15} />
                </Button>
              )}
            </div>
          ))}
          {!data.channels.length && (
            <EmptyState
              icon={Hash}
              title="A little room for conversation."
              description="Your administrators haven’t created any channels yet."
            />
          )}
        </div>
      )}
      {tab === "People" && (
        <div className="people-grid">
          {members?.items.map((p) => (
            <Link
              className="person-card card"
              key={p.id}
              href={`/app/profile/${p.id}`}
            >
              <Avatar name={p.name} color={p.avatar} size="lg" />
              <h3>{p.name}</h3>
              <p>{p.headline}</p>
              <span className="text-link">
                Meet {p.name.split(" ")[0]} <ArrowUpRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      )}
      {tab === "About" && (
        <div className="card about-detail">
          <h2>A place for {o.name}.</h2>
          <p>{o.description}</p>
          <h3>Departments</h3>
          {data.departments.map((d) => (
            <Badge key={d.id} color={o.color}>
              {d.name}
            </Badge>
          ))}
          {!data.departments.length && (
            <p className="muted">
              Department details are available to organization members when
              configured.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export function CommunityDetail({ id }: { id: string }) {
  const { data, error, isPending } = useResource<{ community: Community }>(
    `communities/${id}`,
  );
  const { refresh } = useApp(),
    toast = useToast();
  const [busy, setBusy] = useState(false);
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} />;
  const c = data.community;
  const Icon = communityIcons[c.icon] || Users;
  return (
    <div className="content-with-context">
      <div className="feed-column">
        <Link className="back-link" href="/app/communities">
          <ArrowLeft size={16} /> Your kind of people
        </Link>
        <div className={`community-detail-banner tone-${c.color}`}>
          <span className="community-art-grid" />
          <Icon size={64} />
          <span>
            GOOD THINGS
            <br />
            START TOGETHER.
          </span>
        </div>
        <div className="community-detail-header">
          <Badge color={c.color}>{c.category}</Badge>
          <h1>{c.name}</h1>
          <p>{c.description}</p>
          <div className="row between">
            <span className="muted">
              <Users size={14} /> {c.member_count} members
              {c.organization_name && ` · ${c.organization_name}`}
            </span>
            <Button
              variant={c.joined ? "secondary" : "primary"}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`communities/${id}/join`, { leave: c.joined });
                  await refresh();
                  toast(
                    c.joined
                      ? "You’ve left this community."
                      : `Welcome to ${c.name}.`,
                  );
                } catch (e) {
                  toast((e as Error).message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {c.joined ? (
                <>
                  <Check size={15} /> Joined · leave
                </>
              ) : (
                <>
                  <Plus size={15} /> Join your people
                </>
              )}
            </Button>
          </div>
        </div>
        {c.joined && (
          <QuickComposer
            scope={{
              community_id: c.id,
              organization_id: c.organization_id || undefined,
              audience: "community",
            }}
          />
        )}
        <PostFeed community={id} />
      </div>
      <ContextPanel />
    </div>
  );
}
export function ExplorePage() {
  const { data } = useApp();
  const { data: orgs } = useResource<{ items: Organization[] }>(
    "organizations",
  );
  const { data: people } = useResource<{
    groups: {
      title: string;
      items: {
        id: string;
        name: string;
        headline: string;
        avatar?: string;
        href: string;
      }[];
    }[];
  }>("search?q=a");
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="A WORLD OF POSSIBILITIES"
        title="A little curiosity goes a long way."
        description="People worth meeting. Communities worth finding. Ideas worth sharing."
      />
      <Link href="/app/search" className="explore-search">
        <Search size={21} />
        <span>What’s calling your curiosity?</span>
        <kbd>⌘ K</kbd>
        <ArrowRight size={19} />
      </Link>
      <section className="explore-section">
        <div className="section-row-heading">
          <div>
            <h2>Your people are out there.</h2>
            <p>A few communities to get you started.</p>
          </div>
          <Link className="text-link" href="/app/communities">
            Discover all <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="directory-grid">
          {data.communities.slice(0, 3).map((c) => (
            <CommunityCard community={c} key={c.id} />
          ))}
        </div>
      </section>
      <section className="explore-section">
        <div className="section-row-heading">
          <div>
            <h2>People with a little something in common.</h2>
            <p>Follow a fresh perspective or start a conversation.</p>
          </div>
        </div>
        <div className="people-grid">
          {data.suggestions.map((p) => (
            <Link
              className="person-card card"
              href={`/app/profile/${p.id}`}
              key={p.id}
            >
              <Avatar name={p.name} color={p.avatar} size="lg" />
              <h3>{p.name}</h3>
              <p>{p.headline}</p>
              <span className="text-link">
                Make a connection <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
          {!data.suggestions.length && (
            <EmptyState
              title="Your network is taking shape."
              description="Try search to discover people and ideas."
            />
          )}
        </div>
      </section>
      <section className="explore-section">
        <div className="section-row-heading">
          <div>
            <h2>Find your next place to belong.</h2>
            <p>Organizations that bring people together.</p>
          </div>
          <Link className="text-link" href="/app/organizations">
            Explore organizations <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="directory-grid">
          {orgs?.items.slice(0, 3).map((o) => (
            <OrganizationCard key={o.id} org={o} />
          ))}
        </div>
      </section>
    </div>
  );
}
