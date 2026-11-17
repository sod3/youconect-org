import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  hashToken,
  cookieToken,
  assertOrigin,
} from "../lib/auth";
import { base32, decode32, totp } from "../lib/mfa";
test("passwords use distinct salts and verify without plaintext storage", async () => {
  const a = await hashPassword("A long and unique password"),
    b = await hashPassword("A long and unique password");
  assert.notEqual(a, b);
  assert(!a.includes("password"));
  assert(await verifyPassword("A long and unique password", a));
  assert.equal(await verifyPassword("wrong", a), false);
  assert.equal(await verifyPassword("wrong", "invalid"), false);
});
test("session parsing and token hashing are deterministic and bounded", () => {
  assert.equal(
    cookieToken("other=1; yc_session=secret-token; theme=light"),
    "secret-token",
  );
  assert.equal(cookieToken(null), "");
  assert.equal(hashToken("secret").length, 64);
  assert.notEqual(hashToken("secret"), hashToken("different"));
});
test("state-changing requests reject absent and foreign origins", () => {
  assert.throws(
    () => assertOrigin(new Request("http://localhost:3000/api/posts")),
    /untrusted origin/,
  );
  assert.throws(
    () =>
      assertOrigin(
        new Request("http://localhost:3000/api/posts", {
          headers: { Origin: "https://attacker.example" },
        }),
      ),
    /untrusted origin/,
  );
  assert.doesNotThrow(() =>
    assertOrigin(
      new Request("http://localhost:3000/api/posts", {
        headers: { Origin: "http://localhost:3000" },
      }),
    ),
  );
});
test("authenticator codes match the RFC 6238 SHA-1 reference vector", () => {
  const bytes = Buffer.from("12345678901234567890"),
    secret = base32(bytes);
  assert.deepEqual(decode32(secret), bytes);
  assert.equal(totp(secret, 1), "287082");
  assert.equal(totp(secret, Math.floor(1111111109 / 30)), "081804");
});
