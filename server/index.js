// Darman Studio server: login, shared documents, and AI drafting (Claude or OpenAI).
// It never talks to LinkedIn.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  COLLECTIONS, rev, listDocs, putDoc, deleteDoc, seedIfEmpty,
  findUserByEmail, checkPassword, createSession, sessionUser, endSession,
  listUsers, createUser, deleteUser, setPassword, userCount, randomPassword,
} from "./db.js";
import { askJson, AiError, aiConfigured, aiModel, provider } from "./ai.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const SECURE_COOKIES = process.env.COOKIE_SECURE === "true"; // set true once served over HTTPS
const COOKIE = "studio_session";

/* First start: seed content, and create the admin from env if there are no users. */
const seeded = seedIfEmpty(path.join(here, "seed"));
if (seeded) console.log(`Loaded ${seeded} starter documents.`);
if (userCount() === 0) {
  const email = process.env.ADMIN_EMAIL;
  if (email) {
    const password = process.env.ADMIN_PASSWORD || randomPassword();
    createUser({ email, name: process.env.ADMIN_NAME || "Admin", password, isAdmin: true });
    console.log(`Created admin ${email}${process.env.ADMIN_PASSWORD ? "" : ` with password: ${password}`}`);
  } else {
    console.log("No users yet. Set ADMIN_EMAIL (and ADMIN_PASSWORD) or run: node manage.js add-user <email> <name> --admin");
  }
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  });
  next();
});

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function setSessionCookie(res, token, maxAgeDays = 30) {
  const attrs = [`${COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeDays * 86400}`];
  if (SECURE_COOKIES) attrs.push("Secure");
  res.set("Set-Cookie", attrs.join("; "));
}
function auth(req, res, next) {
  const user = sessionUser(readCookie(req, COOKIE));
  if (!user) return res.status(401).json({ error: "signed_out" });
  req.user = user;
  next();
}
function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "admin_only" });
  next();
}

/* Simple login throttle: 10 failed attempts per IP per 15 minutes. */
const fails = new Map();
function throttled(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.first > 15 * 60e3) { fails.delete(ip); return false; }
  return f.count >= 10;
}
function recordFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.first > 15 * 60e3) fails.set(ip, { first: Date.now(), count: 1 });
  else f.count++;
}

/* ---------- auth ---------- */
app.post("/api/login", (req, res) => {
  const ip = req.ip;
  if (throttled(ip)) return res.status(429).json({ error: "too_many_attempts" });
  const { email, password } = req.body || {};
  const user = typeof email === "string" && findUserByEmail(email);
  if (!user || typeof password !== "string" || !checkPassword(user, password)) {
    recordFail(ip);
    return res.status(401).json({ error: "wrong_credentials" });
  }
  fails.delete(ip);
  setSessionCookie(res, createSession(user.id));
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) endSession(token);
  setSessionCookie(res, "", 0);
  res.json({ ok: true });
});
app.get("/api/me", auth, (req, res) => res.json({ ...req.user, ai: aiConfigured(), provider, model: aiModel }));
app.post("/api/me/password", auth, (req, res) => {
  const { current, next: nextPw } = req.body || {};
  const user = findUserByEmail(req.user.email);
  if (!checkPassword(user, String(current || ""))) return res.status(400).json({ error: "wrong_password" });
  if (typeof nextPw !== "string" || nextPw.length < 10) return res.status(400).json({ error: "too_short" });
  setPassword(user.id, nextPw);
  setSessionCookie(res, createSession(user.id));
  res.json({ ok: true });
});

/* ---------- team (admins) ---------- */
app.get("/api/users", auth, adminOnly, (req, res) => res.json(listUsers()));
app.post("/api/users", auth, adminOnly, (req, res) => {
  const { email, name, isAdmin } = req.body || {};
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "bad_email" });
  if (findUserByEmail(email)) return res.status(409).json({ error: "exists" });
  const password = randomPassword();
  createUser({ email, name: String(name || email.split("@")[0]), password, isAdmin: !!isAdmin });
  res.json({ ok: true, password });
});
app.post("/api/users/:id/reset", auth, adminOnly, (req, res) => {
  const password = randomPassword();
  setPassword(Number(req.params.id), password);
  res.json({ ok: true, password });
});
app.delete("/api/users/:id", auth, adminOnly, (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: "cannot_remove_self" });
  deleteUser(Number(req.params.id));
  res.json({ ok: true });
});

/* ---------- documents ---------- */
const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
function checkPath(req, res) {
  const { collection, id } = req.params;
  if (!COLLECTIONS.has(collection)) { res.status(404).json({ error: "unknown_collection" }); return false; }
  if (id !== undefined && !ID_RE.test(id)) { res.status(400).json({ error: "bad_id" }); return false; }
  return true;
}
app.get("/api/rev", auth, (req, res) => res.json({ rev: rev() }));
app.get("/api/docs/:collection", auth, (req, res) => {
  if (!checkPath(req, res)) return;
  res.json({ rev: rev(), docs: listDocs(req.params.collection) });
});
app.put("/api/docs/:collection/:id", auth, (req, res) => {
  if (!checkPath(req, res)) return;
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "bad_body" });
  putDoc(req.params.collection, req.params.id, body, req.user.id);
  res.json({ ok: true, rev: rev() });
});
app.delete("/api/docs/:collection/:id", auth, (req, res) => {
  if (!checkPath(req, res)) return;
  deleteDoc(req.params.collection, req.params.id);
  res.json({ ok: true, rev: rev() });
});

/* ---------- AI ---------- */
let inflight = 0;
app.post("/api/ai", auth, async (req, res) => {
  if (inflight >= 6) return res.status(429).json({ error: "rate_limited", message: "The AI is busy. Try again in a minute." });
  inflight++;
  try {
    const value = await askJson(req.body?.prompt);
    res.json({ value });
  } catch (err) {
    const e = err instanceof AiError ? err : new AiError("upstream_error", "Something went wrong.");
    if (!(err instanceof AiError)) console.error(err);
    res.status(e.status).json({ error: e.code, message: e.message });
  } finally {
    inflight--;
  }
});

/* ---------- research intake for automations (e.g. the news check) ---------- */
app.post("/api/ingest", (req, res) => {
  const token = process.env.INGEST_TOKEN;
  const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || given.length !== token.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token))) {
    return res.status(401).json({ error: "bad_token" });
  }
  const items = Array.isArray(req.body?.research) ? req.body.research.slice(0, 50) : [];
  const ideas = Array.isArray(req.body?.ideas) ? req.body.ideas.slice(0, 50) : [];
  const now = new Date().toISOString();
  let n = 0;
  for (const r of items) {
    if (!r?.title) continue;
    const id = "r" + Date.now().toString(36) + n++;
    putDoc("research", id, { id, kind: String(r.kind || "news"), title: String(r.title), summary: String(r.summary || ""), fact: String(r.fact || ""), caution: String(r.caution || ""), url: String(r.url || ""), date: String(r.date || ""), addedAt: now, origin: "News check" });
  }
  for (const x of ideas) {
    if (!x?.hook) continue;
    const id = "i" + Date.now().toString(36) + n++;
    putDoc("ideas", id, { id, hook: String(x.hook), angle: String(x.angle || ""), pillar: String(x.pillar || ""), hookId: Number(x.hookId) || null, fact: String(x.fact || ""), url: String(x.url || ""), caution: String(x.caution || ""), status: "new", origin: "News check", createdAt: now });
  }
  res.json({ ok: true, added: n });
});

/* ---------- page ---------- */
app.get("/healthz", (req, res) => res.json({ ok: true }));
app.use(express.static(path.join(here, "public"), { index: "index.html", maxAge: "5m" }));

app.listen(PORT, () => console.log(`Darman Studio on http://0.0.0.0:${PORT} (AI: ${provider}, model ${aiModel}, ${aiConfigured() ? "ready" : "NOT configured"})`));
