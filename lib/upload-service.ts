import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { query, dataDir } from "./db";
import { invariant } from "./errors";
import { requireVerified } from "./auth";
import { requireConversation, postVisibility } from "./permissions";
import type { User } from "./types";
import { readLimitedBody } from "./http";
function detectMime(buffer: Buffer) {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return "image/jpeg";
  if (
    buffer.subarray(0, 4).toString() === "RIFF" &&
    buffer.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}
export async function uploadFile(user: User, request: Request) {
  requireVerified(user);
  invariant(
    Number(request.headers.get("content-length") || 0) <= 5300000,
    "Files must be 5 MB or smaller.",
    413,
  );
  const [usage] = await query(
    "SELECT COALESCE(sum(size),0)::bigint bytes FROM uploads WHERE owner_id=$1",
    [user.id],
  );
  invariant(
    Number(usage.bytes) < 100 * 1024 * 1024,
    "Your account has reached the 100 MB local upload limit.",
    413,
  );
  const body = await readLimitedBody(request, 5300000);
  const form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: body as BodyInit,
    }).formData(),
    file = form.get("file");
  invariant(file instanceof File, "Choose a file.", 400);
  invariant(
    file.size > 0 && file.size <= 5 * 1024 * 1024,
    "Files must be 5 MB or smaller.",
    413,
  );
  const buffer = Buffer.from(await file.arrayBuffer()),
    mime = detectMime(buffer);
  invariant(
    mime && mime === file.type,
    "Use a valid JPEG, PNG, WebP, or PDF file.",
    400,
  );
  const id = randomUUID();
  const dir = path.join(dataDir(), "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, id), buffer, { flag: "wx" });
  try {
    await query(
      "INSERT INTO uploads(id,owner_id,filename,mime,size) VALUES($1,$2,$3,$4,$5)",
      [
        id,
        user.id,
        file.name.replace(/[\x00-\x1f]/g, "").slice(0, 150),
        mime,
        file.size,
      ],
    );
  } catch (error) {
    await unlink(path.join(dir, id));
    throw error;
  }
  return {
    id,
    filename: file.name,
    mime,
    size: file.size,
    url: `/api/uploads/${id}`,
  };
}
export async function downloadFile(user: User, id: string) {
  invariant(/^[a-f0-9-]{36}$/.test(id), "File not found.", 404);
  const [file] = await query("SELECT * FROM uploads WHERE id=$1", [id]);
  invariant(file, "File not found.", 404);
  let allowed = file.owner_id === user.id;
  if (!allowed)
    allowed =
      (
        await query(
          `SELECT 1 FROM posts p WHERE p.media @> $2::jsonb AND ${postVisibility()} LIMIT 1`,
          [user.id, JSON.stringify([id])],
        )
      ).length > 0;
  if (!allowed) {
    for (const row of await query(
      "SELECT conversation_id FROM messages WHERE attachment_id=$1 AND NOT deleted",
      [id],
    )) {
      try {
        await requireConversation(user.id, row.conversation_id);
        allowed = true;
        break;
      } catch {
        /* continue */
      }
    }
  }
  invariant(allowed);
  const bytes = await readFile(path.join(dataDir(), "uploads", id));
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${file.mime === "application/pdf" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
