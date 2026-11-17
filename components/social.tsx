"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Globe2,
  LockKeyhole,
  ImagePlus,
  ChartNoAxesColumnIncreasing,
  Smile,
  Paperclip,
  ChevronDown,
  ArrowDown,
  ArrowUpRight,
  Plus,
  Check,
  Link as LinkIcon,
  Flag,
  Pencil,
  Trash2,
  X,
  FileText,
  Sparkles,
  Users,
  Network,
  Pin,
  ArrowLeft,
  Search,
  Compass,
  SlidersHorizontal,
} from "lucide-react";
import { api, useResource, relativeTime } from "@/lib/client";
import type { Post, Comment } from "@/lib/types";
import { useApp, type ComposerScope } from "./app-context";
import { ContextPanel } from "./app-shell";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  IconButton,
  Menu,
  Modal,
  Verified,
  EmptyState,
  ErrorState,
  PageSkeleton,
  SectionHeading,
  useToast,
} from "./ui";
export function FeedPage({ saved = false }: { saved?: boolean }) {
  const { data, selectedOrg, openComposer } = useApp();
  const [tab, setTab] = useState(saved ? "saved" : "foryou");
  const name = data.user.name.split(" ")[0];
  return (
    <div className="content-with-context">
      <div className="feed-column">
        <div className="feed-heading">
          <div>
            <span className="eyebrow">
              {saved
                ? "A LITTLE INSPIRATION, KEPT CLOSE"
                : "YOUR WORLD, A LITTLE CLOSER"}
            </span>
            <h1>
              {saved ? (
                "Worth coming back to."
              ) : (
                <>
                  Good to see you, {name}{" "}
                  <span className="greeting-sun">☀</span>
                </>
              )}
            </h1>
            <p>
              {saved
                ? "Your saved ideas, conversations, and things that matter."
                : "A few familiar faces. A fresh perspective. Something to look forward to."}
            </p>
          </div>
        </div>
        {!saved && (
          <>
            <div className="connection-banner">
              <div className="connection-banner-copy">
                <span className="banner-eyebrow">
                  <span /> ONE YOU. ENDLESS POSSIBILITIES.
                </span>
                <h2>
                  Your next good thing
                  <br />
                  could start with a connection.
                </h2>
                <Link href="/app/explore">
                  See what’s out there <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="banner-visual">
                <div className="banner-ring ring-one" />
                <div className="banner-ring ring-two" />
                <div className="banner-avatar">
                  <Avatar
                    name={data.user.name}
                    color={data.user.avatar}
                    size="lg"
                  />
                </div>
                <span className="banner-symbol symbol-one tone-violet">
                  <Sparkles size={18} />
                </span>
                <span className="banner-symbol symbol-two tone-blue">
                  <Users size={18} />
                </span>
                <span className="banner-symbol symbol-three tone-teal">
                  <MessageCircle size={17} />
                </span>
                <span className="banner-star">✦</span>
              </div>
            </div>
            <QuickComposer />
          </>
        )}
        <div className="feed-tabs" role="tablist" aria-label="Feed categories">
          {(saved
            ? [["saved", "Saved posts"]]
            : [
                ["foryou", "For you"],
                ["following", "Following"],
                ["organizations", "My organizations"],
                ["communities", "Communities"],
              ]
          ).map(([key, label]) => (
            <button
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
              key={key}
            >
              {label}
            </button>
          ))}
          <span className="feed-sort" title="Chronological · newest first">
            <SlidersHorizontal size={15} />
            <span>Latest first</span>
          </span>
        </div>
        <PostFeed
          mode={saved ? "saved" : tab}
          organization={selectedOrg === "all" ? undefined : selectedOrg}
        />
        {saved && (
          <div className="saved-opportunities-callout">
            <Bookmark size={22} />
            <div>
              <h3>Keeping an eye on your next chapter?</h3>
              <p>Saved opportunities live in your opportunity feed.</p>
            </div>
            <ButtonLink
              href="/app/opportunities?saved=true"
              variant="secondary"
            >
              View opportunities <ArrowRightSmall />
            </ButtonLink>
          </div>
        )}
      </div>
      <ContextPanel />
    </div>
  );
}
function ArrowRightSmall() {
  return <ArrowUpRight size={15} />;
}
export function QuickComposer({ scope = {} }: { scope?: ComposerScope }) {
  const { data, openComposer } = useApp();
  return (
    <div className="quick-composer card">
      <div className="quick-composer-top">
        <Avatar name={data.user.name} color={data.user.avatar} />
        <button onClick={() => openComposer(scope)}>
          What’s on your mind, {data.user.name.split(" ")[0]}?
          <span>Share a little of your world.</span>
        </button>
        <button
          className="quick-add"
          onClick={() => openComposer(scope)}
          aria-label="Create a post"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="quick-composer-tools">
        <button onClick={() => openComposer(scope)}>
          <ImagePlus size={17} className="teal-text" /> Photo / media
        </button>
        <button onClick={() => openComposer(scope)}>
          <ChartNoAxesColumnIncreasing size={17} className="violet-text" /> Poll
        </button>
        <button onClick={() => openComposer(scope)}>
          <FileText size={17} className="amber-text" /> Share a thought
        </button>
        <span>
          <Globe2 size={13} /> Your audience. Your choice.
        </span>
      </div>
    </div>
  );
}
export function PostFeed({
  mode = "foryou",
  organization,
  community,
  bridge,
  author,
}: {
  mode?: string;
  organization?: string;
  community?: string;
  bridge?: string;
  author?: string;
}) {
  const params = new URLSearchParams({ mode });
  if (organization) params.set("organization", organization);
  if (community) params.set("community", community);
  if (bridge) params.set("bridge", bridge);
  if (author) params.set("author", author);
  const path = `posts?${params}`;
  const {
    data,
    error,
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [path],
    queryFn: ({ pageParam }) =>
      api<{ items: Post[]; nextCursor: string | null }>(
        `${path}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30000,
  });
  if (isPending) return <PageSkeleton />;
  if (error) return <ErrorState error={error} />;
  const posts = data?.pages.flatMap((p) => p.items) || [];
  return (
    <div className="post-feed">
      {posts.map((post) => (
        <PostCard post={post} key={post.id} />
      ))}
      {!posts.length && (
        <EmptyState
          icon={mode === "saved" ? Bookmark : MessageCircle}
          title={
            mode === "saved"
              ? "Keep a little inspiration."
              : "A little quiet here, for now."
          }
          description={
            mode === "saved"
              ? "Save a post and it will be waiting here whenever you need it."
              : "Follow someone, join a community, or share a thought to start a conversation."
          }
        >
          <ButtonLink href="/app/explore" variant="secondary">
            Find your next connection <ArrowUpRight size={15} />
          </ButtonLink>
        </EmptyState>
      )}
      {hasNextPage && (
        <Button
          className="load-more"
          variant="secondary"
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          A little more inspiration <ArrowDown size={15} />
        </Button>
      )}
      {posts.length > 0 && !hasNextPage && (
        <div className="feed-end">
          <span>✦</span>
          <strong>You’re all caught up.</strong>
          <p>A good moment to make a connection.</p>
        </div>
      )}
    </div>
  );
}
export function PostCard({
  post,
  expanded = false,
}: {
  post: Post;
  expanded?: boolean;
}) {
  const { data } = useApp(),
    client = useQueryClient(),
    toast = useToast();
  const [liked, setLiked] = useState(post.liked),
    [saved, setSaved] = useState(post.saved),
    [count, setCount] = useState(post.reaction_count),
    [commentOpen, setCommentOpen] = useState(expanded),
    [editOpen, setEditOpen] = useState(false),
    [reportOpen, setReportOpen] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [content, setContent] = useState(post.content),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    setLiked(post.liked);
    setSaved(post.saved);
    setCount(post.reaction_count);
    setContent(post.content);
  }, [post.liked, post.saved, post.reaction_count, post.content]);
  async function like() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await api(`posts/${post.id}/reaction`, { active: next });
    } catch (e) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
      toast((e as Error).message, "error");
    }
  }
  async function save() {
    const next = !saved;
    setSaved(next);
    try {
      await api(`posts/${post.id}/save`, { active: next });
      toast(
        next ? "Saved for a little later." : "Removed from your saved posts.",
      );
      void client.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).includes("mode=saved"),
      });
    } catch (e) {
      setSaved(!next);
      toast((e as Error).message, "error");
    }
  }
  const menu = [
    {
      label: "Copy permitted post link",
      icon: LinkIcon,
      onClick: () => {
        void navigator.clipboard
          .writeText(`${window.location.origin}/app/post/${post.id}`)
          .then(() => toast("Link copied. Viewers still need permission."))
          .catch(() => toast("Couldn’t copy this link.", "error"));
      },
    },
    {
      label: saved ? "Remove from saved" : "Save for later",
      icon: Bookmark,
      onClick: () => void save(),
    },
    ...(post.author_id === data.user.id
      ? [
          {
            label: "Edit post",
            icon: Pencil,
            onClick: () => setEditOpen(true),
          },
          {
            label: "Delete post",
            icon: Trash2,
            danger: true,
            onClick: () => setDeleteOpen(true),
          },
        ]
      : [
          {
            label: "Report this post",
            icon: Flag,
            onClick: () => setReportOpen(true),
          },
        ]),
  ];
  return (
    <article
      className={`post-card card ${post.official ? "official-post" : ""}`}
      id={`post-${post.id}`}
    >
      {post.official && (
        <div className="official-label">
          <Pin size={12} /> OFFICIAL ORGANIZATION UPDATE
        </div>
      )}
      <div className="post-header">
        <Link href={`/app/profile/${post.author_id}`}>
          <Avatar name={post.author_name} color={post.author_avatar} />
        </Link>
        <div className="post-author">
          <Link href={`/app/profile/${post.author_id}`}>
            <strong>{post.author_name}</strong>
            {post.official && <Verified demo={data.demo} />}
          </Link>
          <div>
            {post.organization_name ? (
              <Link href={`/app/organizations/${post.organization_id}`}>
                {post.organization_name}
              </Link>
            ) : post.community_name ? (
              <Link href={`/app/communities/${post.community_id}`}>
                {post.community_name}
              </Link>
            ) : (
              <span>{post.author_headline}</span>
            )}
            <span className="meta-dot">·</span>
            <Link href={`/app/post/${post.id}`}>
              {relativeTime(post.created_at)}
            </Link>
            <span className="meta-dot">·</span>
            {post.audience === "public" ? (
              <Globe2 size={12} />
            ) : (
              <LockKeyhole size={12} />
            )}
          </div>
        </div>
        <Menu
          trigger={
            <IconButton
              icon={MoreHorizontal}
              label={`More options for ${post.author_name}'s post`}
            />
          }
          items={menu}
        />
      </div>
      {post.community_name && post.organization_name && (
        <Link
          className="post-community-label"
          href={`/app/communities/${post.community_id}`}
        >
          <Users size={12} />
          {post.community_name}
        </Link>
      )}
      <div className="post-body">
        <RichContent text={post.content} />
      </div>
      {post.media.length > 0 && (
        <div
          className={`post-media ${post.media.length > 1 ? "media-grid" : ""}`}
        >
          {post.media.map((m, i) => {
            const src =
              m === "/campus-community.webp" ||
              m.startsWith("https://images.unsplash.com/")
                ? "/campus-community.webp"
                : `/api/uploads/${m}`;
            return (
              <a
                key={m}
                href={src}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open attachment ${i + 1}`}
              >
                <img
                  src={src}
                  alt={`Photo shared by ${post.author_name}`}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.parentElement!.classList.add(
                      "attachment-fallback",
                    );
                    e.currentTarget.parentElement!.textContent =
                      "Open attached file ↗";
                  }}
                />
              </a>
            );
          })}
        </div>
      )}
      {post.poll && <Poll post={post} />}
      <div className="post-engagement">
        <div className="post-reaction-summary">
          {count > 0 && (
            <>
              <span className="reaction-heart">
                <Heart size={11} fill="currentColor" />
              </span>
              <span>
                {liked
                  ? "You" +
                    (count > 1
                      ? ` and ${count - 1} other${count > 2 ? "s" : ""}`
                      : "")
                  : count}{" "}
                {count === 1 && !liked ? "connection" : ""}
              </span>
            </>
          )}
        </div>
        <button onClick={() => setCommentOpen(!commentOpen)}>
          {post.comment_count}{" "}
          {post.comment_count === 1 ? "comment" : "comments"}
        </button>
      </div>
      <div className="post-actions">
        <button
          className={liked ? "is-liked" : ""}
          onClick={() => void like()}
          aria-pressed={liked}
        >
          <Heart size={20} fill={liked ? "currentColor" : "none"} />
          <span>{liked ? "Liked" : "Like"}</span>
        </button>
        <button
          className={commentOpen ? "active" : ""}
          onClick={() => setCommentOpen(!commentOpen)}
        >
          <MessageCircle size={20} />
          <span>Comment</span>
        </button>
        <button
          onClick={() => {
            void navigator.clipboard
              .writeText(`${window.location.origin}/app/post/${post.id}`)
              .then(() => {
                setCopied(true);
                toast("Link copied. Access permissions still apply.");
                setTimeout(() => setCopied(false), 2500);
              })
              .catch(() => toast("Couldn’t copy this link.", "error"));
          }}
        >
          <Send size={19} />
          <span>{copied ? "Copied" : "Share"}</span>
        </button>
        <button
          className={saved ? "is-saved" : ""}
          onClick={() => void save()}
          aria-pressed={saved}
          aria-label={saved ? "Unsave post" : "Save post"}
        >
          <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      {commentOpen && <CommentThread postId={post.id} />}
      <Modal open={editOpen} onOpenChange={setEditOpen} title="A little edit">
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`posts/${post.id}`, { content }, "PATCH");
              await client.invalidateQueries();
              setEditOpen(false);
              toast("Your post is updated.");
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Your post
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={7}
              maxLength={12000}
              required
            />
          </label>
          <Button type="submit" loading={busy}>
            Save changes
          </Button>
        </form>
      </Modal>
      <Modal
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="Help keep this a good place"
        description="Tell the moderation team what needs a closer look."
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const reason = new FormData(e.currentTarget).get("reason");
            try {
              await api(`posts/${post.id}/report`, { reason });
              toast("Your report has been sent for review.");
              setReportOpen(false);
            } catch (e) {
              toast((e as Error).message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            What’s the concern?
            <textarea
              name="reason"
              required
              minLength={5}
              maxLength={1000}
              rows={4}
            />
          </label>
          <Button loading={busy} type="submit">
            Submit report
          </Button>
        </form>
      </Modal>
      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this post?"
        description="This removes the post and its comments. This action cannot be undone."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            Keep post
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`posts/${post.id}`, {}, "DELETE");
                await client.invalidateQueries();
                setDeleteOpen(false);
                toast("Post deleted.");
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete post
          </Button>
        </div>
      </Modal>
    </article>
  );
}
function RichContent({ text }: { text: string }) {
  const parts = text.split(
    /(#[\p{L}\p{N}_]+|https?:\/\/[^\s]+|\*\*[^*]+\*\*)/gu,
  );
  return (
    <p>
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <Link
            key={i}
            href={`/app/search?q=${encodeURIComponent(part.slice(1))}`}
            className="hashtag"
          >
            {part}
          </Link>
        ) : /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link inline-link"
          >
            {part}
          </a>
        ) : part.startsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      )}
    </p>
  );
}
function Poll({ post }: { post: Post }) {
  const [busy, setBusy] = useState(false),
    client = useQueryClient(),
    toast = useToast();
  const total = post.votes?.reduce((n, v) => n + v.count, 0) || 0;
  return (
    <div className="poll">
      <strong>{post.poll?.question}</strong>
      {post.poll?.options.map((option, i) => {
        const count = post.votes?.find((v) => v.option_index === i)?.count || 0;
        const percent = total ? Math.round((count / total) * 100) : 0;
        return (
          <button
            key={i}
            disabled={busy}
            className={post.my_vote === i ? "voted" : ""}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`posts/${post.id}/vote`, { option: i });
                await client.invalidateQueries();
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <span
              className="poll-fill"
              style={{ width: post.my_vote !== null ? `${percent}%` : "0%" }}
            />
            <span>{option}</span>
            {post.my_vote === i && <Check size={14} />}
            <b>{post.my_vote !== null ? `${percent}%` : ""}</b>
          </button>
        );
      })}
      <small>
        {total} {total === 1 ? "vote" : "votes"} · You can change your choice
      </small>
    </div>
  );
}
export function CommentThread({ postId }: { postId: string }) {
  const { data: app } = useApp(),
    client = useQueryClient(),
    toast = useToast();
  const { data, error, isPending } = useResource<{ items: Comment[] }>(
    `posts/${postId}/comments`,
  );
  const [text, setText] = useState(""),
    [reply, setReply] = useState<Comment | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <section className="comment-thread" aria-label="Comments">
      {isPending && <p className="muted">Loading the conversation…</p>}
      {error && <ErrorState error={error} />}
      {data?.items.map((c) => (
        <div className={`comment ${c.parent_id ? "is-reply" : ""}`} key={c.id}>
          <Avatar name={c.author_name} color={c.author_avatar} size="sm" />
          <div>
            <div className="comment-bubble">
              <Link href={`/app/profile/${c.author_id}`}>
                <strong>{c.author_name}</strong>
              </Link>
              <p>{c.content}</p>
            </div>
            <div className="comment-meta">
              <span>{relativeTime(c.created_at)}</span>
              <button onClick={() => setReply(c)}>Reply</button>
            </div>
          </div>
        </div>
      ))}
      {reply && (
        <div className="reply-indicator">
          Replying to {reply.author_name}
          <button onClick={() => setReply(null)} aria-label="Cancel reply">
            <X size={13} />
          </button>
        </div>
      )}
      <form
        className="comment-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          try {
            await api(`posts/${postId}/comments`, {
              content: text,
              parent_id: reply?.id || null,
            });
            setText("");
            setReply(null);
            await client.invalidateQueries();
          } catch (e) {
            toast((e as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Avatar name={app.user.name} color={app.user.avatar} size="sm" />
        <div>
          <input
            aria-label="Write a comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={3000}
            placeholder="Add to the conversation…"
            required
          />
          <button
            aria-label="Send comment"
            disabled={busy || !text.trim()}
            type="submit"
          >
            <Send size={17} />
          </button>
        </div>
      </form>
    </section>
  );
}
type Draft = {
  content: string;
  audience: string;
  organization: string;
  community: string;
  media: string[];
  poll: boolean;
  question: string;
  options: string[];
};
export function PostComposer({
  open,
  onOpenChange,
  scope,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  scope: ComposerScope;
}) {
  const { data, refresh } = useApp(),
    toast = useToast();
  const [content, setContent] = useState(""),
    [audience, setAudience] = useState("public"),
    [organization, setOrganization] = useState(""),
    [community, setCommunity] = useState(""),
    [media, setMedia] = useState<string[]>([]),
    [poll, setPoll] = useState(false),
    [question, setQuestion] = useState(""),
    [options, setOptions] = useState(["", ""]),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [progress, setProgress] = useState(0),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [official, setOfficial] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftKey = `yc-draft:${data.user.id}`;
  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    setError("");
    try {
      const draft = JSON.parse(
        localStorage.getItem(draftKey) || "null",
      ) as Draft | null;
      setContent(draft?.content || "");
      setAudience(scope.audience || draft?.audience || "public");
      setOrganization(scope.organization_id || draft?.organization || "");
      setCommunity(scope.community_id || draft?.community || "");
      setMedia(draft?.media || []);
      setPoll(draft?.poll || false);
      setQuestion(draft?.question || "");
      setOptions(draft?.options || ["", ""]);
      setOfficial(false);
    } catch {
      setContent("");
      setAudience(scope.audience || "public");
      setOrganization(scope.organization_id || "");
      setCommunity(scope.community_id || "");
    }
    setReady(true);
  }, [open, draftKey, scope]);
  useEffect(() => {
    if (open && ready)
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          content,
          audience,
          organization,
          community,
          media,
          poll,
          question,
          options,
        }),
      );
  }, [
    open,
    ready,
    content,
    audience,
    organization,
    community,
    media,
    poll,
    question,
    options,
    draftKey,
  ]);
  const org = data.organizations.find((o) => o.id === organization),
    joined = data.communities.filter((c) => c.joined);
  async function upload(file: File) {
    if (media.length >= 4) {
      toast("You can attach up to four files.", "error");
      return;
    }
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      const result = await new Promise<{ id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(body);
            else reject(new Error(body.error || "Upload failed."));
          } catch {
            reject(new Error("Upload failed. Please try again."));
          }
        };
        xhr.onerror = () =>
          reject(
            new Error("Upload interrupted. Your draft is safe. Please retry."),
          );
        const form = new FormData();
        form.append("file", file);
        xhr.send(form);
      });
      setMedia((m) => [...m, result.id]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("posts", {
        content,
        kind: poll ? "poll" : media.length ? "image" : "text",
        audience,
        organization_id: audience === "bridge" ? null : organization || null,
        community_id: audience === "community" ? community || null : null,
        bridge_id: scope.bridge_id || null,
        media,
        poll: poll
          ? { question, options: options.filter((o) => o.trim()) }
          : null,
        official,
      });
      localStorage.removeItem(draftKey);
      setReady(false);
      setContent("");
      setMedia([]);
      onOpenChange(false);
      await refresh();
      toast("A little of your world, shared.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!busy && !uploading) onOpenChange(v);
      }}
      title="Share a little of your world"
      description="Your next connection could start with a thought."
      wide
    >
      <form
        className="post-composer-form"
        onSubmit={publish}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!uploading && e.dataTransfer.files[0])
            void upload(e.dataTransfer.files[0]);
        }}
      >
        <div className="composer-identity">
          <Avatar name={data.user.name} color={data.user.avatar} />
          <div>
            <strong>{data.user.name}</strong>
            <div className="composer-audience">
              {audience === "public" ? (
                <Globe2 size={13} />
              ) : (
                <LockKeyhole size={13} />
              )}
              <select
                aria-label="Post audience"
                value={audience}
                onChange={(e) => {
                  setAudience(e.target.value);
                  if (e.target.value === "public") setCommunity("");
                }}
              >
                <option value="public">Anyone on YouConect</option>
                <option value="organization">My organization</option>
                <option value="community">A community</option>
                {scope.bridge_id && (
                  <option value="bridge">This Bridge’s members</option>
                )}
              </select>
            </div>
          </div>
        </div>
        {audience === "organization" && (
          <label>
            Organization
            <select
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              required
            >
              <option value="">Choose your organization</option>
              {data.organizations.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {audience === "community" && (
          <label>
            Community
            <select
              value={community}
              required
              onChange={(e) => {
                setCommunity(e.target.value);
                const selected = joined.find((c) => c.id === e.target.value);
                setOrganization(selected?.organization_id || "");
              }}
            >
              <option value="">Choose a community you’ve joined</option>
              {joined.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <textarea
          autoFocus
          className="composer-text"
          aria-label="Post content"
          placeholder={`What’s on your mind, ${data.user.name.split(" ")[0]}?`}
          value={content}
          maxLength={12000}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={6}
        />
        {poll && (
          <div className="composer-poll">
            <div className="row between">
              <strong>A little community input.</strong>
              <IconButton
                icon={X}
                label="Remove poll"
                onClick={() => setPoll(false)}
                type="button"
              />
            </div>
            <label>
              Question
              <input
                required
                value={question}
                maxLength={200}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to know?"
              />
            </label>
            {options.map((option, i) => (
              <label className="poll-option-label" key={i}>
                <span>Option {i + 1}</span>
                <input
                  required={i < 2}
                  value={option}
                  maxLength={100}
                  onChange={(e) =>
                    setOptions((o) =>
                      o.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                />
              </label>
            ))}
            {options.length < 6 && (
              <button
                type="button"
                className="text-link"
                onClick={() => setOptions((o) => [...o, ""])}
              >
                <Plus size={14} /> Add an option
              </button>
            )}
          </div>
        )}
        {media.length > 0 && (
          <div className="composer-attachments">
            {media.map((id, i) => (
              <div className="attachment-chip" key={id}>
                <Paperclip size={14} />
                <a href={`/api/uploads/${id}`} target="_blank" rel="noreferrer">
                  Attachment {i + 1}
                </a>
                <button
                  type="button"
                  aria-label={`Remove attachment ${i + 1}`}
                  onClick={() => setMedia((m) => m.filter((x) => x !== id))}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        {uploading && (
          <div className="upload-progress">
            <span style={{ width: `${progress}%` }} />
            <small>Uploading your file… {progress}%</small>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {org &&
          ["owner", "admin", "staff", "department_admin"].includes(
            org.role || "",
          ) && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={official}
                onChange={(e) => setOfficial(e.target.checked)}
              />{" "}
              Publish as an official organization update
            </label>
          )}
        <div className="composer-toolbar">
          <span>Add to your post</span>
          <div>
            <IconButton
              type="button"
              icon={ImagePlus}
              label="Attach images"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || media.length >= 4}
            />
            <IconButton
              type="button"
              icon={ChartNoAxesColumnIncreasing}
              label="Add a poll"
              onClick={() => setPoll(!poll)}
            />
            <IconButton
              type="button"
              icon={Smile}
              label="Add a little sparkle"
              onClick={() => setContent((c) => c + " ✨")}
            />
            <IconButton
              type="button"
              icon={Paperclip}
              label="Attach a document"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || media.length >= 4}
            />
          </div>
          <input
            hidden
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
        <div className="composer-footer">
          <span>
            <Check size={12} /> Draft saved on this device <i />{" "}
            {content.length.toLocaleString()}/12,000
          </span>
          <Button
            type="submit"
            loading={busy}
            disabled={uploading || !content.trim()}
          >
            <span>Share post</span>
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function PostDetail({ id }: { id: string }) {
  const { data, error, isPending } = useResource<{ post: Post }>(`posts/${id}`);
  return (
    <div className="content-with-context">
      <div className="feed-column">
        <Link className="back-link" href="/app">
          <ArrowLeft size={16} /> Back to your world
        </Link>
        {isPending ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          data && <PostCard post={data.post} expanded />
        )}
      </div>
      <ContextPanel />
    </div>
  );
}
export function SearchPage() {
  const [term, setTerm] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q") || "";
    setTerm(q);
    setQuery(q);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term), 250);
    return () => clearTimeout(timer);
  }, [term]);
  const { data, error, isFetching } = useResource<{
    groups: {
      title: string;
      items: { id: string; name: string; href: string; headline?: string }[];
    }[];
  }>(query.length >= 2 ? `search?q=${encodeURIComponent(query)}` : null);
  return (
    <div className="standard-page">
      <SectionHeading
        eyebrow="A LITTLE DISCOVERY"
        title="Find your next connection."
        description="Search the people, ideas, and spaces you can access."
      />
      <div className="page-search">
        <Search size={20} />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="What are you looking for?"
          aria-label="Search your world"
          autoFocus
        />
      </div>
      {error && <ErrorState error={error} />}
      {isFetching && <PageSkeleton />}
      {data?.groups.map((g) => (
        <section className="search-result-group" key={g.title}>
          <h2>{g.title}</h2>
          {g.items.map((item) => (
            <Link href={item.href} key={item.id} className="search-result card">
              <span className="feature-icon tone-blue">
                <Search size={18} />
              </span>
              <div>
                <strong>{item.name}</strong>
                {item.headline && <small>{item.headline}</small>}
              </div>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </section>
      ))}
      {data && !data.groups.length && (
        <EmptyState
          icon={Search}
          title="A little further to look."
          description="No matches in the spaces you can access. Try another word."
        />
      )}
    </div>
  );
}
