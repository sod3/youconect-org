import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { query, getDb, dataDir } from "./db";
import { hashToken, verifyPassword } from "./auth";
import { invariant } from "./errors";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(buffer: Buffer) {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
export function decode32(value: string) {
  let bits = 0,
    acc = 0;
  const bytes: number[] = [];
  for (const char of value.toUpperCase().replace(/=+$/, "")) {
    const n = alphabet.indexOf(char);
    invariant(n >= 0, "Invalid authenticator secret.", 400);
    acc = (acc << 5) | n;
    bits += 5;
    if (bits >= 8) {
      bytes.push((acc >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
export function totp(secret: string, counter: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", decode32(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 15;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
async function encryptionKey() {
  if (process.env.AUTH_ENCRYPTION_KEY) {
    const bytes = Buffer.from(process.env.AUTH_ENCRYPTION_KEY, "hex");
    invariant(
      bytes.length === 32,
      "AUTH_ENCRYPTION_KEY must be 64 hexadecimal characters.",
      503,
    );
    return bytes;
  }
  invariant(
    process.env.NODE_ENV !== "production",
    "Production requires AUTH_ENCRYPTION_KEY.",
    503,
  );
  const file = path.join(dataDir(), "mfa-encryption.key");
  await mkdir(dataDir(), { recursive: true });
  try {
    return await readFile(file);
  } catch {
    const key = randomBytes(32);
    try {
      await writeFile(file, key, { flag: "wx", mode: 0o600 });
      return key;
    } catch {
      return readFile(file);
    }
  }
}
async function encrypt(secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", await encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((x) => x.toString("hex"))
    .join(".");
}
async function decrypt(value: string) {
  const [iv, tag, ciphertext] = value
    .split(".")
    .map((x) => Buffer.from(x, "hex"));
  const decipher = createDecipheriv("aes-256-gcm", await encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString();
}
export async function mfaEnabled(userId: string) {
  const [row] = await query("SELECT enabled FROM user_mfa WHERE user_id=$1", [
    userId,
  ]);
  return !!row?.enabled;
}
export async function enrollMfa(userId: string, email: string) {
  invariant(
    !(await mfaEnabled(userId)),
    "An authenticator is already enabled.",
    409,
  );
  const secret = base32(randomBytes(20));
  await query(
    "INSERT INTO user_mfa(user_id,encrypted_secret) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET encrypted_secret=excluded.encrypted_secret,last_counter=-1 WHERE user_mfa.enabled=false",
    [userId, await encrypt(secret)],
  );
  return {
    secret,
    uri: `otpauth://totp/YouConect:${encodeURIComponent(email)}?secret=${secret}&issuer=YouConect&algorithm=SHA1&digits=6&period=30`,
  };
}
export async function verifyMfa(
  userId: string,
  code: string,
  enrollment = false,
) {
  return (await getDb()).transaction(async (tx) => {
    const [row] = await tx.query(
      "SELECT * FROM user_mfa WHERE user_id=$1 FOR UPDATE",
      [userId],
    );
    invariant(
      row && (row.enabled || enrollment),
      "Set up your authenticator first.",
      400,
    );
    const trimmed = code.replace(/\s/g, "");
    const backupHash = hashToken(trimmed);
    if (row.enabled && (row.backup_hashes as string[]).includes(backupHash)) {
      await tx.query("UPDATE user_mfa SET backup_hashes=$1 WHERE user_id=$2", [
        JSON.stringify(
          (row.backup_hashes as string[]).filter((h) => h !== backupHash),
        ),
        userId,
      ]);
      return true;
    }
    invariant(
      /^\d{6}$/.test(trimmed),
      "Enter the six-digit code from your authenticator.",
      400,
    );
    const counter = Math.floor(Date.now() / 30000),
      secret = await decrypt(row.encrypted_secret);
    let matching = -1;
    for (const step of [counter - 1, counter, counter + 1]) {
      const expected = totp(secret, step);
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(trimmed)))
        matching = step;
    }
    invariant(
      matching >= 0 && matching > Number(row.last_counter),
      "This code is incorrect or has already been used. Try the next code.",
      400,
    );
    await tx.query("UPDATE user_mfa SET last_counter=$1 WHERE user_id=$2", [
      matching,
      userId,
    ]);
    return true;
  });
}
export async function confirmMfa(userId: string, code: string) {
  await verifyMfa(userId, code, true);
  const codes = Array.from({ length: 8 }, () => randomBytes(6).toString("hex"));
  await query(
    "UPDATE user_mfa SET enabled=true,backup_hashes=$1 WHERE user_id=$2",
    [JSON.stringify(codes.map(hashToken)), userId],
  );
  return { backupCodes: codes };
}
export async function disableMfa(
  userId: string,
  code: string,
  password: string,
) {
  const [user] = await query("SELECT password_hash FROM users WHERE id=$1", [
    userId,
  ]);
  invariant(
    await verifyPassword(password, user.password_hash),
    "Your password is incorrect.",
    400,
  );
  await verifyMfa(userId, code);
  await query("DELETE FROM user_mfa WHERE user_id=$1", [userId]);
  await query("DELETE FROM sessions WHERE user_id=$1", [userId]);
  return { ok: true };
}
