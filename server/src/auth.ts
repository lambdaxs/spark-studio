import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { writeEnvVar } from "./envfile.js";

const scrypt = promisify(scryptCb);
const COOKIE = "wb_session";
const USER_KEY = "AUTH_USERNAME";
const HASH_KEY = "AUTH_PASSWORD_HASH";
const PLAIN_KEY = "AUTH_PASSWORD";
const SECRET_KEY = "SESSION_SECRET";
const N = 16384;
const r = 8;
const p = 1;
const keylen = 64;
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

const attempts = new Map<string, { n: number; reset: number }>();

type Session = { u: string; exp: number };

function currentUsername() {
  return process.env[USER_KEY]?.trim() || "";
}

function currentHash() {
  return process.env[HASH_KEY]?.trim() || "";
}

export function hasCredentials() {
  return Boolean(currentUsername() && currentHash());
}

function sessionSecret() {
  const existing = process.env[SECRET_KEY]?.trim();
  if (existing) return existing;
  const secret = randomBytes(32).toString("base64url");
  process.env[SECRET_KEY] = secret;
  writeEnvVar(SECRET_KEY, secret);
  return secret;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, keylen, { N, r, p })) as Buffer;
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const block = Number(parts[2]);
  const parallel = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  const actual = (await scrypt(password, salt, expected.length, {
    N: cost,
    r: block,
    p: parallel,
  })) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

async function dummyVerify(password: string) {
  await hashPassword(password);
}

export async function setCredentials(username: string, password: string) {
  const name = username.trim();
  if (!name || name.length > 64) throw new Error("invalid username");
  if (password.length < 8) throw new Error("password too short");
  const hash = await hashPassword(password);
  process.env[USER_KEY] = name;
  process.env[HASH_KEY] = hash;
  writeEnvVar(USER_KEY, name);
  writeEnvVar(HASH_KEY, hash);
  writeEnvVar(PLAIN_KEY, "");
}

export async function ingestPlainPasswordFromEnv() {
  const plain = process.env[PLAIN_KEY]?.trim();
  const name = currentUsername();
  if (!plain || !name) return;
  await setCredentials(name, plain);
}

function signSession(username: string) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + SESSION_MS })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function parseSession(token: string): Session | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!data.u || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (data.u !== currentUsername()) return null;
    return data;
  } catch {
    return null;
  }
}

function cookieSecure(c: Context) {
  const forwarded = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  return forwarded === "https" || new URL(c.req.url).protocol === "https:";
}

export function readSession(c: Context): Session | null {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  return parseSession(token);
}

export function attachSession(c: Context, username: string) {
  setCookie(c, COOKIE, signSession(username), {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(SESSION_MS / 1000),
    secure: cookieSecure(c),
  });
}

export function clearSession(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}

export function clientKey(c: Context) {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";
}

export function loginLimited(ip: string) {
  const now = Date.now();
  const row = attempts.get(ip);
  if (!row || row.reset < now) {
    attempts.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  row.n += 1;
  return row.n > MAX_ATTEMPTS;
}

export async function checkLogin(username: string, password: string) {
  const name = username.trim();
  const expectedUser = currentUsername();
  const hash = currentHash();
  if (!expectedUser || !hash) {
    await dummyVerify(password);
    return false;
  }
  if (name !== expectedUser) {
    await dummyVerify(password);
    return false;
  }
  return verifyPassword(password, hash);
}

export function authStatus(c: Context) {
  const session = readSession(c);
  return {
    authenticated: Boolean(session),
    setupRequired: !hasCredentials(),
    username: session?.u ?? null,
  };
}

export function isPublicApi(path: string) {
  return (
    path === "/api/health" ||
    path === "/api/auth/me" ||
    path === "/api/auth/login" ||
    path === "/api/auth/logout" ||
    path === "/api/auth/setup" ||
    path.startsWith("/api/import/") ||
    path.startsWith("/api/export/")
  );
}
