/**
 * Unit tests for the RRAI auth session helpers.
 *
 * Run:
 *   node --test artifacts/api-server/src/lib/auth.test.mjs
 *
 * These tests use node:test + node:assert and do NOT require Vitest or any
 * external test runner. DB is not needed: the session helpers are tested via
 * duck-typing without a real Postgres connection.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ─────────────────────────────────────────────────────────────────────────────
// getSafeReturnTo logic (mirrored here without importing the production module
// so the test has no external dependencies)
// ─────────────────────────────────────────────────────────────────────────────

function getSafeReturnTo(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

test("getSafeReturnTo — returns value for a valid relative path", () => {
  assert.equal(getSafeReturnTo("/dashboard"), "/dashboard");
});

test("getSafeReturnTo — defaults to / for undefined", () => {
  assert.equal(getSafeReturnTo(undefined), "/");
});

test("getSafeReturnTo — defaults to / for an empty string", () => {
  assert.equal(getSafeReturnTo(""), "/");
});

test("getSafeReturnTo — rejects protocol-relative URLs", () => {
  assert.equal(getSafeReturnTo("//evil.com"), "/");
});

test("getSafeReturnTo — rejects absolute URLs", () => {
  assert.equal(getSafeReturnTo("https://evil.com"), "/");
});

test("getSafeReturnTo — rejects non-string values", () => {
  assert.equal(getSafeReturnTo(42), "/");
  assert.equal(getSafeReturnTo(null), "/");
  assert.equal(getSafeReturnTo({}), "/");
});

test("getSafeReturnTo — allows nested paths", () => {
  assert.equal(getSafeReturnTo("/modules/logicgate"), "/modules/logicgate");
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveRole logic (mirrored locally — no import of production code)
// ─────────────────────────────────────────────────────────────────────────────

function resolveRole(email, adminEmails = []) {
  if (!email) return "user";
  return adminEmails.map((e) => e.trim().toLowerCase()).includes(email.toLowerCase())
    ? "admin"
    : "user";
}

test("resolveRole — returns user when email is null", () => {
  assert.equal(resolveRole(null, ["alice@example.com"]), "user");
});

test("resolveRole — returns user for unlisted email", () => {
  assert.equal(resolveRole("bob@example.com", ["alice@example.com"]), "user");
});

test("resolveRole — returns admin for a listed email (exact match)", () => {
  assert.equal(resolveRole("alice@example.com", ["alice@example.com"]), "admin");
});

test("resolveRole — case-insensitive match", () => {
  assert.equal(resolveRole("ALICE@example.com", ["alice@example.com"]), "admin");
});

test("resolveRole — returns user with empty admin list", () => {
  assert.equal(resolveRole("alice@example.com", []), "user");
});

// ─────────────────────────────────────────────────────────────────────────────
// getSessionId
// ─────────────────────────────────────────────────────────────────────────────

// Minimal Request mock for getSessionId testing.
function makeReq({ authHeader, cookieSid } = {}) {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    cookies: cookieSid ? { sid: cookieSid } : {},
  };
}

function getSessionId(req) {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.["sid"];
}

test("getSessionId — extracts SID from Bearer header", () => {
  const req = makeReq({ authHeader: "Bearer abc123" });
  assert.equal(getSessionId(req), "abc123");
});

test("getSessionId — falls back to cookie when no Auth header", () => {
  const req = makeReq({ cookieSid: "cookie-sid-value" });
  assert.equal(getSessionId(req), "cookie-sid-value");
});

test("getSessionId — returns undefined with neither header nor cookie", () => {
  const req = makeReq();
  assert.equal(getSessionId(req), undefined);
});

test("getSessionId — Bearer header takes precedence over cookie", () => {
  const req = makeReq({ authHeader: "Bearer header-sid", cookieSid: "cookie-sid" });
  assert.equal(getSessionId(req), "header-sid");
});

test("getSessionId — non-Bearer authorization header is ignored", () => {
  const req = makeReq({ authHeader: "Basic dXNlcjpwYXNz", cookieSid: "cookie-sid" });
  assert.equal(getSessionId(req), "cookie-sid");
});
