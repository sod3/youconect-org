"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  MessageCircle,
  ArrowLeft,
  MoreHorizontal,
  Info,
  Send,
  Smile,
  Paperclip,
  X,
  Check,
  CheckCheck,
  Hash,
  Users,
  Pin,
  BellOff,
  Bell,
  Reply,
  Pencil,
  Trash2,
  Flag,
  ChevronDown,
  ArrowDown,
  ArrowUpRight,
  Loader2,
  RotateCcw,
  LockKeyhole,
  FileText,
  UserRound,
  ShieldCheck,
  Heart,
} from "lucide-react";
import { api, useResource, relativeTime } from "@/lib/client";
import type { Conversation, Message } from "@/lib/types";
import { useApp } from "./app-context";
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Menu,
  Modal,
  EmptyState,
  ErrorState,
  useToast,
  Skeleton,
} from "./ui";
type Participant = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  last_read_at: string;
};
type ConversationData = {
  conversation: Conversation & {
    announcements_only: boolean;
    description: string;
  };
  items: Message[];
  participants: Participant[];
  nextCursor: string | null;
};
export function MessagesPage({ id }: { id?: string }) {
  const { data: app, socket, connected, refresh } = useApp(),
    client = useQueryClient(),
    router = useRouter(),
    toast = useToast();
  const { data: inbox, error: inboxError } = useResource<{
    items: Conversation[];
  }>("conversations");
  const {
    data: chat,
    error: chatError,
    isPending,
  } = useResource<ConversationData>(id ? `conversations/${id}` : null);
  const [filter, setFilter] = useState("All"),
    [search, setSearch] = useState(""),
    [newOpen, setNewOpen] = useState(false),
    [info, setInfo] = useState(false),
    [text, setText] = useState(""),
    [reply, setReply] = useState<Message | null>(null),
    [pending, setPending] = useState<Message[]>([]),
    [typing, setTyping] = useState(""),
    [emoji, setEmoji] = useState(false),
    [uploading, setUploading] = useState(false),
    [attachment, setAttachment] = useState<{
      id: string;
      filename: string;
    } | null>(null),
    [older, setOlder] = useState<Message[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loadingOlder, setLoadingOlder] = useState(false),
    [messageSearch, setMessageSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [edit, setEdit] = useState<Message | null>(null),
    [deleteMessage, setDeleteMessage] = useState<Message | null>(null),
    [report, setReport] = useState(false);
  const scroll = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null),
    typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const outboxKey = `yc-outbox:${app.user.id}`;
  useEffect(() => {
    if (
      !id &&
      inbox?.items[0] &&
      window.matchMedia("(min-width: 821px)").matches
    )
      router.replace(`/app/messages/${inbox.items[0].id}`);
  }, [id, inbox, router]);
  useEffect(() => {
    try {
      setPending(
        (JSON.parse(localStorage.getItem(outboxKey) || "[]") as Message[]).map(
          (m) => ({ ...m, status: "failed" }),
        ),
      );
    } catch {
      setPending([]);
    }
  }, [outboxKey]);
  useEffect(() => {
    if (!id) return;
    setText(
      localStorage.getItem(`yc-message-draft:${app.user.id}:${id}`) || "",
    );
    setReply(null);
    setAttachment(null);
    setOlder([]);
    setCursor(null);
    setInfo(false);
    setMessageSearch("");
    setTyping("");
  }, [id, app.user.id]);
  useEffect(() => {
    if (id) localStorage.setItem(`yc-message-draft:${app.user.id}:${id}`, text);
  }, [text, id, app.user.id]);
  useEffect(() => {
    if (chat) setCursor(chat.nextCursor);
  }, [chat?.nextCursor, id]);
  useEffect(() => {
    if (id && chat) {
      void api(`conversations/${id}/read`, {}).then(() =>
        client.invalidateQueries({ queryKey: ["conversations"] }),
      );
    }
  }, [id, chat?.items.at(-1)?.id, client]);
  useEffect(() => {
    if (!socket || !id) return;
    const onMessage = (m: Message) => {
      if (m.conversation_id !== id) return;
      client.setQueryData<ConversationData>([`conversations/${id}`], (old) =>
        old
          ? {
              ...old,
              items: [
                ...old.items.filter(
                  (x) =>
                    x.id !== m.id &&
                    !(
                      x.client_id === m.client_id && x.sender_id === m.sender_id
                    ),
                ),
                m,
              ].sort(
                (a, b) =>
                  a.created_at.localeCompare(b.created_at) ||
                  a.id.localeCompare(b.id),
              ),
            }
          : old,
      );
      void api(`conversations/${id}/read`, {});
    };
    const onTyping = (v: { conversation_id: string; name: string }) => {
      if (v.conversation_id !== id) return;
      setTyping(v.name);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(""), 2800);
    };
    const onRead = (v: {
      conversation_id: string;
      user_id: string;
      at: string;
    }) => {
      if (v.conversation_id === id)
        client.setQueryData<ConversationData>([`conversations/${id}`], (old) =>
          old
            ? {
                ...old,
                participants: old.participants.map((p) =>
                  p.id === v.user_id ? { ...p, last_read_at: v.at } : p,
                ),
              }
            : old,
        );
    };
    const onUpdate = (v: { conversation_id: string }) => {
      if (v.conversation_id === id)
        void client.invalidateQueries({ queryKey: [`conversations/${id}`] });
    };
    const onConnect = () =>
      void client.invalidateQueries({ queryKey: [`conversations/${id}`] });
    socket.on("message", onMessage);
    socket.on("typing", onTyping);
    socket.on("read", onRead);
    socket.on("message-updated", onUpdate);
    socket.on("connect", onConnect);
    return () => {
      socket.off("message", onMessage);
      socket.off("typing", onTyping);
      socket.off("read", onRead);
      socket.off("message-updated", onUpdate);
      socket.off("connect", onConnect);
      clearTimeout(typingTimer.current);
    };
  }, [socket, id, client]);
  const serverMessages = [...older, ...(chat?.items || [])].filter(
    (m, i, all) => all.findIndex((x) => x.id === m.id) === i,
  );
  const pendingHere = pending.filter(
    (m) =>
      m.conversation_id === id &&
      !serverMessages.some(
        (s) => s.client_id === m.client_id && s.sender_id === m.sender_id,
      ),
  );
  const messages = [...serverMessages, ...pendingHere].filter(
    (m) =>
      !messageSearch ||
      m.content.toLowerCase().includes(messageSearch.toLowerCase()),
  );
  useEffect(() => {
    if (!scroll.current) return;
    scroll.current.scrollTo({
      top: scroll.current.scrollHeight,
      behavior: "instant",
    });
  }, [id, chat?.items.length, pendingHere.length]);
  function saveOutbox(next: Message[]) {
    setPending(next);
    localStorage.setItem(outboxKey, JSON.stringify(next));
  }
  async function transmit(message: Message) {
    const payload = {
      conversation_id: message.conversation_id,
      client_id: message.client_id,
      content: message.content,
      reply_to: message.reply_to,
      attachment_id: message.attachment_id,
    };
    try {
      let result: Message;
      if (socket?.connected) {
        try {
          result = await new Promise<Message>((resolve, reject) => {
            socket
              .timeout(10000)
              .emit(
                "message:send",
                payload,
                (
                  error: Error,
                  response: { ok: boolean; message: Message; error?: string },
                ) => {
                  if (error) return reject(error);
                  if (!response.ok) return reject(new Error(response.error));
                  resolve(response.message);
                },
              );
          });
        } catch {
          result = await api<Message>(
            `conversations/${message.conversation_id}/messages`,
            payload,
          );
        }
      } else
        result = await api<Message>(
          `conversations/${message.conversation_id}/messages`,
          payload,
        );
      client.setQueryData<ConversationData>(
        [`conversations/${message.conversation_id}`],
        (old) =>
          old
            ? {
                ...old,
                items: [
                  ...old.items.filter(
                    (m) =>
                      m.id !== result.id &&
                      !(
                        m.client_id === result.client_id &&
                        m.sender_id === result.sender_id
                      ),
                  ),
                  result,
                ].sort(
                  (a, b) =>
                    a.created_at.localeCompare(b.created_at) ||
                    a.id.localeCompare(b.id),
                ),
              }
            : old,
      );
      setPending((old) => {
        const next = old.filter((m) => m.client_id !== message.client_id);
        localStorage.setItem(outboxKey, JSON.stringify(next));
        return next;
      });
      void client.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      setPending((old) => {
        const next = old.map((m) =>
          m.client_id === message.client_id
            ? { ...m, status: "failed" as const }
            : m,
        );
        localStorage.setItem(outboxKey, JSON.stringify(next));
        return next;
      });
      toast((error as Error).message, "error");
    }
  }
  function send() {
    if (!id || (!text.trim() && !attachment)) return;
    const message: Message = {
      id: crypto.randomUUID(),
      client_id: crypto.randomUUID(),
      conversation_id: id,
      sender_id: app.user.id,
      sender_name: app.user.name,
      sender_avatar: app.user.avatar,
      content: text.trim(),
      created_at: new Date().toISOString(),
      deleted: false,
      reply_to: reply?.id || null,
      attachment_id: attachment?.id || null,
      status: "pending",
    };
    saveOutbox([...pending, message]);
    setText("");
    setReply(null);
    setAttachment(null);
    setEmoji(false);
    void transmit(message);
    inputRef.current?.focus();
  }
  const current = inbox?.items.find((c) => c.id === id),
    peers = chat?.participants.filter((p) => p.id !== app.user.id) || [];
  const filtered =
    inbox?.items.filter(
      (c) =>
        (filter === "All" ||
          (filter === "Unread" && c.unread > 0) ||
          (filter === "Groups" && c.kind === "group") ||
          (filter === "Channels" && c.kind === "channel") ||
          (filter === "Direct" && c.kind === "direct")) &&
        (c.name + " " + c.last_message)
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  async function preference(key: "muted" | "pinned") {
    if (!id) return;
    try {
      await api(`conversations/${id}/preferences`, { [key]: !current?.[key] });
      await refresh();
      toast(
        key === "muted"
          ? current?.muted
            ? "Notifications unmuted."
            : "Conversation muted."
          : current?.pinned
            ? "Conversation unpinned."
            : "Conversation pinned.",
      );
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  return (
    <div
      className={`messaging-layout ${id ? "has-conversation" : ""} ${info ? "show-conversation-info" : ""}`}
    >
      <section className="inbox-panel">
        <header className="inbox-header">
          <div>
            <span className="eyebrow">EVERY CONVERSATION. ONE PLACE.</span>
            <h1>
              Messages<span>.</span>
            </h1>
          </div>
          <IconButton
            icon={Plus}
            label="New conversation"
            className="new-message-button"
            onClick={() => setNewOpen(true)}
          />
        </header>
        <div className="inbox-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search conversations"
            placeholder="Find a conversation…"
          />
        </div>
        <div className="inbox-filters">
          {["All", "Unread", "Direct", "Groups", "Channels"].map((f) => (
            <button
              className={filter === f ? "active" : ""}
              key={f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="inbox-list">
          {inboxError && <ErrorState error={inboxError} />}
          {!inbox &&
            [1, 2, 3].map((i) => (
              <div className="conversation-skeleton" key={i}>
                <Skeleton className="skeleton-avatar" />
                <Skeleton className="skeleton-line" />
              </div>
            ))}
          {filtered.map((c) => (
            <Link
              className={`conversation-row ${id === c.id ? "selected" : ""} ${c.unread ? "unread" : ""}`}
              href={`/app/messages/${c.id}`}
              key={c.id}
            >
              <div className="conversation-avatar">
                {c.kind === "channel" ? (
                  <span className="avatar tone-blue">
                    <Hash size={22} />
                  </span>
                ) : c.kind === "group" ? (
                  <span className="avatar tone-violet">
                    <Users size={22} />
                  </span>
                ) : (
                  <Avatar name={c.name || "Conversation"} color={c.avatar} />
                )}
              </div>
              <div>
                <div className="conversation-row-title">
                  <strong>
                    {c.kind === "channel" ? "# " : ""}
                    {c.name}
                  </strong>
                  <time>{relativeTime(c.last_at)}</time>
                </div>
                <div className="conversation-row-preview">
                  <span>
                    {c.last_message || "A new conversation starts here."}
                  </span>
                  {c.unread > 0 && <b>{c.unread}</b>}
                  {c.muted && <BellOff size={12} />}
                  {c.pinned && <Pin size={12} />}
                </div>
                {c.organization_name && <small>{c.organization_name}</small>}
              </div>
            </Link>
          ))}
          {inbox && !filtered.length && (
            <EmptyState
              icon={MessageCircle}
              title="A little hello goes a long way."
              description="Start a conversation with someone in your community."
            >
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setNewOpen(true)}
              >
                Say hello <Plus size={14} />
              </Button>
            </EmptyState>
          )}
        </div>
        <div className="inbox-footnote">
          <LockKeyhole size={12} /> Private conversations. Shared possibilities.
        </div>
      </section>
      {!id ? (
        <section className="chat-empty">
          <div className="chat-empty-visual">
            <MessageCircle size={45} strokeWidth={1.2} />
            <span>✦</span>
          </div>
          <h2>
            A conversation could
            <br />
            change your day.
          </h2>
          <p>
            Pick up where you left off, or say hello
            <br />
            to someone new.
          </p>
          <Button onClick={() => setNewOpen(true)}>
            Start a conversation <Plus size={16} />
          </Button>
        </section>
      ) : (
        <section className="chat-panel">
          {chatError ? (
            <ErrorState error={chatError} />
          ) : !chat ? (
            <div className="chat-loading">
              <Loader2 className="spin" size={25} />
              <p>Finding your conversation…</p>
            </div>
          ) : (
            <>
              <header className="chat-header">
                <Link
                  className="chat-back icon-button"
                  href="/app/messages"
                  aria-label="Back to inbox"
                >
                  <ArrowLeft size={20} />
                </Link>
                {current?.kind === "channel" ? (
                  <span className="avatar tone-blue">
                    <Hash size={23} />
                  </span>
                ) : (
                  <Avatar
                    name={
                      current?.name || chat.conversation.name || "Conversation"
                    }
                    color={current?.avatar || "violet"}
                  />
                )}
                <div className="chat-header-identity">
                  <h2>{current?.name || chat.conversation.name}</h2>
                  <span>
                    {chat.conversation.kind === "direct"
                      ? connected
                        ? "Connected · private conversation"
                        : "Reconnecting…"
                      : `${chat.participants.length} members · ${chat.conversation.kind === "channel" ? "Organization channel" : "Group conversation"}`}
                  </span>
                </div>
                <div className="chat-header-actions">
                  <IconButton
                    icon={Search}
                    label="Search this conversation"
                    onClick={() => setSearchOpen(!searchOpen)}
                  />
                  <IconButton
                    icon={Info}
                    label="Conversation details"
                    onClick={() => setInfo(!info)}
                  />
                  <Menu
                    trigger={
                      <IconButton
                        icon={MoreHorizontal}
                        label="Conversation options"
                      />
                    }
                    items={[
                      {
                        label: current?.pinned
                          ? "Unpin conversation"
                          : "Pin conversation",
                        icon: Pin,
                        onClick: () => void preference("pinned"),
                      },
                      {
                        label: current?.muted
                          ? "Unmute conversation"
                          : "Mute conversation",
                        icon: current?.muted ? Bell : BellOff,
                        onClick: () => void preference("muted"),
                      },
                      {
                        label: "Report conversation",
                        icon: Flag,
                        onClick: () => setReport(true),
                      },
                    ]}
                  />
                </div>
              </header>
              {searchOpen && (
                <div className="chat-search">
                  <Search size={16} />
                  <input
                    aria-label="Search loaded messages"
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    placeholder="Search loaded messages…"
                  />
                  <IconButton
                    icon={X}
                    label="Close message search"
                    onClick={() => {
                      setSearchOpen(false);
                      setMessageSearch("");
                    }}
                  />
                </div>
              )}
              <div className="chat-messages" ref={scroll}>
                <div className="conversation-start">
                  <LockKeyhole size={14} />
                  <span>Just the right people. A little room to connect.</span>
                </div>
                {cursor && (
                  <Button
                    size="sm"
                    className="load-older"
                    variant="ghost"
                    loading={loadingOlder}
                    onClick={async () => {
                      setLoadingOlder(true);
                      try {
                        const result = await api<ConversationData>(
                          `conversations/${id}?before=${encodeURIComponent(cursor)}`,
                        );
                        setOlder((old) => [...result.items, ...old]);
                        setCursor(result.nextCursor);
                      } catch (e) {
                        toast((e as Error).message, "error");
                      } finally {
                        setLoadingOlder(false);
                      }
                    }}
                  >
                    Load earlier messages
                  </Button>
                )}
                <div className="chat-date-divider">
                  <span>
                    {messages.length
                      ? new Date(messages[0].created_at).toLocaleDateString(
                          "en",
                          { month: "long", day: "numeric" },
                        )
                      : "The beginning of something good."}
                  </span>
                </div>
                {messages.map((m, i) => {
                  const own = m.sender_id === app.user.id,
                    first =
                      i === 0 || messages[i - 1].sender_id !== m.sender_id,
                    read =
                      own &&
                      peers.some(
                        (p) =>
                          new Date(p.last_read_at) >= new Date(m.created_at),
                      );
                  const replied = messages.find((r) => r.id === m.reply_to);
                  return (
                    <div
                      className={`message-row ${own ? "own" : ""} ${first ? "first-in-group" : ""}`}
                      key={m.id}
                    >
                      {!own && (
                        <div className="message-avatar">
                          {first && (
                            <Avatar
                              name={m.sender_name}
                              color={m.sender_avatar}
                              size="sm"
                            />
                          )}
                        </div>
                      )}
                      <div className="message-content">
                        {!own &&
                          first &&
                          chat.conversation.kind !== "direct" && (
                            <span className="message-sender-name">
                              {m.sender_name}
                            </span>
                          )}
                        <div
                          className={`message-bubble ${m.status === "failed" ? "message-failed" : ""} ${m.deleted ? "deleted-message" : ""}`}
                        >
                          {replied && (
                            <div className="quoted-message">
                              <strong>{replied.sender_name}</strong>
                              <p>{replied.content.slice(0, 140)}</p>
                            </div>
                          )}
                          {m.content && <p>{m.content}</p>}
                          {m.attachment_id && !m.deleted && (
                            <a
                              className="message-attachment"
                              href={`/api/uploads/${m.attachment_id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Paperclip size={17} /> Open attachment{" "}
                              <ArrowUpRight size={13} />
                            </a>
                          )}
                        </div>
                        {m.reactions && m.reactions.length > 0 && (
                          <div className="message-reactions">
                            {m.reactions.map((r) => (
                              <span key={r.emoji}>
                                {r.emoji} {r.count}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="message-meta">
                          <time>
                            {new Date(m.created_at).toLocaleTimeString("en", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </time>
                          {m.edited_at && !m.deleted && <span>edited</span>}
                          {own &&
                            (m.status === "pending" ? (
                              <span className="sending-message">
                                <Loader2 size={11} className="spin" /> Sending
                              </span>
                            ) : m.status === "failed" ? (
                              <button
                                className="retry-message"
                                onClick={() => {
                                  setPending((old) =>
                                    old.map((x) =>
                                      x.client_id === m.client_id
                                        ? { ...x, status: "pending" }
                                        : x,
                                    ),
                                  );
                                  void transmit(m);
                                }}
                              >
                                <RotateCcw size={11} /> Failed · retry
                              </button>
                            ) : (
                              <span className={read ? "message-read" : ""}>
                                {read ? (
                                  <CheckCheck size={14} />
                                ) : (
                                  <Check size={13} />
                                )}{" "}
                                {read ? "Read" : "Sent"}
                              </span>
                            ))}
                        </div>
                      </div>
                      {!m.deleted &&
                        m.status !== "pending" &&
                        m.status !== "failed" && (
                          <Menu
                            trigger={
                              <button
                                className="message-options icon-button"
                                aria-label="Message actions"
                              >
                                <MoreHorizontal size={16} />
                              </button>
                            }
                            items={[
                              {
                                label: "Reply to message",
                                icon: Reply,
                                onClick: () => {
                                  setReply(m);
                                  inputRef.current?.focus();
                                },
                              },
                              {
                                label: "React with ❤️",
                                icon: Heart,
                                onClick: () =>
                                  void api(
                                    `messages/${m.id}`,
                                    { emoji: "❤️" },
                                    "PATCH",
                                  )
                                    .then(() =>
                                      client.invalidateQueries({
                                        queryKey: [`conversations/${id}`],
                                      }),
                                    )
                                    .catch((e) => toast(e.message, "error")),
                              },
                              ...(own
                                ? [
                                    {
                                      label: "Edit message",
                                      icon: Pencil,
                                      onClick: () => setEdit(m),
                                    },
                                    {
                                      label: "Delete message",
                                      icon: Trash2,
                                      onClick: () => setDeleteMessage(m),
                                      danger: true,
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        )}
                    </div>
                  );
                })}
                {!messages.length && (
                  <EmptyState
                    icon={MessageCircle}
                    title="Say a little hello."
                    description="This is the start of your conversation."
                  />
                )}
                {typing && (
                  <div className="typing-indicator">
                    <span>
                      <i />
                      <i />
                      <i />
                    </span>
                    {typing.split(" ")[0]} is typing…
                  </div>
                )}
              </div>
              <div className="chat-composer-container">
                {reply && (
                  <div className="chat-reply">
                    <Reply size={16} />
                    <div>
                      <strong>Replying to {reply.sender_name}</strong>
                      <p>{reply.content.slice(0, 120)}</p>
                    </div>
                    <IconButton
                      icon={X}
                      label="Cancel reply"
                      onClick={() => setReply(null)}
                    />
                  </div>
                )}
                {attachment && (
                  <div className="chat-reply">
                    <Paperclip size={16} />
                    <span>{attachment.filename}</span>
                    <IconButton
                      icon={X}
                      label="Remove attachment"
                      onClick={() => setAttachment(null)}
                    />
                  </div>
                )}
                {emoji && (
                  <div className="emoji-picker">
                    {[
                      "👋",
                      "😊",
                      "❤️",
                      "✨",
                      "🙌",
                      "🎉",
                      "💡",
                      "👍",
                      "☕",
                      "🚀",
                    ].map((e) => (
                      <button
                        onClick={() => {
                          setText((t) => t + e);
                          setEmoji(false);
                          inputRef.current?.focus();
                        }}
                        key={e}
                        aria-label={`Insert ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  className="chat-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                >
                  <IconButton
                    type="button"
                    icon={Smile}
                    label="Choose an emoji"
                    onClick={() => setEmoji(!emoji)}
                  />
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      socket?.emit("typing", { conversation_id: id });
                    }}
                    maxLength={6000}
                    placeholder={
                      chat.conversation.announcements_only
                        ? "Write an official update…"
                        : "A little hello, a big idea…"
                    }
                    aria-label="Write a message"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <IconButton
                    type="button"
                    icon={uploading ? Loader2 : Paperclip}
                    label="Attach a file"
                    disabled={uploading}
                    onClick={() => file.current?.click()}
                  />
                  <button
                    className="send-message"
                    type="submit"
                    aria-label="Send message"
                    disabled={(!text.trim() && !attachment) || uploading}
                  >
                    <Send size={18} />
                  </button>
                  <input
                    ref={file}
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploading(true);
                      try {
                        const form = new FormData();
                        form.append("file", f);
                        setAttachment(await api("uploads", form));
                      } catch (error) {
                        toast((error as Error).message, "error");
                      } finally {
                        setUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </form>
                <div className="chat-composer-hint">
                  <span>Enter to send. Shift + Enter for a new line.</span>
                  <span>
                    <ShieldCheck size={11} /> Sent after server confirmation
                  </span>
                </div>
              </div>
            </>
          )}
        </section>
      )}
      {info && chat && (
        <aside className="conversation-info">
          <div className="row between">
            <h3>A little more context.</h3>
            <IconButton
              icon={X}
              label="Close conversation details"
              onClick={() => setInfo(false)}
            />
          </div>
          <div className="conversation-info-title">
            <Avatar
              name={current?.name || "Conversation"}
              color={current?.avatar || "violet"}
              size="lg"
            />
            <h2>{current?.name}</h2>
            <Badge color="teal">{chat.conversation.kind} conversation</Badge>
          </div>
          <h4>The people in this space</h4>
          {chat.participants.map((p) => (
            <Link
              className="conversation-member"
              href={`/app/profile/${p.id}`}
              key={p.id}
            >
              <Avatar name={p.name} color={p.avatar} size="sm" />
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.id === app.user.id
                    ? "You"
                    : p.role === "admin"
                      ? "Group administrator"
                      : "Member"}
                </small>
              </span>
              <ArrowUpRight size={14} />
            </Link>
          ))}
          <div className="info-notice">
            <LockKeyhole size={17} />
            <p>
              Access is checked against current participation and organizational
              permissions. Calls and end-to-end encryption are not implemented
              in this release.
            </p>
          </div>
        </aside>
      )}
      <NewConversationModal open={newOpen} onOpenChange={setNewOpen} />
      <Modal
        open={!!edit}
        onOpenChange={(o) => {
          if (!o) setEdit(null);
        }}
        title="A little correction"
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(
                `messages/${edit!.id}`,
                { content: new FormData(e.currentTarget).get("content") },
                "PATCH",
              );
              await client.invalidateQueries({
                queryKey: [`conversations/${id}`],
              });
              setEdit(null);
            } catch (error) {
              toast((error as Error).message, "error");
            }
          }}
        >
          <label>
            Your message
            <textarea
              name="content"
              key={edit?.id}
              defaultValue={edit?.content}
              required
              maxLength={6000}
              rows={4}
            />
          </label>
          <Button type="submit">Save your edit</Button>
        </form>
      </Modal>
      <Modal
        open={!!deleteMessage}
        onOpenChange={(v) => {
          if (!v) setDeleteMessage(null);
        }}
        title="Delete this message?"
        description="The message will be replaced with a deletion notice for everyone."
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setDeleteMessage(null)}>
            Keep message
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await api(`messages/${deleteMessage!.id}`, {}, "DELETE");
                await client.invalidateQueries({
                  queryKey: [`conversations/${id}`],
                });
                setDeleteMessage(null);
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }}
          >
            Delete message
          </Button>
        </div>
      </Modal>
      <Modal
        open={report}
        onOpenChange={setReport}
        title="Ask for a closer look"
        description="Your report will be saved for the authorized moderation team."
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(`conversations/${id}/report`, {
                reason: new FormData(e.currentTarget).get("reason"),
              });
              setReport(false);
              toast("Your report is saved for review.");
            } catch (error) {
              toast((error as Error).message, "error");
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
          <Button type="submit">Submit report</Button>
        </form>
      </Modal>
    </div>
  );
}
function HeartIcon(props: { size?: number }) {
  return <span style={{ fontSize: props.size || 16 }}>♡</span>;
}
export function NewConversationModal({
  open,
  onOpenChange,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
}) {
  const { refresh } = useApp(),
    router = useRouter();
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<{ id: string; name: string }[]>([]),
    [kind, setKind] = useState("direct"),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { data } = useResource<{
    groups: {
      title: string;
      items: { id: string; name: string; headline?: string }[];
    }[];
  }>(
    open && search.length >= 2
      ? `search?q=${encodeURIComponent(search)}`
      : null,
  );
  const people = data?.groups.find((g) => g.title === "People")?.items || [];
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        organizationId
          ? "Make room for a conversation"
          : "Start with a little hello"
      }
      description="Find someone in your community and make a connection."
    >
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await api<{ id: string }>("conversations", {
              kind: organizationId ? "channel" : kind,
              name,
              participants: selected.map((p) => p.id),
              organization_id: organizationId || null,
            });
            await refresh();
            onOpenChange(false);
            setSelected([]);
            setSearch("");
            setName("");
            router.push(`/app/messages/${result.id}`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {!organizationId && (
          <div className="filter-pills">
            <button
              type="button"
              className={kind === "direct" ? "active" : ""}
              onClick={() => {
                setKind("direct");
                setSelected((s) => s.slice(0, 1));
              }}
            >
              Direct message
            </button>
            <button
              type="button"
              className={kind === "group" ? "active" : ""}
              onClick={() => setKind("group")}
            >
              Group conversation
            </button>
          </div>
        )}
        {(kind === "group" || organizationId) && (
          <label>
            {organizationId ? "Channel name" : "Group name"}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={1}
              maxLength={100}
              required
              placeholder={
                organizationId
                  ? "project-collaboration"
                  : "A name for your people"
              }
            />
          </label>
        )}
        <label>
          Find a person
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name (at least 2 characters)"
          />
        </label>
        {selected.length > 0 && (
          <div className="selected-people">
            {selected.map((p) => (
              <Badge color="blue" key={p.id}>
                {p.name}
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() =>
                    setSelected((s) => s.filter((x) => x.id !== p.id))
                  }
                >
                  <X size={12} />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="people-search-results">
          {people
            .filter((p) => !selected.some((s) => s.id === p.id))
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelected((s) =>
                    kind === "direct" && !organizationId ? [p] : [...s, p],
                  );
                  setSearch("");
                }}
              >
                <Avatar name={p.name} size="sm" />
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.headline}</small>
                </span>
                <Plus size={16} />
              </button>
            ))}
        </div>
        {organizationId && (
          <p className="muted">
            Only members of this organization can be added. Other members may
            join the channel from the organization page.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button
          loading={busy}
          type="submit"
          disabled={!organizationId && !selected.length}
        >
          {organizationId ? "Create channel" : "Start a conversation"}
          <ArrowUpRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
