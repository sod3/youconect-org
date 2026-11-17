import { z, ZodError } from "zod";
import { randomUUID } from "node:crypto";
import {
  requireUser,
  assertOrigin,
  rateLimit,
  sessionCookie,
  hashToken,
  cookieToken,
  requireAdminMfa,
} from "@/lib/auth";
import { authAction } from "@/lib/auth-service";
import { query, demoEnabled } from "@/lib/db";
import { AppError, invariant } from "@/lib/errors";
import {
  listPosts,
  createPost,
  postAction,
  comments,
} from "@/lib/social-service";
import {
  listConversations,
  conversationDetail,
  createConversation,
  sendMessage,
  conversationAction,
  messageAction,
} from "@/lib/message-service";
import {
  listOrganizations,
  organizationDetail,
  createOrganization,
  requestMembership,
  listCommunities,
  joinCommunity,
  createCommunity,
  listBridges,
  createBridge,
  bridgeAction,
} from "@/lib/organization-service";
import {
  listEvents,
  createEvent,
  rsvp,
  listOpportunities,
  createOpportunity,
  opportunityAction,
  search,
} from "@/lib/discovery-service";
import {
  adminOverview,
  adminAction,
  platformOverview,
  platformAction,
} from "@/lib/admin-service";
import { uploadFile, downloadFile } from "@/lib/upload-service";
import {
  getProfile,
  updateProfile,
  followUser,
  blockUser,
  deleteAccount,
  exportAccount,
} from "@/lib/profile-service";
import { requireMember } from "@/lib/permissions";
import { mfaEnabled, enrollMfa, confirmMfa, disableMfa } from "@/lib/mfa";
import { readLimitedBody } from "@/lib/http";
import { readFile } from "node:fs/promises";
import nodePath from "node:path";
import { dataDir } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const requestId = randomUUID();
  try {
    const path = (await params).path,
      method = request.method,
      url = new URL(request.url),
      write = !["GET", "HEAD"].includes(method);
    const routes: Record<string, RegExp> = {
      GET: /^(security\/mfa|health|plans|demo-status|me|bootstrap|search|notifications|posts|posts\/[^/]+|posts\/[^/]+\/comments|conversations|conversations\/[^/]+|organizations|organizations\/[^/]+|organizations\/[^/]+\/members|communities|communities\/[^/]+|bridges|bridges\/[^/]+|bridges\/[^/]+\/members|events|events\/[^/]+|opportunities|opportunities\/[^/]+|profiles\/[^/]+|uploads\/[^/]+|account\/export|admin\/[^/]+|platform)$/,
      POST: /^(dev\/shutdown|security\/mfa\/(enroll|confirm|disable)|auth\/(login|signup|demo|verify|forgot-password|reset-password|logout|onboarding)|contact|posts|posts\/[^/]+\/(comments|reaction|save|vote|report)|conversations|conversations\/[^/]+\/(messages|read|preferences|participants|report)|organizations|organizations\/[^/]+\/(join|leave)|organizations\/[^/]+\/channels\/[^/]+\/join|communities|communities\/[^/]+\/join|bridges|bridges\/[^/]+\/(approve|reject|close|members)|events|events\/[^/]+\/rsvp|opportunities|opportunities\/[^/]+\/(save|apply)|profiles\/[^/]+\/(follow|block)|notifications|notifications\/[^/]+|uploads|admin\/[^/]+\/(membership|settings|department|moderate|trial|invoice|attendance|transfer)|platform\/(verify|reconcile|moderate))$/,
      PATCH: /^(posts|messages|profiles)\/[^/]+$/,
      DELETE: /^((posts|messages)\/[^/]+|account)$/,
    };
    if (!routes[method]?.test(path.join("/")))
      throw new AppError(
        405,
        "This route does not support that request method.",
        "METHOD_NOT_ALLOWED",
      );
    if (write) assertOrigin(request);
    const isUpload = path[0] === "uploads" && method === "POST";
    invariant(
      Number(request.headers.get("content-length") || 0) <=
        (isUpload ? 5300000 : 64000),
      "This request is too large.",
      413,
    );
    let body: Record<string, unknown> = {};
    if (write && !isUpload) {
      try {
        const bytes = await readLimitedBody(request, 64000);
        body = JSON.parse(new TextDecoder().decode(bytes));
        invariant(
          body && typeof body === "object" && !Array.isArray(body),
          "Use a JSON object.",
          400,
        );
      } catch (e) {
        if (e instanceof AppError) throw e;
        throw new AppError(400, "The request contains invalid JSON.");
      }
    }
    const ok = (
      data: unknown,
      status = 200,
      headers: Record<string, string> = {},
    ) =>
      Response.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
          ...headers,
        },
      });
    if (path[0] === "health") {
      await query("SELECT 1");
      return ok({
        status: "ok",
        database: "connected",
        at: new Date().toISOString(),
      });
    }
    if (path[0] === "plans" && method === "GET")
      return ok({
        items: await query("SELECT * FROM plans ORDER BY price_pkr NULLS LAST"),
      });
    if (path[0] === "demo-status" && method === "GET")
      return ok({ enabled: demoEnabled() });
    if (path[0] === "dev" && path[1] === "shutdown") {
      invariant(process.env.NODE_ENV !== "production", "Not found.", 404);
      const secret = await readFile(
        nodePath.join(dataDir(), "dev-control.key"),
        "utf8",
      );
      invariant(
        secret.length >= 32 &&
          secret === request.headers.get("x-youconect-control"),
      );
      setTimeout(() => process.emit("SIGTERM"), 250);
      return ok({ ok: true });
    }
    if (path[0] === "auth" && method === "POST") {
      const result = await authAction(path[1], request, body);
      return ok(
        result.data,
        200,
        result.token !== undefined
          ? {
              "Set-Cookie": result.token
                ? sessionCookie(result.token)
                : "yc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
            }
          : {},
      );
    }
    if (path[0] === "contact" && method === "POST") {
      await rateLimit("contact:global", 20, 600);
      const data = z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z.email().max(254),
          organization: z.string().max(150).default(""),
          message: z.string().trim().min(10).max(5000),
        })
        .parse(body);
      await query(
        "INSERT INTO contact_requests(id,name,email,organization,message) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), data.name, data.email, data.organization, data.message],
      );
      return ok({ ok: true });
    }
    const user = await requireUser(request);
    await rateLimit(
      `api:${write ? "write" : "read"}:${user.id}`,
      write ? 100 : 500,
      60,
    );
    if (
      write &&
      (path[0] === "bridges" ||
        path[0] === "admin" ||
        path[0] === "platform" ||
        body.official === true ||
        (path[0] === "conversations" && body.kind === "channel") ||
        (["communities", "events", "opportunities"].includes(path[0]) &&
          !!body.organization_id))
    )
      requireAdminMfa(user);
    if (path[0] === "security" && path[1] === "mfa") {
      invariant(
        user.email_verified,
        "Verify your email before setting up an authenticator.",
      );
      await rateLimit(`mfa:${user.id}`, 10, 300);
      if (method === "GET")
        return ok({
          enabled: await mfaEnabled(user.id),
          productionEnforced: process.env.NODE_ENV === "production",
        });
      if (path[2] === "enroll") return ok(await enrollMfa(user.id, user.email));
      if (path[2] === "confirm") {
        const result = await confirmMfa(
          user.id,
          z.string().min(6).max(30).parse(body.code),
        );
        await query(
          "UPDATE sessions SET mfa_verified=true WHERE token_hash=$1 AND user_id=$2",
          [hashToken(cookieToken(request.headers.get("cookie"))), user.id],
        );
        await query(
          "DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2",
          [user.id, hashToken(cookieToken(request.headers.get("cookie")))],
        );
        return ok(result);
      }
      if (path[2] === "disable")
        return ok(
          await disableMfa(
            user.id,
            z.string().max(30).parse(body.code),
            z.string().max(128).parse(body.password),
          ),
        );
    }
    if (path[0] === "me") return ok({ user });
    if (path[0] === "bootstrap") {
      const [organizations, communities, events, notifications, suggestions] =
        await Promise.all([
          listOrganizations(user.id, true),
          listCommunities(user.id),
          listEvents(user.id),
          query(
            "SELECT id,title,body,href,kind,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
            [user.id],
          ),
          query(
            "SELECT id,name,headline,avatar FROM users WHERE id<>$1 AND privacy->>'profile'='public' AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.following_id=users.id) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE b.blocker_id=$1 AND b.blocked_id=users.id) ORDER BY created_at LIMIT 4",
            [user.id],
          ),
        ]);
      return ok({
        user,
        organizations: organizations.items,
        communities: communities.items,
        events: events.items,
        notifications,
        suggestions,
        demo: demoEnabled() && user.email.endsWith("@demo.youconect.local"),
      });
    }
    if (path[0] === "posts") {
      if (path.length === 1)
        return ok(
          method === "GET"
            ? await listPosts(user.id, url.searchParams)
            : await createPost(user, body),
          method === "GET" ? 200 : 201,
        );
      if (path[2] === "comments")
        return ok(
          await comments(user, path[1], method === "POST" ? body : undefined),
        );
      if (path.length === 2 && method === "GET") {
        const post = (
          await listPosts(user.id, new URLSearchParams({ id: path[1] }))
        ).items[0];
        invariant(post, "This post is unavailable.", 404);
        return ok({ post });
      }
      return ok(await postAction(user, path[1], path[2] || "", body, method));
    }
    if (path[0] === "conversations") {
      if (path.length === 1)
        return ok(
          method === "GET"
            ? await listConversations(user.id)
            : await createConversation(user, body),
        );
      if (path.length === 2 && method === "GET")
        return ok(await conversationDetail(user.id, path[1], url.searchParams));
      if (path[2] === "messages" && method === "POST")
        return ok(
          await sendMessage(user, { ...body, conversation_id: path[1] }),
          201,
        );
      return ok(await conversationAction(user, path[1], path[2], body));
    }
    if (path[0] === "messages")
      return ok(await messageAction(user, path[1], body, method));
    if (path[0] === "organizations") {
      if (path.length === 1)
        return ok(
          method === "GET"
            ? await listOrganizations(user.id)
            : await createOrganization(user, body),
        );
      if (path[2] === "members" && method === "GET") {
        await requireMember(user.id, path[1]);
        return ok({
          items: await query(
            "SELECT u.id,u.name,u.headline,u.avatar FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.status='active' ORDER BY u.name LIMIT 250",
            [path[1]],
          ),
        });
      }
      if (path[2] === "join") return ok(await requestMembership(user, path[1]));
      if (path[2] === "leave") {
        const m = await requireMember(user.id, path[1]);
        invariant(
          m.role !== "owner",
          "Transfer ownership before leaving.",
          400,
        );
        await query(
          "DELETE FROM memberships WHERE user_id=$1 AND organization_id=$2",
          [user.id, path[1]],
        );
        return ok({ ok: true });
      }
      if (path[2] === "channels" && path[4] === "join") {
        await requireMember(user.id, path[1]);
        const [c] = await query(
          "SELECT id FROM conversations WHERE id=$1 AND organization_id=$2 AND visibility='organization'",
          [path[3], path[1]],
        );
        invariant(c);
        await query(
          "INSERT INTO conversation_participants(conversation_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [c.id, user.id],
        );
        return ok({ ok: true });
      }
      return ok(await organizationDetail(user.id, path[1]));
    }
    if (path[0] === "communities") {
      if (path.length === 1)
        return ok(
          method === "GET"
            ? await listCommunities(user.id)
            : await createCommunity(user, body),
        );
      if (path[2] === "join")
        return ok(await joinCommunity(user, path[1], body.leave === true));
      const item = (await listCommunities(user.id)).items.find(
        (c) => c.id === path[1],
      );
      invariant(item, "This community is private or unavailable.", 404);
      return ok({ community: item });
    }
    if (path[0] === "bridges") {
      if (path.length === 1)
        return ok(
          method === "GET"
            ? await listBridges(user.id)
            : await createBridge(user, body),
        );
      if (path[2] === "members" && method === "GET") {
        const bridge = (await listBridges(user.id)).items.find(
          (b) => b.id === path[1],
        );
        invariant(bridge);
        const admin = await query(
          "SELECT 1 FROM memberships WHERE user_id=$1 AND organization_id IN($2,$3) AND status='active' AND role IN('owner','admin')",
          [user.id, bridge.proposer_org_id, bridge.target_org_id],
        );
        invariant(admin.length);
        return ok({
          items: await query(
            "SELECT u.id,u.name,m.organization_id FROM bridge_members bm JOIN users u ON u.id=bm.user_id JOIN memberships m ON m.user_id=u.id AND m.organization_id IN($2,$3) AND m.status='active' WHERE bm.bridge_id=$1",
            [path[1], bridge.proposer_org_id, bridge.target_org_id],
          ),
        });
      }
      if (write) return ok(await bridgeAction(user, path[1], path[2], body));
      const item = (await listBridges(user.id)).items.find(
        (b) => b.id === path[1],
      );
      invariant(item, "Bridge not found.", 404);
      return ok({ bridge: item });
    }
    if (path[0] === "events") {
      if (path.length === 1)
        return ok(
          method === "GET"
            ? await listEvents(user.id, url.searchParams)
            : await createEvent(user, body),
        );
      if (path[2] === "rsvp")
        return ok(await rsvp(user, path[1], body.cancel === true));
      const event = (
        await listEvents(user.id, new URLSearchParams({ id: path[1] }))
      ).items[0];
      invariant(event, "Event not found.", 404);
      return ok({ event });
    }
    if (path[0] === "opportunities") {
      if (path.length === 1)
        return ok(
          method === "GET"
            ? await listOpportunities(user.id, url.searchParams)
            : await createOpportunity(user, body),
        );
      if (write)
        return ok(await opportunityAction(user, path[1], path[2], body));
      const item = (
        await listOpportunities(user.id, new URLSearchParams({ id: path[1] }))
      ).items[0];
      invariant(item, "Opportunity not found.", 404);
      return ok({ opportunity: item });
    }
    if (path[0] === "profiles") {
      if (path[2] === "follow")
        return ok(await followUser(user, path[1], body.active !== false));
      if (path[2] === "block")
        return ok(await blockUser(user, path[1], body.active !== false));
      if (write) {
        invariant(path[1] === user.id);
        return ok(await updateProfile(user, body));
      }
      return ok(await getProfile(user, path[1]));
    }
    if (path[0] === "account" && path[1] === "export")
      return ok(await exportAccount(user));
    if (path[0] === "account" && method === "DELETE")
      return ok(await deleteAccount(user));
    if (path[0] === "search")
      return ok(await search(user.id, url.searchParams.get("q") || ""));
    if (path[0] === "notifications") {
      if (write) {
        if (body.all === true)
          await query(
            "UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL",
            [user.id],
          );
        else
          await query(
            "UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2",
            [path[1], user.id],
          );
        return ok({ ok: true });
      }
      return ok({
        items: await query(
          "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
          [user.id],
        ),
      });
    }
    if (path[0] === "uploads")
      return method === "POST"
        ? ok(await uploadFile(user, request), 201)
        : await downloadFile(user, path[1]);
    if (path[0] === "admin")
      return ok(
        method === "GET"
          ? await adminOverview(user, path[1])
          : await adminAction(user, path[1], path[2], body),
      );
    if (path[0] === "platform") {
      requireAdminMfa(user);
      return ok(
        method === "GET"
          ? await platformOverview(user)
          : await platformAction(user, path[1], body),
      );
    }
    throw new AppError(404, "This API route does not exist.");
  } catch (error) {
    if (error instanceof ZodError)
      return Response.json(
        {
          error: error.issues[0]?.message || "Check your input.",
          code: "VALIDATION_ERROR",
          requestId,
        },
        { status: 400 },
      );
    if (error instanceof AppError)
      return Response.json(
        { error: error.message, code: error.code, requestId },
        { status: error.status },
      );
    console.error(
      JSON.stringify({
        requestId,
        message: error instanceof Error ? error.message : "Unknown error",
        path: new URL(request.url).pathname,
      }),
    );
    return Response.json(
      {
        error: "Something went wrong. Please try again.",
        code: "INTERNAL_ERROR",
        requestId,
      },
      { status: 500 },
    );
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
