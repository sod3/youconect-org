import { test, expect, type APIRequestContext } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
async function demo(request: APIRequestContext, person: string) {
  const response = await request.post("/api/auth/demo", {
    data: { person },
    headers: { Origin: base },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}
test("marketing routes and mobile layout render without broken destinations", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/features",
    "/solutions/universities",
    "/pricing",
    "/security",
    "/contact",
    "/help",
    "/privacy",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("h1,h2").first()).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "One Place. Every Connection.",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("a person can publish, comment, save, switch organizations and RSVP", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: /Ayla Khan Organization owner/ })
    .click();
  await expect(
    page.getByRole("heading", { name: /Good to see you, Ayla/ }),
  ).toBeVisible({ timeout: 45000 });
  const fixtures = await (
    await page.request.get("/api/posts?author=demo-ayla")
  ).json();
  for (const p of fixtures.items as { id: string; content: string }[])
    if (p.content.startsWith("E2E connected thought "))
      await page.request.delete(`/api/posts/${p.id}`, {
        headers: { Origin: base },
        data: {},
      });
  await page
    .getByRole("button", { name: "Create a post", exact: true })
    .first()
    .click();
  const message = `E2E connected thought ${randomUUID()}`;
  await page.getByLabel("Post content", { exact: true }).fill(message);
  await page.getByRole("button", { name: "Share post", exact: true }).click();
  const post = page.locator("article").filter({ hasText: message });
  await expect(post).toBeVisible();
  const createdPostId = (await post.getAttribute("id"))!.slice(5);
  await post.getByRole("button", { name: "Comment", exact: true }).click();
  await post
    .getByLabel("Write a comment", { exact: true })
    .fill("A real conversation, saved on the server.");
  await post.getByRole("button", { name: "Send comment", exact: true }).click();
  await expect(
    post.getByText("A real conversation, saved on the server."),
  ).toBeVisible();
  await post.getByLabel("Save post", { exact: true }).click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Your personal space All your worlds, together",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "NU Northstar University Organization owner",
      exact: true,
    })
    .click();
  await page.getByRole("link", { name: "Events", exact: true }).click();
  const event = page.locator(".event-card").first();
  await expect(event).toBeVisible();
  const going = event.getByRole("button", { name: "Going", exact: true });
  if (await going.count()) await going.click();
  await event.getByRole("button", { name: "Count me in", exact: true }).click();
  await expect(
    event.getByRole("button", { name: "Going", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".event-card")
      .first()
      .getByRole("button", { name: "Going", exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.delete(`/api/posts/${createdPostId}`, {
        headers: { Origin: base },
        data: {},
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: /Good to see you, Ayla/ }),
  ).toBeVisible();
  await expect(page.locator(".post-card").first()).toBeVisible();
  const photo = page.locator(".post-media img").first();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: "docs/preview-desktop.png" });
});
test("registration, verification, membership approval and tenant denial work over HTTP", async ({
  playwright,
}) => {
  const person = await playwright.request.newContext({ baseURL: base }),
    admin = await playwright.request.newContext({ baseURL: base });
  const email = `e2e-${randomUUID()}@example.test`;
  const signup = await person.post("/api/auth/signup", {
    headers: { Origin: base },
    data: { name: "E2E Person", email, password: "A-private-test-password!" },
  });
  expect(signup.ok()).toBeTruthy();
  const { devVerificationUrl } = await signup.json();
  const verification = await person.post("/api/auth/verify", {
    headers: { Origin: base },
    data: { token: new URL(devVerificationUrl).searchParams.get("token") },
  });
  expect(verification.ok()).toBeTruthy();
  expect(
    (
      await person.post("/api/auth/onboarding", {
        headers: { Origin: base },
        data: { headline: "A curious tester", interests: ["Design"] },
      })
    ).ok(),
  ).toBeTruthy();
  const me = (await (await person.get("/api/me")).json()).user;
  expect((await person.get("/api/posts/campus-announcement")).status()).toBe(
    404,
  );
  expect(
    (
      await person.post("/api/organizations/northstar/join", {
        headers: { Origin: base },
        data: {},
      })
    ).ok(),
  ).toBeTruthy();
  await demo(admin, "ayla");
  expect(
    (
      await admin.post("/api/admin/northstar/membership", {
        headers: { Origin: base },
        data: { user_id: me.id, status: "active" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (await person.get("/api/posts/campus-announcement")).ok(),
  ).toBeTruthy();
  expect((await person.get("/api/admin/lumina")).status()).toBe(403);
  expect((await person.get("/api/posts/bridge-welcome")).status()).toBe(404);
  expect((await person.get("/api/conversations/dm-zara")).status()).toBe(403);
  expect(
    (
      await person.delete("/api/account", {
        headers: { Origin: base },
        data: {},
      })
    ).ok(),
  ).toBeTruthy();
  expect((await person.get("/api/me")).status()).toBe(401);
  await person.dispose();
  await admin.dispose();
});
test("two authenticated sessions exchange messages over real sockets and reconcile after reconnect", async ({
  playwright,
}) => {
  const ayla = await playwright.request.newContext({ baseURL: base }),
    zara = await playwright.request.newContext({ baseURL: base });
  await demo(ayla, "ayla");
  await demo(zara, "zara");
  const aCookie = (await ayla.storageState()).cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; "),
    zCookie = (await zara.storageState()).cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  const conversationResponse = await ayla.post("/api/conversations", {
    headers: { Origin: base },
    data: { kind: "direct", participants: ["demo-zara"] },
  });
  expect(conversationResponse.ok()).toBeTruthy();
  const conversation = (await conversationResponse.json()).id;
  const sockets: Socket[] = [];
  try {
    const sender = io(base, {
        transports: ["websocket"],
        extraHeaders: { Cookie: aCookie, Origin: base },
        autoConnect: false,
      }),
      receiver = io(base, {
        transports: ["websocket"],
        extraHeaders: { Cookie: zCookie, Origin: base },
        autoConnect: false,
      });
    sockets.push(sender, receiver);
    await Promise.all(
      sockets.map(
        (s) =>
          new Promise<void>((resolve, reject) => {
            s.once("connect", () => resolve());
            s.once("connect_error", reject);
            s.connect();
          }),
      ),
    );
    const content = `Socket delivery ${randomUUID()}`,
      client_id = randomUUID();
    const incoming = new Promise<Record<string, string>>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(new Error("Recipient did not receive a real-time message.")),
        12000,
      );
      receiver.on("message", (m) => {
        if (m.client_id === client_id) {
          clearTimeout(timer);
          resolve(m);
        }
      });
    });
    const ack = await sender.timeout(12000).emitWithAck("message:send", {
      conversation_id: conversation,
      client_id,
      content,
    });
    expect(ack.ok, ack.error).toBeTruthy();
    expect((await incoming).content).toBe(content);
    const duplicate = await sender.timeout(12000).emitWithAck("message:send", {
      conversation_id: conversation,
      client_id,
      content,
    });
    expect(duplicate.message.id).toBe(ack.message.id);
    receiver.disconnect();
    const offline = `Offline reconciliation ${randomUUID()}`;
    expect(
      (
        await ayla.post(`/api/conversations/${conversation}/messages`, {
          headers: { Origin: base },
          data: { client_id: randomUUID(), content: offline },
        })
      ).ok(),
    ).toBeTruthy();
    await new Promise<void>((resolve, reject) => {
      receiver.once("connect", () => resolve());
      receiver.once("connect_error", reject);
      receiver.connect();
    });
    const history = await (
      await zara.get(`/api/conversations/${conversation}`)
    ).json();
    expect(
      history.items.filter(
        (m: { client_id: string }) => m.client_id === client_id,
      ),
    ).toHaveLength(1);
    expect(
      history.items.some((m: { content: string }) => m.content === offline),
    ).toBeTruthy();
  } finally {
    sockets.forEach((s) => s.disconnect());
    await ayla.dispose();
    await zara.dispose();
  }
});
test("the mobile app has usable navigation, no overflow and a working inbox", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page.request, "ayla");
  await page.goto("/app");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("navigation", { name: "Mobile navigation", exact: true })
    .getByRole("link", { name: "Messages", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Messages.", exact: true }),
  ).toBeVisible();
  await page
    .locator(".conversation-row")
    .filter({ hasText: "Zara Ahmed" })
    .first()
    .click();
  await expect(
    page.getByLabel("Write a message", { exact: true }),
  ).toBeVisible();
  const message = `Mobile message ${randomUUID()}`;
  await page.getByLabel("Write a message", { exact: true }).fill(message);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.locator(".chat-panel").getByText(message, { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".message-row")
      .filter({ hasText: message })
      .getByText("Sent", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".chat-panel").getByText(message, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: /Good to see you, Ayla/ }),
  ).toBeVisible();
  await expect(page.locator(".post-card").first()).toBeVisible();
  await page.screenshot({ path: "docs/preview-mobile.png" });
});
