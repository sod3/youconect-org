import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { User } from "../lib/types";
const temp = await mkdtemp(path.join(tmpdir(), "youconect-tests-"));
delete process.env.DATABASE_URL;
process.env.DATA_DIR = temp;
process.env.DEMO_ENABLED = "true";
process.env.APP_URL = "http://localhost:3000";
process.env.LOCAL_DB_EPHEMERAL = "true";
const { query, getDb } = await import("../lib/db");
const { createPost, listPosts, postAction, comments } =
  await import("../lib/social-service");
const { adminAction, adminOverview } = await import("../lib/admin-service");
const {
  listEvents,
  createEvent,
  rsvp,
  search,
  createOpportunity,
  opportunityAction,
} = await import("../lib/discovery-service");
const {
  createBridge,
  bridgeAction,
  createCommunity,
  joinCommunity,
  requestMembership,
} = await import("../lib/organization-service");
const { sendMessage, conversationDetail, createConversation } =
  await import("../lib/message-service");
const { requirePost, canAccessBridge } = await import("../lib/permissions");
const { createSession, userFromToken, rateLimit } = await import("../lib/auth");
const { authAction } = await import("../lib/auth-service");
const { uploadFile, downloadFile } = await import("../lib/upload-service");
const { GET, POST } = await import("../app/api/[...path]/route");
let ayla: User, zara: User, omar: User, daniel: User;
before(async () => {
  await getDb();
  [ayla, zara, omar, daniel] = await Promise.all(
    ["ayla", "zara", "omar", "daniel"].map(async (key) => {
      const [user] = await query<User>("SELECT * FROM users WHERE id=$1", [
        `demo-${key}`,
      ]);
      return user;
    }),
  );
});
after(async () => {
  await (await getDb()).close();
  const safe = path.resolve(temp);
  assert(safe.startsWith(path.join(tmpdir(), "youconect-tests-")));
  await rm(safe, { recursive: true, force: true });
});
test("session expiry and revocation are enforced", async () => {
  const token = await createSession(ayla.id);
  assert.equal((await userFromToken(token))?.id, ayla.id);
  await query("DELETE FROM sessions WHERE user_id=$1", [ayla.id]);
  assert.equal(await userFromToken(token), null);
});
test("signup, verification, onboarding, recovery and login persist real accounts", async () => {
  const request = new Request("http://localhost:3000/api/auth/signup", {
    headers: { origin: "http://localhost:3000" },
  });
  const email = `signup-${randomUUID()}@example.test`;
  const result = await authAction("signup", request, {
    name: "Integration Person",
    email,
    password: "A-strong-test-password!",
  });
  assert(result.token);
  const user = await userFromToken(result.token);
  assert(user && !user.email_verified);
  const link = (result.data as { devVerificationUrl: string })
    .devVerificationUrl;
  await authAction("verify", request, {
    token: new URL(link).searchParams.get("token"),
  });
  await assert.rejects(
    () =>
      authAction("verify", request, {
        token: new URL(link).searchParams.get("token"),
      }),
    /invalid or has expired/,
  );
  const verified = await userFromToken(result.token);
  assert(verified?.email_verified);
  const recovered = await authAction("forgot-password", request, { email });
  const resetToken = new URL(
    (recovered.data as { devResetUrl: string }).devResetUrl,
  ).searchParams.get("token");
  await authAction("reset-password", request, {
    token: resetToken,
    password: "A-different-secure-password!",
  });
  assert.equal(await userFromToken(result.token), null);
  const login = await authAction("login", request, {
    email,
    password: "A-different-secure-password!",
  });
  assert(login.token);
  await assert.rejects(
    () => authAction("login", request, { email, password: "wrong" }),
    /incorrect/,
  );
});
test("a role in one organization grants no administrative access to another", async () => {
  await assert.rejects(() => adminOverview(ayla, "lumina"), /access/);
  const data = await adminOverview(ayla, "northstar");
  assert(data.metrics.members >= 4);
});
test("private feed, detail, comments and search use the same tenant boundary", async () => {
  const secret = `tenant-secret-${randomUUID()}`;
  const post = await createPost(ayla, {
    content: secret,
    audience: "organization",
    organization_id: "northstar",
  });
  assert(
    !(await listPosts(omar.id, new URLSearchParams())).items.some(
      (p) => p.id === post.id,
    ),
  );
  await assert.rejects(() => requirePost(omar.id, post.id), /access/);
  await assert.rejects(
    () => comments(omar, post.id, { content: "Unauthorized comment" }),
    /access/,
  );
  assert.equal((await search(omar.id, secret)).groups.length, 0);
  assert((await search(zara.id, secret)).groups.length > 0);
});
test("membership approval and suspension change content authorization immediately", async () => {
  const id = randomUUID();
  await query(
    "INSERT INTO users(id,email,password_hash,name,email_verified) VALUES($1,$2,'test-hash','New member',true)",
    [id, `${id}@example.test`],
  );
  const [user] = await query<User>("SELECT * FROM users WHERE id=$1", [id]);
  await requestMembership(user, "northstar");
  await assert.rejects(() => requirePost(user.id, "campus-announcement"));
  await adminAction(ayla, "northstar", "membership", {
    user_id: id,
    status: "active",
  });
  assert((await requirePost(user.id, "campus-announcement")).id);
  await adminAction(ayla, "northstar", "membership", {
    user_id: id,
    status: "suspended",
  });
  await assert.rejects(() => requirePost(user.id, "campus-announcement"));
  await assert.rejects(() =>
    adminAction(daniel, "northstar", "membership", {
      user_id: id,
      status: "active",
    }),
  );
});
test("private community content cannot be accidentally published to everyone", async () => {
  const c = await createCommunity(ayla, {
    name: "Private research",
    description: "A private research community",
    visibility: "private",
    organization_id: "northstar",
  });
  await assert.rejects(
    () =>
      createPost(ayla, {
        content: "Private content",
        audience: "public",
        organization_id: "northstar",
        community_id: c.id,
      }),
    /cannot be published publicly/,
  );
  await assert.rejects(() => joinCommunity(omar, c.id));
  const p = await createPost(ayla, {
    content: "Members only",
    audience: "community",
    organization_id: "northstar",
    community_id: c.id,
  });
  await assert.rejects(() => requirePost(zara.id, p.id));
});
test("reactions and saved posts are idempotent; replies stay within a post", async () => {
  const post = await createPost(ayla, {
    content: "A test conversation",
    audience: "public",
  });
  await postAction(zara, post.id, "reaction", {}, "POST");
  await postAction(zara, post.id, "reaction", {}, "POST");
  let [count] = await query(
    "SELECT count(*)::int total FROM reactions WHERE post_id=$1",
    [post.id],
  );
  assert.equal(count.total, 1);
  const thread = await comments(zara, post.id, { content: "First comment" });
  await comments(ayla, post.id, {
    content: "A thoughtful reply",
    parent_id: thread.items[0].id,
  });
  const other = await createPost(ayla, { content: "A separate conversation" });
  await assert.rejects(() =>
    comments(ayla, other.id, {
      content: "Invalid reply",
      parent_id: thread.items[0].id,
    }),
  );
  await postAction(zara, post.id, "save", {}, "POST");
  assert(
    (
      await listPosts(zara.id, new URLSearchParams({ mode: "saved" }))
    ).items.some((p) => p.id === post.id),
  );
});
test("messages persist once, authorize participants, and reject reused idempotency keys", async () => {
  const conversation = await createConversation(ayla, {
    kind: "direct",
    participants: [zara.id],
  });
  const client_id = randomUUID(),
    payload = {
      conversation_id: conversation.id,
      client_id,
      content: "A real persisted message",
    };
  const [a, b] = await Promise.all([
    sendMessage(ayla, payload),
    sendMessage(ayla, payload),
  ]);
  assert.equal(a.id, b.id);
  const [count] = await query(
    "SELECT count(*)::int total FROM messages WHERE sender_id=$1 AND client_id=$2",
    [ayla.id, client_id],
  );
  assert.equal(count.total, 1);
  const history = await conversationDetail(
    zara.id,
    conversation.id,
    new URLSearchParams(),
  );
  assert(history.items.some((m) => m.id === a.id));
  await assert.rejects(() =>
    conversationDetail(omar.id, conversation.id, new URLSearchParams()),
  );
  await assert.rejects(() => sendMessage(omar, payload));
  await assert.rejects(
    () => sendMessage(ayla, { ...payload, content: "Changed payload" }),
    /already been used/,
  );
});
test("event capacity is enforced transactionally under simultaneous RSVP", async () => {
  const event = await createEvent(ayla, {
    title: "One seat only",
    description: "A capacity concurrency test event",
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    ends_at: new Date(Date.now() + 90000000).toISOString(),
    location: "Online",
    capacity: 1,
  });
  const outcomes = await Promise.allSettled([
    rsvp(ayla, event.id),
    rsvp(zara, event.id),
  ]);
  assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
  const [row] = await query(
    "SELECT count(*)::int total FROM registrations WHERE event_id=$1",
    [event.id],
  );
  assert.equal(row.total, 1);
});
test("Bridges need independent bilateral approval and explicit member scope; closing revokes access", async () => {
  const bridge = await createBridge(ayla, {
    name: "Test cross-organization Bridge",
    description: "An explicitly scoped collaboration",
    proposer_org_id: "northstar",
    target_org_id: "lumina",
  });
  assert.equal(await canAccessBridge(ayla.id, bridge.id), false);
  await assert.rejects(() => bridgeAction(ayla, bridge.id, "approve", {}));
  await bridgeAction(omar, bridge.id, "approve", {});
  assert.equal(await canAccessBridge(ayla.id, bridge.id), false);
  await bridgeAction(ayla, bridge.id, "members", { user_id: ayla.id });
  assert(await canAccessBridge(ayla.id, bridge.id));
  await bridgeAction(omar, bridge.id, "members", { user_id: omar.id });
  const post = await createPost(ayla, {
    content: "Bridge-only protected material",
    audience: "bridge",
    bridge_id: bridge.id,
  });
  assert((await requirePost(omar.id, post.id)).id);
  await assert.rejects(() => requirePost(daniel.id, post.id));
  await bridgeAction(omar, bridge.id, "close", {});
  await assert.rejects(() => requirePost(ayla.id, post.id));
  assert.equal(
    (await search(ayla.id, "Bridge-only protected material")).groups.length,
    0,
  );
});
test("uploads are validated by content and private bytes stay private", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
    "base64",
  );
  const form = new FormData();
  form.set("file", new File([png], "pixel.png", { type: "image/png" }));
  const upload = await uploadFile(
    ayla,
    new Request("http://localhost:3000/api/uploads", {
      method: "POST",
      body: form,
    }),
  );
  const post = await createPost(ayla, {
    content: "Private attached image",
    organization_id: "northstar",
    audience: "organization",
    media: [upload.id],
  });
  assert.equal((await downloadFile(zara, upload.id)).status, 200);
  await assert.rejects(() => downloadFile(omar, upload.id));
  const bad = new FormData();
  bad.set(
    "file",
    new File(["<script>evil</script>"], "not-a-photo.png", {
      type: "image/png",
    }),
  );
  await assert.rejects(
    () =>
      uploadFile(
        ayla,
        new Request("http://localhost:3000/api/uploads", {
          method: "POST",
          body: bad,
        }),
      ),
    /valid JPEG/,
  );
});
test("entitlements prevent membership approval beyond a plan limit", async () => {
  await query("UPDATE plans SET member_limit=1 WHERE id='growth'");
  const id = randomUUID();
  await query(
    "INSERT INTO users(id,email,password_hash,name,email_verified) VALUES($1,$2,'x','Limit test',true)",
    [id, `${id}@example.test`],
  );
  const [person] = await query<User>("SELECT * FROM users WHERE id=$1", [id]);
  await requestMembership(person, "northstar");
  await assert.rejects(
    () =>
      adminAction(ayla, "northstar", "membership", {
        user_id: id,
        status: "active",
      }),
    /limit has been reached/,
  );
  await query("UPDATE plans SET member_limit=2500 WHERE id='growth'");
});
test("opportunity applications save real introductions and do not duplicate", async () => {
  const o = await createOpportunity(ayla, {
    title: "Integration Fellowship",
    description: "An opportunity for a testable workflow",
    category: "Research",
    location: "Remote",
    deadline: new Date(Date.now() + 86400000).toISOString(),
  });
  await opportunityAction(zara, o.id, "apply", {
    note: "A thoughtful and detailed introduction to this opportunity.",
  });
  await opportunityAction(zara, o.id, "apply", {
    note: "A repeated but still detailed introduction to this opportunity.",
  });
  const [row] = await query(
    "SELECT count(*)::int total FROM applications WHERE opportunity_id=$1",
    [o.id],
  );
  assert.equal(row.total, 1);
});
test("API rejects mutation by GET and foreign-origin POST", async () => {
  const token = await createSession(ayla.id);
  const headers = { cookie: `yc_session=${token}` };
  const context = {
    params: Promise.resolve({ path: ["posts", "welcome-week", "save"] }),
  };
  const get = await GET(
    new Request("http://localhost:3000/api/posts/welcome-week/save", {
      headers,
    }),
    context,
  );
  assert.equal(get.status, 405);
  const response = await POST(
    new Request("http://localhost:3000/api/posts", {
      method: "POST",
      headers: {
        ...headers,
        Origin: "https://attacker.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "Unwanted" }),
    }),
    { params: Promise.resolve({ path: ["posts"] }) },
  );
  assert.equal(response.status, 403);
  const privateRequest = await GET(
    new Request("http://localhost:3000/api/admin/lumina", { headers }),
    { params: Promise.resolve({ path: ["admin", "lumina"] }) },
  );
  assert.equal(privateRequest.status, 403);
});
test("database-backed rate limiting survives repeated requests", async () => {
  const key = randomUUID();
  await rateLimit(key, 2, 60);
  await rateLimit(key, 2, 60);
  await assert.rejects(() => rateLimit(key, 2, 60), /Too many requests/);
});
test("direct conversation creation reuses a seeded pair rather than fragmenting the inbox", async () => {
  const a = await createConversation(ayla, {
    kind: "direct",
    participants: [zara.id],
  });
  const b = await createConversation(zara, {
    kind: "direct",
    participants: [ayla.id],
  });
  assert.equal(a.id, "dm-zara");
  assert.equal(b.id, a.id);
});
test("profile retrieval omits email, credentials and private memberships by default", async () => {
  const { getProfile } = await import("../lib/profile-service");
  const result = await getProfile(omar, ayla.id);
  assert.equal(result.organizations.length, 0);
  assert(!("email" in result.user));
  assert(!("password_hash" in result.user));
  assert.equal(result.user.name, ayla.name);
});
test("invoice requests do not charge money or activate a paid subscription", async () => {
  const { platformAction } = await import("../lib/admin-service");
  const before = (
    await query("SELECT * FROM subscriptions WHERE organization_id='northstar'")
  )[0];
  const invoice = await adminAction(ayla, "northstar", "invoice", {
    plan_id: "growth",
  });
  const [record] = await query("SELECT * FROM billing_records WHERE id=$1", [
    invoice.id,
  ]);
  assert.equal(record.status, "requested");
  assert.equal(record.amount_pkr, 264000);
  const after = (
    await query("SELECT * FROM subscriptions WHERE organization_id='northstar'")
  )[0];
  assert.equal(after.status, before.status);
  await assert.rejects(() =>
    platformAction(omar, "reconcile", {
      invoice_id: record.id,
      reference: "TEST ONLY reference",
    }),
  );
  await platformAction(ayla, "reconcile", {
    invoice_id: record.id,
    reference: "TEST ONLY reference",
  });
  assert.equal(
    (
      await query(
        "SELECT status FROM subscriptions WHERE organization_id='northstar'",
      )
    )[0].status,
    "active",
  );
});
test("MFA enrollment encrypts secrets, blocks replay and supports single-use recovery", async () => {
  const { enrollMfa, confirmMfa, verifyMfa, mfaEnabled, totp } =
    await import("../lib/mfa");
  const enrolled = await enrollMfa(omar.id, omar.email);
  const code = totp(enrolled.secret, Math.floor(Date.now() / 30000));
  const { backupCodes } = await confirmMfa(omar.id, code);
  assert(await mfaEnabled(omar.id));
  const [stored] = await query(
    "SELECT encrypted_secret,backup_hashes FROM user_mfa WHERE user_id=$1",
    [omar.id],
  );
  assert(!stored.encrypted_secret.includes(enrolled.secret));
  assert(!stored.backup_hashes.includes(backupCodes[0]));
  await assert.rejects(() => verifyMfa(omar.id, code), /already been used/);
  await verifyMfa(omar.id, backupCodes[0]);
  await assert.rejects(() => verifyMfa(omar.id, backupCodes[0]));
  const request = new Request("http://localhost:3000/api/auth/login", {
    headers: { Origin: "http://localhost:3000" },
  });
  const challenge = await authAction("login", request, {
    email: omar.email,
    password: "YouConect-demo-2026!",
  });
  assert((challenge.data as { mfaRequired: boolean }).mfaRequired);
  assert(!challenge.token);
  const session = await authAction("login", request, {
    email: omar.email,
    password: "YouConect-demo-2026!",
    code: backupCodes[1],
  });
  assert(session.token);
  assert((await userFromToken(session.token))?.mfa_verified);
});
