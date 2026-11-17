"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import {
  Home,
  Compass,
  Building2,
  Users,
  MessageCircle,
  CalendarDays,
  BriefcaseBusiness,
  Bookmark,
  Bell,
  Plus,
  Settings,
  Search,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  LogOut,
  Sun,
  Moon,
  PanelLeftClose,
  Menu as MenuIcon,
  Network,
  ShieldCheck,
  WifiOff,
  HelpCircle,
  X,
  Command,
  Check,
  UserRound,
  Sparkles,
} from "lucide-react";
import { api, useResource } from "@/lib/client";
import type { Bootstrap, Conversation } from "@/lib/types";
import { AppContext, useApp, type ComposerScope } from "./app-context";
import {
  Logo,
  BrandMark,
  Avatar,
  IconButton,
  Button,
  ButtonLink,
  Badge,
  Modal,
  Menu,
  PageSkeleton,
  ErrorState,
  Verified,
  useToast,
} from "./ui";
import { PostComposer } from "./social";
const navigation = [
  { label: "Home", path: "/app", icon: Home },
  { label: "Explore", path: "/app/explore", icon: Compass },
  { label: "My organizations", path: "/app/organizations", icon: Building2 },
  { label: "Communities", path: "/app/communities", icon: Users },
  { label: "Messages", path: "/app/messages", icon: MessageCircle },
  { label: "Events", path: "/app/events", icon: CalendarDays },
  {
    label: "Opportunities",
    path: "/app/opportunities",
    icon: BriefcaseBusiness,
  },
  { label: "Saved", path: "/app/saved", icon: Bookmark },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data, error, isPending, refetch } =
    useResource<Bootstrap>("bootstrap");
  const pathname = usePathname(),
    router = useRouter(),
    client = useQueryClient(),
    toast = useToast();
  const [selectedOrg, setOrg] = useState("all"),
    [compose, setCompose] = useState(false),
    [scope, setScope] = useState<ComposerScope>({}),
    [command, setCommand] = useState(false),
    [drawer, setDrawer] = useState(false),
    [orgMenu, setOrgMenu] = useState(false),
    [offline, setOffline] = useState(false),
    [socket, setSocket] = useState<Socket | null>(null),
    [connected, setConnected] = useState(false);
  const { data: conversations } = useResource<{ items: Conversation[] }>(
    data ? "conversations" : null,
  );
  const unread = conversations?.items.reduce((n, c) => n + c.unread, 0) || 0;
  useEffect(() => {
    if (error?.message === "Please sign in to continue.")
      router.replace("/login");
  }, [error, router]);
  useEffect(() => {
    const stored = localStorage.getItem("yc-organization");
    if (stored) setOrg(stored);
    const on = () => setOffline(!navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    if (
      data &&
      selectedOrg !== "all" &&
      !data.organizations.some((o) => o.id === selectedOrg)
    )
      setOrg("all");
  }, [data, selectedOrg]);
  useEffect(() => {
    setDrawer(false);
    setOrgMenu(false);
  }, [pathname]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  useEffect(() => {
    if (!data?.user.email_verified) return;
    const s = io({
      withCredentials: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    setSocket(s);
    s.on("connect", () => {
      setConnected(true);
      void client.invalidateQueries({ queryKey: ["conversations"] });
    });
    s.on("disconnect", () => setConnected(false));
    s.on("message", () => {
      void client.invalidateQueries({ queryKey: ["conversations"] });
    });
    s.on("notification", () => {
      void client.invalidateQueries({ queryKey: ["bootstrap"] });
      void client.invalidateQueries({ queryKey: ["notifications"] });
    });
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [data?.user.id, data?.user.email_verified, client]);
  async function refresh() {
    await client.invalidateQueries();
  }
  const setSelectedOrg = (id: string) => {
    setOrg(id);
    localStorage.setItem("yc-organization", id);
    setOrgMenu(false);
  };
  const openComposer = (nextScope: ComposerScope = {}) => {
    setScope(
      Object.keys(nextScope).length
        ? nextScope
        : selectedOrg !== "all"
          ? { organization_id: selectedOrg, audience: "organization" }
          : {},
    );
    setCompose(true);
  };
  if (isPending || (!data && !error))
    return (
      <div className="app-loading">
        <Logo />
        <PageSkeleton />
      </div>
    );
  if (error || !data)
    return (
      <div className="app-loading">
        <Logo />
        <ErrorState error={error} retry={() => void refetch()} />
        <ButtonLink href="/login" variant="secondary">
          Go to sign in
        </ButtonLink>
      </div>
    );
  const org = data.organizations.find((o) => o.id === selectedOrg),
    current = navigation.find((n) =>
      n.path === "/app" ? pathname === "/app" : pathname.startsWith(n.path),
    );
  const notifyCount = data.notifications.filter((n) => !n.read_at).length;
  const menuItems = [
    {
      label: "Your profile",
      icon: UserRound,
      onClick: () => router.push(`/app/profile/${data.user.id}`),
    },
    {
      label: "Account settings",
      icon: Settings,
      onClick: () => router.push("/app/settings"),
    },
    {
      label: "Help center",
      icon: HelpCircle,
      onClick: () => router.push("/help"),
    },
    ...(data.user.platform_role === "admin"
      ? [
          {
            label: "Platform administration",
            icon: ShieldCheck,
            onClick: () => router.push("/app/platform"),
          },
        ]
      : []),
    ...(data.demo
      ? [
          {
            label: "Switch demo person",
            icon: Users,
            onClick: () => router.push("/demo"),
          },
        ]
      : []),
    {
      label: "Log out",
      icon: LogOut,
      onClick: () =>
        void api("auth/logout", {})
          .then(() => {
            client.clear();
            router.push("/login");
          })
          .catch((e) => toast(e.message, "error")),
    },
  ];
  return (
    <AppContext.Provider
      value={{
        data,
        selectedOrg,
        setSelectedOrg,
        refresh,
        openComposer,
        socket,
        connected,
      }}
    >
      <div className="app-shell">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {drawer && (
          <button
            className="drawer-backdrop"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          />
        )}
        <aside className={`app-sidebar ${drawer ? "drawer-open" : ""}`}>
          <div className="sidebar-brand">
            <Logo />
            <button
              className="sidebar-close icon-button"
              aria-label="Close navigation"
              onClick={() => setDrawer(false)}
            >
              <X size={19} />
            </button>
          </div>
          <div className="org-switcher-wrap">
            <button
              className={`org-switcher ${orgMenu ? "is-open" : ""}`}
              onClick={() => setOrgMenu(!orgMenu)}
              aria-expanded={orgMenu}
            >
              <span
                className={`org-symbol ${org ? `tone-${org.color}` : "tone-blue"}`}
              >
                {org ? org.initials : <GlobeIcon />}
              </span>
              <span>
                <strong>{org?.name || "Your personal space"}</strong>
                <small>
                  {org ? "Organization workspace" : "All your worlds, together"}
                </small>
              </span>
              <ChevronDown size={15} />
            </button>
            {orgMenu && (
              <div className="org-switcher-menu">
                <span className="dropdown-label">SWITCH YOUR SPACE</span>
                <button onClick={() => setSelectedOrg("all")}>
                  <span className="org-symbol tone-blue">
                    <GlobeIcon />
                  </span>
                  <span>
                    Your personal space<small>All your connections</small>
                  </span>
                  {selectedOrg === "all" && <Check size={15} />}
                </button>
                {data.organizations.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setSelectedOrg(o.id);
                      toast(`You’re now in ${o.name}.`);
                    }}
                  >
                    <span className={`org-symbol tone-${o.color}`}>
                      {o.initials}
                    </span>
                    <span>
                      {o.name}
                      <small>
                        {o.role === "owner"
                          ? "Organization owner"
                          : o.role === "admin"
                            ? "Administrator"
                            : "Member"}
                      </small>
                    </span>
                    {selectedOrg === o.id && <Check size={15} />}
                  </button>
                ))}
                <Link href="/app/organizations">
                  <Plus size={15} /> Discover an organization
                </Link>
              </div>
            )}
          </div>
          <div className="nav-caption">YOUR EVERYDAY</div>
          <nav className="app-navigation" aria-label="Application navigation">
            {navigation.map((n) => (
              <Link
                href={n.path}
                className={
                  (
                    n.path === "/app"
                      ? pathname === "/app"
                      : pathname.startsWith(n.path)
                  )
                    ? "nav-item active"
                    : "nav-item"
                }
                key={n.path}
              >
                <n.icon size={20} />
                <span>{n.label}</span>
                {n.label === "Messages" && unread > 0 && (
                  <b className="nav-count">{unread > 99 ? "99+" : unread}</b>
                )}
                {n.label === "Home" && <span className="nav-active-dot" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-divider" />
          <div className="sidebar-community-heading">
            <span className="nav-caption">YOUR COMMUNITIES</span>
            <Link href="/app/communities" aria-label="Discover communities">
              <Plus size={15} />
            </Link>
          </div>
          <div className="sidebar-communities">
            {data.communities
              .filter((c) => c.joined)
              .slice(0, 3)
              .map((c) => (
                <Link href={`/app/communities/${c.id}`} key={c.id}>
                  <span className={`community-dot tone-${c.color}`} />
                  {c.name}
                </Link>
              ))}
            {!data.communities.some((c) => c.joined) && (
              <Link href="/app/communities">
                <span className="community-dot tone-blue" />
                Find your people
              </Link>
            )}
            <Link href="/app/bridges">
              <Network size={16} /> YouConect Bridges{" "}
              <span className="new-dot" />
            </Link>
          </div>
          <Button className="sidebar-create" onClick={() => openComposer()}>
            <Plus size={18} /> Create a post
          </Button>
          <div className="sidebar-bottom">
            <Link className="sidebar-settings" href="/app/settings">
              <Settings size={18} /> Settings & preferences
            </Link>
            <Menu
              trigger={
                <button className="sidebar-profile">
                  <Avatar name={data.user.name} color={data.user.avatar} />
                  <span>
                    <strong>{data.user.name}</strong>
                    <small>View your profile</small>
                  </span>
                  <ChevronDown size={15} />
                </button>
              }
              items={menuItems}
            />
          </div>
        </aside>
        <div className="app-body">
          <header className="app-topbar">
            <div className="app-breadcrumb">
              <button
                className="mobile-nav-toggle icon-button"
                aria-label="Open navigation"
                onClick={() => setDrawer(true)}
              >
                <MenuIcon size={21} />
              </button>
              <span>Your space</span>
              <span className="breadcrumb-slash">/</span>
              <strong>
                {current?.label ||
                  (pathname.includes("profile")
                    ? "Profile"
                    : pathname.includes("settings")
                      ? "Settings"
                      : pathname.includes("admin")
                        ? "Administration"
                        : pathname.includes("bridges")
                          ? "Bridges"
                          : "Your community")}
              </strong>
            </div>
            <button className="global-search" onClick={() => setCommand(true)}>
              <Search size={17} />
              <span>Search your world</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="topbar-actions">
              <span
                className={`live-indicator ${connected ? "is-live" : ""}`}
                title={
                  connected
                    ? "Real-time connection active"
                    : "Connecting to real-time service"
                }
              >
                <i />
                {connected ? "Connected" : "Connecting"}
              </span>
              <IconButton
                icon={Search}
                label="Search your world"
                className="mobile-search"
                onClick={() => setCommand(true)}
              />
              <button
                className="notification-button icon-button"
                onClick={() => router.push("/app/notifications")}
                aria-label={`Notifications, ${notifyCount} unread`}
              >
                <Bell size={20} />
                {notifyCount > 0 && <i />}
              </button>
              <div className="topbar-divider" />
              <Menu
                trigger={
                  <button
                    className="topbar-profile"
                    aria-label="Open account menu"
                  >
                    <Avatar
                      name={data.user.name}
                      color={data.user.avatar}
                      size="sm"
                    />
                  </button>
                }
                items={menuItems}
              />
            </div>
          </header>
          {offline && (
            <div className="offline-banner">
              <WifiOff size={16} /> You’re offline. Drafts stay on this device.
              Reconnect to sync your changes.
            </div>
          )}
          {data.demo && (
            <div className="demo-banner">
              <span>
                <Sparkles size={13} /> DEMO SPACE <i /> Fictional people. Real
                connections to try.
              </span>
              <Link href="/demo">
                Switch perspective <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          {!data.user.email_verified && (
            <div className="verification-banner">
              <ShieldCheck size={16} /> Verify your email before publishing,
              joining organizations, or messaging.
              <Link href="/verify-email">
                Verify email <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <main
            id="main-content"
            className={`app-main ${pathname.includes("/messages") ? "messages-main" : ""}`}
          >
            {children}
          </main>
        </div>
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {[
            { icon: Home, path: "/app", label: "Home" },
            { icon: Compass, path: "/app/explore", label: "Explore" },
            { icon: Plus, path: "create", label: "Create" },
            { icon: MessageCircle, path: "/app/messages", label: "Messages" },
            {
              icon: UserRound,
              path: `/app/profile/${data.user.id}`,
              label: "Profile",
            },
          ].map((n) =>
            n.path === "create" ? (
              <button
                className="mobile-create"
                onClick={() => openComposer()}
                key={n.path}
                aria-label="Create a post"
              >
                <n.icon size={23} />
              </button>
            ) : (
              <Link
                className={
                  pathname === n.path ||
                  (n.label === "Messages" && pathname.startsWith(n.path))
                    ? "active"
                    : ""
                }
                href={n.path}
                key={n.path}
              >
                <n.icon size={21} />
                <span>{n.label}</span>
              </Link>
            ),
          )}
        </nav>
        <CommandMenu open={command} onOpenChange={setCommand} />
        <PostComposer open={compose} onOpenChange={setCompose} scope={scope} />
      </div>
    </AppContext.Provider>
  );
}
function GlobeIcon() {
  return <Compass size={20} />;
}
type SearchResult = {
  id: string;
  name: string;
  href: string;
  headline?: string;
  category?: string;
  type?: string;
};
function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [input, setInput] = useState(""),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const router = useRouter();
  const { data, isFetching, error } = useResource<{
    groups: { title: string; items: SearchResult[] }[];
  }>(
    open && query.length >= 2 ? `search?q=${encodeURIComponent(query)}` : null,
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input);
      setActive(0);
    }, 220);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    if (!open) {
      setInput("");
      setQuery("");
    }
  }, [open]);
  const quick: SearchResult[] = navigation.map((n) => ({
    id: n.path,
    name: n.label,
    href: n.path,
  }));
  const groups =
    query.length >= 2
      ? data?.groups || []
      : [{ title: "Go somewhere", items: quick }];
  const flat = groups.flatMap((g) => g.items);
  let offset = 0;
  function go(item: SearchResult) {
    onOpenChange(false);
    router.push(item.href);
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Find your next connection"
      description="Search across the people and spaces you can access."
      wide
    >
      <div className="command-input">
        <Search size={20} />
        <input
          autoFocus
          value={input}
          placeholder="People, posts, communities, conversations…"
          onChange={(e) => setInput(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={flat[active] ? `result-${active}` : undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, flat.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
            if (e.key === "Enter" && flat[active]) {
              e.preventDefault();
              go(flat[active]);
            }
          }}
        />
        {isFetching ? <span className="command-loading" /> : <kbd>esc</kbd>}
      </div>
      <div id="command-results" className="command-results" role="listbox">
        {error && <ErrorState error={error} />}
        <>
          {groups.map((group) => {
            const start = offset;
            offset += group.items.length;
            return (
              <div className="command-group" key={group.title}>
                <span>{group.title}</span>
                {group.items.map((item, i) => (
                  <button
                    role="option"
                    aria-selected={active === start + i}
                    id={`result-${start + i}`}
                    className={active === start + i ? "selected" : ""}
                    key={item.id}
                    onMouseEnter={() => setActive(start + i)}
                    onClick={() => go(item)}
                  >
                    <Search size={16} />
                    <div>
                      <strong>{item.name}</strong>
                      {item.headline && <small>{item.headline}</small>}
                    </div>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            );
          })}
        </>
        {query.length >= 2 && !isFetching && !flat.length && (
          <div className="command-empty">
            No matches in the spaces you can access. Try another word.
          </div>
        )}
      </div>
      <div className="command-footer">
        <span>
          <ShieldCheck size={12} /> Only your permitted content
        </span>
        <span>
          ↑↓ navigate <kbd>↵</kbd> open
        </span>
      </div>
    </Modal>
  );
}
export function ContextPanel() {
  const { data, setSelectedOrg } = useApp();
  const events = data.events
    .filter((e) => new Date(e.starts_at) > new Date())
    .slice(0, 2);
  return (
    <aside className="context-panel">
      <section className="context-section">
        <div className="context-heading">
          <h3>Your organizations</h3>
          <Link href="/app/organizations" aria-label="Discover organizations">
            <Plus size={17} />
          </Link>
        </div>
        {data.organizations.slice(0, 3).map((o) => (
          <Link
            className="context-org"
            href={`/app/organizations/${o.id}`}
            key={o.id}
            onClick={() => setSelectedOrg(o.id)}
          >
            <span className={`org-symbol tone-${o.color}`}>{o.initials}</span>
            <div>
              <strong>
                {o.name} {o.verified && <Verified demo={data.demo} />}
              </strong>
              <small>{o.type}</small>
            </div>
            <ArrowUpRight size={15} />
          </Link>
        ))}
        {!data.organizations.length && (
          <p className="muted">Your next community could be one click away.</p>
        )}
        <Link href="/app/organizations" className="context-view-link">
          Explore organizations <ArrowRight size={14} />
        </Link>
      </section>
      <section className="context-section">
        <div className="context-heading">
          <h3>A little something ahead</h3>
          <Link href="/app/events" aria-label="View all events">
            <ArrowUpRight size={16} />
          </Link>
        </div>
        {events.map((e, i) => (
          <Link
            className="context-event"
            href={`/app/events/${e.id}`}
            key={e.id}
          >
            <div
              className={`context-event-art event-art-${e.cover || "design"}`}
            >
              <span className="event-art-orbit" />
              <span className="event-art-shape" />
              <span className="event-art-cross">✦</span>
              <Badge color={e.color}>{e.category}</Badge>
              <span className="event-art-word">
                {i === 0 ? (
                  <>
                    THINK.
                    <br />
                    MAKE.
                    <br />
                    CONNECT.
                  </>
                ) : (
                  <>
                    GOOD THINGS
                    <br />
                    HAPPEN
                    <br />
                    TOGETHER.
                  </>
                )}
              </span>
            </div>
            <div className="context-event-description">
              <strong>{e.title}</strong>
              <span>
                <CalendarDays size={13} />
                {new Date(e.starts_at).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                <i /> {e.location.split(" · ")[0]}
              </span>
            </div>
          </Link>
        ))}
      </section>
      <section className="context-section suggestions">
        <div className="context-heading">
          <h3>A few new faces</h3>
          <Link href="/app/explore">See all</Link>
        </div>
        {data.suggestions.slice(0, 3).map((p) => (
          <div className="context-person" key={p.id}>
            <Link href={`/app/profile/${p.id}`}>
              <Avatar name={p.name} color={p.avatar} size="sm" />
            </Link>
            <Link href={`/app/profile/${p.id}`}>
              <strong>{p.name}</strong>
              <small>{p.headline}</small>
            </Link>
            <Link
              className="connect-person"
              aria-label={`View ${p.name}'s profile`}
              href={`/app/profile/${p.id}`}
            >
              <Plus size={17} />
            </Link>
          </div>
        ))}
      </section>
      <div className="context-footer">
        <div>
          <Link href="/about">About</Link>
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <span>
          © {new Date().getFullYear()} YouConect <span>✦</span> Connect beyond
          boundaries.
        </span>
      </div>
    </aside>
  );
}
