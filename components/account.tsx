"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UserRound,
  LockKeyhole,
  Sun,
  Moon,
  Monitor,
  Bell,
  ShieldCheck,
  Download,
  Trash2,
  Check,
  ArrowRight,
  ArrowUpRight,
  Pencil,
  MessageCircle,
  UserPlus,
  MoreHorizontal,
  Flag,
  Ban,
  Mail,
  Settings,
  Sparkles,
  CalendarDays,
  Network,
  Users,
  AlertCircle,
} from "lucide-react";
import { api, useResource, relativeTime, downloadJson } from "@/lib/client";
import type { User, Organization, Notice } from "@/lib/types";
import { useApp } from "./app-context";
import { PostFeed } from "./social";
import { MfaSettings } from "./mfa-settings";
import {
  SectionHeading,
  Button,
  ButtonLink,
  Avatar,
  Badge,
  Menu,
  IconButton,
  Modal,
  ErrorState,
  PageSkeleton,
  EmptyState,
  useToast,
} from "./ui";
export function ProfilePage({ id }: { id?: string }) {
  const { data: app, refresh } = useApp();
  const userId = id || app.user.id;
  const { data, error, isPending } = useResource<{
    user: User;
    organizations: Organization[];
    followers: number;
    following: number;
    followed: boolean;
  }>(`profiles/${userId}`);
  const [busy, setBusy] = useState(false),
    [block, setBlock] = useState(false);
  const router = useRouter(),
    toast = useToast();
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} />;
  const p = data.user,
    own = p.id === app.user.id;
  return (
    <div className="standard-page">
      <div className={`profile-cover tone-${p.avatar}`}>
        <p>ONE IDENTITY. A WORLD OF POSSIBILITIES.</p>
        <span>✦</span>
      </div>
      <div className="profile-header">
        <Avatar name={p.name} color={p.avatar} size="xl" />
        <div className="profile-header-main">
          <h1>{p.name}</h1>
          <p>{p.headline || "A curious human, making connections."}</p>
          <div className="profile-stats">
            <span>
              <b>{data.followers}</b> followers
            </span>
            <span>
              <b>{data.following}</b> following
            </span>
            <span>
              Joined{" "}
              {new Date(p.created_at).toLocaleDateString("en", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <div className="profile-actions">
          {own ? (
            <ButtonLink href="/app/settings" variant="secondary">
              <Pencil size={15} /> Make it more you
            </ButtonLink>
          ) : (
            <>
              <Button
                loading={busy}
                variant={data.followed ? "secondary" : "primary"}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`profiles/${p.id}/follow`, {
                      active: !data.followed,
                    });
                    await refresh();
                  } catch (e) {
                    toast((e as Error).message, "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {data.followed ? (
                  <>
                    <Check size={15} /> Following
                  </>
                ) : (
                  <>
                    <UserPlus size={15} /> Follow
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const result = await api<{ id: string }>("conversations", {
                      kind: "direct",
                      participants: [p.id],
                    });
                    router.push(`/app/messages/${result.id}`);
                  } catch (e) {
                    toast((e as Error).message, "error");
                  }
                }}
              >
                <MessageCircle size={15} /> Say hello
              </Button>
              <Menu
                trigger={
                  <IconButton icon={MoreHorizontal} label="Profile options" />
                }
                items={[
                  {
                    label: "Block this person",
                    icon: Ban,
                    danger: true,
                    onClick: () => setBlock(true),
                  },
                ]}
              />
            </>
          )}
        </div>
      </div>
      <div className="profile-layout">
        <aside className="profile-about card">
          <h3>A little about {own ? "you" : p.name.split(" ")[0]}.</h3>
          <p>{p.bio || "Every connection starts with a little curiosity."}</p>
          {p.interests?.length > 0 && (
            <>
              <h4>A FEW THINGS THAT SPARK CURIOSITY</h4>
              <div className="interest-chips">
                {p.interests.map((i) => (
                  <Badge color={p.avatar} key={i}>
                    {i}
                  </Badge>
                ))}
              </div>
            </>
          )}
          {data.organizations.length > 0 && (
            <>
              <h4>PLACES TO BELONG</h4>
              {data.organizations.map((o) => (
                <Link
                  className="profile-org-link"
                  href={`/app/organizations/${o.id}`}
                  key={o.id}
                >
                  <span className={`org-symbol tone-${o.color}`}>
                    {o.initials}
                  </span>
                  {o.name}
                </Link>
              ))}
            </>
          )}
          {own && (
            <p style={{ marginTop: 20, fontSize: 9 }}>
              <LockKeyhole size={11} /> Your memberships are private unless you
              choose to share them.
            </p>
          )}
        </aside>
        <div>
          <div className="page-tabs">
            <span className="profile-posts-title">
              Thoughts & shared moments
            </span>
          </div>
          <PostFeed author={p.id} />
        </div>
      </div>
      <Modal
        open={block}
        onOpenChange={setBlock}
        title={`Block ${p.name}?`}
        description="You won’t see each other’s posts or be able to send new messages to each other."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setBlock(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await api(`profiles/${p.id}/block`, {});
                await refresh();
                setBlock(false);
                router.push("/app");
                toast("This person is now blocked.");
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }}
          >
            Block person
          </Button>
        </div>
      </Modal>
    </div>
  );
}
function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="toggle"
      role="switch"
      type="button"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <i />
    </button>
  );
}
export function SettingsPage() {
  const { data, refresh } = useApp(),
    toast = useToast(),
    client = useQueryClient(),
    router = useRouter();
  const [tab, setTab] = useState("Your profile"),
    [avatar, setAvatar] = useState(data.user.avatar),
    [busy, setBusy] = useState(false),
    [theme, setTheme] = useState(
      typeof window !== "undefined"
        ? localStorage.getItem("yc-theme") || "system"
        : "system",
    ),
    [deleteOpen, setDeleteOpen] = useState(false),
    [resetLink, setResetLink] = useState(""),
    [resetOpen, setResetOpen] = useState(false),
    [error, setError] = useState("");
  const tabs = [
    { name: "Your profile", icon: UserRound },
    { name: "Privacy & connections", icon: LockKeyhole },
    { name: "Appearance", icon: Sun },
    { name: "Account & security", icon: ShieldCheck },
  ];
  async function privacy(key: string, value: unknown) {
    setBusy(true);
    try {
      await api(
        `profiles/${data.user.id}`,
        { privacy: { [key]: value } },
        "PATCH",
      );
      await refresh();
      toast("Your preference is saved.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="A little more you."
        description="Your profile, preferences, and the boundaries that feel right."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map((t) => (
            <button
              className={tab === t.name ? "active" : ""}
              key={t.name}
              onClick={() => {
                setTab(t.name);
                setError("");
              }}
            >
              <t.icon size={17} />
              {t.name}
            </button>
          ))}
        </nav>
        <div>
          {tab === "Your profile" && (
            <section className="card settings-card">
              <h2>Be a little more yourself.</h2>
              <p>A few details help the right people find you.</p>
              <div className="avatar-options">
                {["rose", "blue", "teal", "violet", "amber"].map((color) => (
                  <button
                    key={color}
                    className={avatar === color ? "selected" : ""}
                    onClick={() => setAvatar(color)}
                    aria-label={`${color} profile color`}
                    aria-pressed={avatar === color}
                  >
                    <Avatar name={data.user.name} color={color} size="lg" />
                  </button>
                ))}
              </div>
              <form
                className="stack-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  try {
                    await api(
                      `profiles/${data.user.id}`,
                      {
                        ...f,
                        avatar,
                        interests: String(f.interests)
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                      "PATCH",
                    );
                    await refresh();
                    toast("Looking a little more like you.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Your name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={data.user.name}
                  />
                </label>
                <label>
                  A few words about what you do
                  <input
                    name="headline"
                    maxLength={160}
                    defaultValue={data.user.headline}
                    placeholder="Student, builder, curious human…"
                  />
                </label>
                <label>
                  A little about you
                  <textarea
                    name="bio"
                    maxLength={2000}
                    rows={4}
                    defaultValue={data.user.bio}
                    placeholder="What brings you here? What lights you up?"
                  />
                </label>
                <label>
                  Things that spark your curiosity
                  <input
                    name="interests"
                    defaultValue={data.user.interests.join(", ")}
                    placeholder="Design, technology, community…"
                  />
                  <small>
                    Separate your interests with commas. Up to 15 interests.
                  </small>
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" loading={busy}>
                  Save your changes <Check size={16} />
                </Button>
              </form>
            </section>
          )}
          {tab === "Privacy & connections" && (
            <section className="card settings-card">
              <h2>Your boundaries. Your choice.</h2>
              <p>Choose what the rest of your world can see.</p>
              {[
                {
                  title: "Public profile",
                  description:
                    "Let anyone on YouConect discover your profile. Private profiles are visible only to you and people in a shared organization.",
                  key: "profile",
                  checked: data.user.privacy.profile === "public",
                  value:
                    data.user.privacy.profile === "public"
                      ? "private"
                      : "public",
                },
                {
                  title: "Show organization memberships",
                  description:
                    "Display your organizations on your profile. Memberships stay private by default.",
                  key: "showMemberships",
                  checked: data.user.privacy.showMemberships === true,
                  value: data.user.privacy.showMemberships !== true,
                },
                {
                  title: "Share typing activity",
                  description:
                    "Let conversation participants see when you are typing.",
                  key: "presence",
                  checked: data.user.privacy.presence !== false,
                  value: data.user.privacy.presence === false,
                },
                {
                  title: "Allow new conversations",
                  description:
                    "Let people include you in new direct or group conversations.",
                  key: "dmRequests",
                  checked: data.user.privacy.dmRequests !== false,
                  value: data.user.privacy.dmRequests === false,
                },
              ].map((p) => (
                <div className="preference-row" key={p.key}>
                  <div>
                    <strong>{p.title}</strong>
                    <p>{p.description}</p>
                  </div>
                  <Toggle
                    checked={p.checked}
                    label={p.title}
                    disabled={busy}
                    onChange={() => void privacy(p.key, p.value)}
                  />
                </div>
              ))}
              <div className="info-notice" style={{ marginTop: 23 }}>
                <ShieldCheck size={18} />
                <p>
                  Private organizational content stays inside its permitted
                  space, regardless of your public profile setting.
                </p>
              </div>
            </section>
          )}
          {tab === "Appearance" && (
            <section className="card settings-card">
              <h2>A view that feels like you.</h2>
              <p>Choose a theme, or let YouConect follow your device.</p>
              <div className="theme-options">
                {[
                  { key: "light", name: "Light", icon: Sun },
                  { key: "dark", name: "Dark", icon: Moon },
                  { key: "system", name: "Your device", icon: Monitor },
                ].map((t) => (
                  <button
                    key={t.key}
                    className={`theme-option ${theme === t.key ? "selected" : ""}`}
                    onClick={() => {
                      setTheme(t.key);
                      localStorage.setItem("yc-theme", t.key);
                      document.documentElement.dataset.theme =
                        t.key === "system"
                          ? window.matchMedia("(prefers-color-scheme: dark)")
                              .matches
                            ? "dark"
                            : "light"
                          : t.key;
                    }}
                    aria-pressed={theme === t.key}
                  >
                    <t.icon size={20} />
                    {t.name}
                    {theme === t.key && <Check size={13} />}
                  </button>
                ))}
              </div>
            </section>
          )}
          {tab === "Account & security" && (
            <>
              <section className="card settings-card">
                <h2>Your account, in good hands.</h2>
                <p>Account information and a few ways to keep things secure.</p>
                <div className="preference-row">
                  <div>
                    <strong>{data.user.email}</strong>
                    <p>
                      {data.user.email_verified
                        ? "Your email address is verified."
                        : "Verify your email to unlock publishing and communication."}
                    </p>
                  </div>
                  <Badge color={data.user.email_verified ? "teal" : "amber"}>
                    {data.user.email_verified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
                <div className="preference-row">
                  <div>
                    <strong>Reset your password</strong>
                    <p>We’ll send a recovery link to your account email.</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const result = await api<{ devResetUrl?: string }>(
                          "auth/forgot-password",
                          { email: data.user.email },
                        );
                        setResetLink(result.devResetUrl || "");
                        setResetOpen(true);
                      } catch (e) {
                        toast((e as Error).message, "error");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Send link <Mail size={14} />
                  </Button>
                </div>
                <div className="preference-row">
                  <div>
                    <strong>Take your data with you</strong>
                    <p>
                      Download your profile, posts, messages, memberships, and
                      registrations as JSON.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      try {
                        downloadJson(
                          "youconect-account-export.json",
                          await api("account/export"),
                        );
                        toast("Your account export is ready.");
                      } catch (e) {
                        toast((e as Error).message, "error");
                      }
                    }}
                  >
                    <Download size={14} /> Export
                  </Button>
                </div>
                <MfaSettings />
                <p className="account-security-note">
                  Sessions use secure cookies and server-side revocation.
                  Passwords are hashed with scrypt. Authenticator MFA is
                  available and enforced for production administration.
                  End-to-end encryption is not implemented.
                </p>
              </section>
              <section className="card settings-card settings-danger">
                <h2>A bigger change.</h2>
                <p>
                  Deleting your account removes your personal data and content.
                  Organization owners must transfer ownership first.
                </p>
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  <Trash2 size={15} /> Delete your account
                </Button>
              </section>
            </>
          )}
        </div>
      </div>
      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Leave YouConect?"
        description="Your account, posts, messages, and memberships will be removed. This action cannot be undone."
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (f.get("confirm") !== "DELETE") return;
            setBusy(true);
            try {
              await api("account", {}, "DELETE");
              client.clear();
              router.push("/");
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Type DELETE to confirm
            <input
              name="confirm"
              required
              pattern="DELETE"
              placeholder="DELETE"
              autoComplete="off"
            />
          </label>
          <Button type="submit" variant="danger" loading={busy}>
            Delete my account
          </Button>
        </form>
      </Modal>
      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Check your inbox"
        description="If an account exists, a password recovery link has been sent."
      >
        {resetLink && (
          <div className="dev-mail-notice" style={{ marginTop: 20 }}>
            <Badge color="amber">Local development email</Badge>
            <p>
              No external email was sent. Open the link from the development
              outbox below.
            </p>
            <a className="button button-secondary" href={resetLink}>
              Open recovery link <ArrowRight size={15} />
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}
export function NotificationsPage() {
  const { data, error, isPending } = useResource<{ items: Notice[] }>(
    "notifications",
  );
  const { refresh } = useApp(),
    router = useRouter(),
    toast = useToast();
  const [filter, setFilter] = useState("All");
  const items = data?.items.filter((n) => filter === "All" || !n.read_at);
  const icons: Record<string, typeof Bell> = {
    comment: MessageCircle,
    event: CalendarDays,
    bridge: Network,
    membership: Users,
    welcome: Sparkles,
  };
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="A LITTLE UPDATE FROM YOUR WORLD"
        title="You’re in the loop."
        description="The conversations, connections, and moments that matter."
      >
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await api("notifications", { all: true });
              await refresh();
              toast("You’re all caught up.");
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }}
        >
          <Check size={15} /> Mark all as read
        </Button>
      </SectionHeading>
      <div className="filter-pills" style={{ marginBottom: 23 }}>
        {["All", "Unread"].map((f) => (
          <button
            key={f}
            className={filter === f ? "active" : ""}
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
        <div className="notifications-list">
          {items?.map((n) => {
            const Icon = icons[n.kind] || Bell;
            return (
              <button
                className={`notification-item card ${!n.read_at ? "unread" : ""}`}
                style={{ textAlign: "left", width: "100%" }}
                key={n.id}
                onClick={async () => {
                  try {
                    await api(`notifications/${n.id}`, {});
                    await refresh();
                    router.push(n.href);
                  } catch (e) {
                    toast((e as Error).message, "error");
                  }
                }}
              >
                <span className="feature-icon tone-blue">
                  <Icon size={20} />
                </span>
                <div>
                  <h2>{n.title}</h2>
                  <p>{n.body}</p>
                  <time>{relativeTime(n.created_at)} ago</time>
                </div>
                {!n.read_at && <span />}
              </button>
            );
          })}
        </div>
      )}
      {items && !items.length && (
        <EmptyState
          icon={Bell}
          title="A little peace and quiet."
          description="You’re all caught up. We’ll keep you posted when something comes your way."
        />
      )}
    </div>
  );
}
