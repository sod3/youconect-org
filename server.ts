import "dotenv/config";
import http from "node:http";
import type { Socket as NetSocket } from "node:net";
import next from "next";
import { Server } from "socket.io";
import { getDb } from "./lib/db";
import { userFromToken, cookieToken, rateLimit } from "./lib/auth";
import { requireConversation } from "./lib/permissions";
import { sendMessage } from "./lib/message-service";
const dev = process.env.NODE_ENV !== "production",
  port = Number(process.env.PORT || 3000),
  hostname = process.env.HOSTNAME_BIND || "127.0.0.1";
if (!dev && !process.env.APP_URL?.startsWith("https://"))
  throw new Error(
    "Production requires an HTTPS APP_URL behind a trusted reverse proxy.",
  );
await getDb();
const app = next({ dev, hostname, port });
await app.prepare();
const handler = app.getRequestHandler();
const server = http.createServer((req, res) => {
  void handler(req, res);
});
const connections = new Set<NetSocket>();
server.on("connection", (connection) => {
  connections.add(connection);
  connection.once("close", () => connections.delete(connection));
});
const io = new Server(server, {
  maxHttpBufferSize: 64000,
  pingTimeout: 20000,
  allowRequest: (req, cb) => {
    const origin = req.headers.origin;
    cb(
      null,
      !origin ||
        origin === (process.env.APP_URL || `http://localhost:${port}`) ||
        (dev && origin === `http://127.0.0.1:${port}`),
    );
  },
});
globalThis.__youconectIo = io;
io.use(async (socket, nextFn) => {
  try {
    const token = cookieToken(socket.handshake.headers.cookie);
    const user = await userFromToken(token);
    if (!user || !user.email_verified)
      return nextFn(new Error("Sign in with a verified account."));
    socket.data.user = user;
    socket.data.token = token;
    nextFn();
  } catch {
    nextFn(new Error("Unable to authenticate."));
  }
});
io.on("connection", (socket) => {
  void socket.join(`user:${socket.data.user.id}`);
  socket.use(async (_packet, nextFn) => {
    const user = await userFromToken(socket.data.token);
    if (!user) {
      socket.disconnect(true);
      return nextFn(new Error("Session expired."));
    }
    socket.data.user = user;
    nextFn();
  });
  socket.on("message:send", async (data, ack) => {
    try {
      await rateLimit(`socket:${socket.data.user.id}`, 60, 60);
      const message = await sendMessage(socket.data.user, data);
      if (typeof ack === "function") ack({ ok: true, message });
    } catch (error) {
      if (typeof ack === "function")
        ack({
          ok: false,
          error:
            error instanceof Error ? error.message : "Unable to send message.",
        });
    }
  });
  let lastTyping = 0;
  socket.on("typing", async (data) => {
    try {
      if (Date.now() - lastTyping < 1200) return;
      lastTyping = Date.now();
      const user = socket.data.user;
      if (user.privacy?.presence === false) return;
      const id = String(data?.conversation_id || "");
      await requireConversation(user.id, id);
      const db = await getDb();
      const recipients = await db.query(
        "SELECT user_id FROM conversation_participants WHERE conversation_id=$1 AND user_id<>$2",
        [id, user.id],
      );
      for (const p of recipients) {
        try {
          await requireConversation(p.user_id, id);
          io.to(`user:${p.user_id}`).emit("typing", {
            conversation_id: id,
            user_id: user.id,
            name: user.name,
          });
        } catch {
          /* revoked recipient */
        }
      }
    } catch {
      /* invalid or unauthorized typing signals are dropped */
    }
  });
  socket.emit("ready", { user_id: socket.data.user.id });
});
const timer = setInterval(() => {
  for (const socket of io.sockets.sockets.values())
    void userFromToken(socket.data.token).then((user) => {
      if (!user) socket.disconnect(true);
    });
}, 30000);
timer.unref();
server.listen(port, hostname, () =>
  console.log(
    `\nYouConect is ready at http://localhost:${port}\nPersistent database: ${process.env.DATABASE_URL ? "PostgreSQL" : "local embedded PostgreSQL"}\n`,
  ),
);
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);
  io.disconnectSockets(true);
  // Development HMR sockets are upgraded HTTP connections and otherwise keep
  // server.close() waiting indefinitely. Give ordinary requests a brief drain.
  const forceClose = setTimeout(() => {
    for (const connection of connections) connection.destroy();
  }, 1500);
  await new Promise<void>((resolve) => io.close(() => resolve()));
  clearTimeout(forceClose);
  for (const connection of connections) connection.destroy();
  await app.close();
  await (await getDb()).close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
