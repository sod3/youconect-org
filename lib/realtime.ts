import type { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import { query } from "./db";
import { userFromToken } from "./auth";
declare global {
  var __youconectIo: Server | undefined;
}
export async function emitToUser(userId: string, event: string, data: unknown) {
  const io = globalThis.__youconectIo;
  if (!io) return;
  for (const socketId of io.sockets.adapter.rooms.get(`user:${userId}`) || []) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    try {
      const user = await userFromToken(socket.data.token);
      if (user?.id === userId) socket.emit(event, data);
      else socket.disconnect(true);
    } catch {
      /* No private data is emitted when session validation is unavailable. */
    }
  }
}
export async function notify(
  userId: string,
  title: string,
  body: string,
  href: string,
  kind = "activity",
) {
  const id = randomUUID();
  const [notification] = await query(
    "INSERT INTO notifications(id,user_id,title,body,href,kind) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [id, userId, title, body, href, kind],
  );
  await emitToUser(userId, "notification", notification);
  return notification;
}
