// Darman Studio: sign-in, shared documents, and AI drafting (OpenAI or Claude).
// It never talks to LinkedIn. Runs on Vercel (api/index.js) or as a normal
// Node server (index.js).
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import {
  init, COLLECTIONS, rev, listDocs, putDoc, deleteDoc, seedIfEmpty,
  findUserByEmail, checkPassword, createSession, sessionUser, endSession, SESSION_DAYS,
  listUsers, createUser, deleteUser, setPassword, userCount, randomPassword,
} from "./db.js";
import { askJson, AiError, aiConfigured, aiModel, provider, listModels, searchNews, NEWS_TOPICS } from "./ai.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ON_VERCEL = !!process.env.VERCEL;
// Vercel always serves HTTPS, so cookies are Secure there; elsewhere opt in with COOKIE_SECURE=true.
const SECURE_COOKIES = ON_VERCEL || process.env.COOKIE_SECURE === "true";
const COOKIE = "studio_session";

/* One-time setup per server instance: tables, starter content, first admin. */
let setup;
function ensureSetup() {
  return (setup ||= (async () => {
    await init();
    const seeded = await seedIfEmpty(path.join(here, "seed"));
    if (seeded) console.log(`Loaded ${seeded} starter documents.`);
    if ((await userCount()) === 0) {
      const email = process.env.ADMIN_EMAIL;
      const given = process.env.ADMIN_PASSWORD;
      if (email && (given || !ON_VERCEL)) {
        const password = given || randomPassword();
        await createUser({ email, name: process.env.ADMIN_NAME || "Admin", password, isAdmin: true });
        console.log(`Created admin ${email}${given ? "" : ` with password: ${password}`}`);
      } else {
        console.log("No users yet. Set ADMIN_EMAIL and ADMIN_PASSWORD, then reload.");
      }
    }
  })().catch((e) => { setup = null; throw e; }));
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", ON_VERCEL || process.env.TRUST_PROXY === "true");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY" });
  next();
});
app.use("/api", (req, res, next) => ensureSetup().then(() => next(), next));

/* Async route helper: errors go to the error handler instead of crashing. */
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function readCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function setSessionCookie(res, token, maxAgeDays = SESSION_DAYS) {
  const attrs = [`${COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeDays * 86400}`];
  if (SECURE_COOKIES) attrs.push("Secure");
  res.set("Set-Cookie", attrs.join("; "));
}
const auth = h(async (req, res, next) => {
  const user = await sessionUser(readCookie(req, COOKIE));
  if (!user) return res.status(401).json({ error: "signed_out" });
  req.user = user;
  next();
});
function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "admin_only" });
  next();
}

/* Login throttle: 10 failed attempts per IP per 15 minutes (per server instance). */
const fails = new Map();
const throttled = (ip) => { const f = fails.get(ip); if (!f) return false; if (Date.now() - f.first > 15 * 60e3) { fails.delete(ip); return false; } return f.count >= 10; };
const recordFail = (ip) => { const f = fails.get(ip); if (!f || Date.now() - f.first > 15 * 60e3) fails.set(ip, { first: Date.now(), count: 1 }); else f.count++; };

/* ---------- auth ---------- */
app.post("/api/login", h(async (req, res) => {
  if (throttled(req.ip)) return res.status(429).json({ error: "too_many_attempts" });
  const { email, password } = req.body || {};
  const user = typeof email === "string" ? await findUserByEmail(email) : null;
  if (!user || typeof password !== "string" || !checkPassword(user, password)) {
    recordFail(req.ip);
    return res.status(401).json({ error: "wrong_credentials" });
  }
  fails.delete(req.ip);
  setSessionCookie(res, await createSession(user.id));
  res.json({ ok: true });
}));
app.post("/api/logout", h(async (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) await endSession(token);
  setSessionCookie(res, "", 0);
  res.json({ ok: true });
}));
app.get("/api/me", auth, (req, res) => res.json({ ...req.user, ai: aiConfigured(), provider, model: aiModel }));
app.post("/api/me/password", auth, h(async (req, res) => {
  const { current, next: nextPw } = req.body || {};
  const user = await findUserByEmail(req.user.email);
  if (!checkPassword(user, String(current || ""))) return res.status(400).json({ error: "wrong_password" });
  if (typeof nextPw !== "string" || nextPw.length < 10) return res.status(400).json({ error: "too_short" });
  await setPassword(user.id, nextPw);
  setSessionCookie(res, await createSession(user.id));
  res.json({ ok: true });
}));

/* ---------- team (admins) ---------- */
app.get("/api/users", auth, adminOnly, h(async (req, res) => res.json(await listUsers())));
app.post("/api/users", auth, adminOnly, h(async (req, res) => {
  const { email, name, isAdmin } = req.body || {};
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "bad_email" });
  if (await findUserByEmail(email)) return res.status(409).json({ error: "exists" });
  const password = randomPassword();
  await createUser({ email, name: String(name || email.split("@")[0]), password, isAdmin: !!isAdmin });
  res.json({ ok: true, password });
}));
app.post("/api/users/:id/reset", auth, adminOnly, h(async (req, res) => {
  const password = randomPassword();
  await setPassword(Number(req.params.id), password);
  res.json({ ok: true, password });
}));
app.delete("/api/users/:id", auth, adminOnly, h(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: "cannot_remove_self" });
  await deleteUser(Number(req.params.id));
  res.json({ ok: true });
}));

/* ---------- documents ---------- */
const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
function checkPath(req, res) {
  const { collection, id } = req.params;
  if (!COLLECTIONS.has(collection)) { res.status(404).json({ error: "unknown_collection" }); return false; }
  if (id !== undefined && !ID_RE.test(id)) { res.status(400).json({ error: "bad_id" }); return false; }
  return true;
}
app.get("/api/rev", auth, h(async (req, res) => res.json({ rev: await rev() })));
app.get("/api/docs/:collection", auth, h(async (req, res) => {
  if (!checkPath(req, res)) return;
  const [docs, r] = await Promise.all([listDocs(req.params.collection), rev()]);
  res.json({ rev: r, docs });
}));
app.put("/api/docs/:collection/:id", auth, h(async (req, res) => {
  if (!checkPath(req, res)) return;
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "bad_body" });
  res.json({ ok: true, rev: await putDoc(req.params.collection, req.params.id, body, req.user.id) });
}));
app.delete("/api/docs/:collection/:id", auth, h(async (req, res) => {
  if (!checkPath(req, res)) return;
  res.json({ ok: true, rev: await deleteDoc(req.params.collection, req.params.id) });
}));

/* ---------- AI ---------- */
app.get("/api/models", auth, adminOnly, h(async (req, res) => {
  try { res.json({ provider, models: await listModels() }); }
  catch (e) { res.status(502).json({ error: "models_failed", message: e.message }); }
}));
app.post("/api/ai", auth, h(async (req, res) => {
  try {
    res.json({ value: await askJson(req.body?.prompt) });
  } catch (err) {
    const e = err instanceof AiError ? err : new AiError("upstream_error", "Something went wrong.");
    if (!(err instanceof AiError)) console.error(err);
    res.status(e.status).json({ error: e.code, message: e.message });
  }
}));

/* Web research: find recent items for one topic and add the new ones to Research. */
app.get("/api/research/topics", auth, (req, res) => res.json(Object.entries(NEWS_TOPICS).map(([key, t]) => ({ key, label: t.label }))));
app.post("/api/research/search", auth, h(async (req, res) => {
  const months = Math.min(Math.max(Number(req.body?.months) || 4, 1), 12);
  const sinceDate = new Date(); sinceDate.setMonth(sinceDate.getMonth() - months);
  const since = sinceDate.toISOString().slice(0, 10);
  let found;
  try { found = await searchNews(String(req.body?.topic || ""), since); }
  catch (err) {
    const e = err instanceof AiError ? err : new AiError("upstream_error", "Something went wrong.");
    if (!(err instanceof AiError)) console.error(err);
    return res.status(e.status).json({ error: e.code, message: e.message });
  }
  const known = new Set((await listDocs("research")).map((d) => String(d.data.url || "").replace(/[#?].*$/, "").replace(/\/$/, "")));
  const now = new Date().toISOString();
  let added = 0, n = 0;
  for (const r of found) {
    const key = r.url.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (known.has(key)) continue;
    known.add(key);
    const id = "w" + Date.now().toString(36) + n++;
    await putDoc("research", id, { id, ...r, addedAt: now, origin: "Web search" }, req.user.id);
    added++;
  }
  res.json({ ok: true, found: found.length, added, since });
}));

/* ---------- research intake for automations (e.g. the news check) ---------- */
app.post("/api/ingest", h(async (req, res) => {
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
    await putDoc("research", id, { id, kind: String(r.kind || "news"), title: String(r.title), summary: String(r.summary || ""), fact: String(r.fact || ""), caution: String(r.caution || ""), url: String(r.url || ""), date: String(r.date || ""), addedAt: now, origin: "News check" });
  }
  for (const x of ideas) {
    if (!x?.hook) continue;
    const id = "i" + Date.now().toString(36) + n++;
    await putDoc("ideas", id, { id, hook: String(x.hook), angle: String(x.angle || ""), pillar: String(x.pillar || ""), hookId: Number(x.hookId) || null, fact: String(x.fact || ""), url: String(x.url || ""), caution: String(x.caution || ""), status: "new", origin: "News check", createdAt: now });
  }
  res.json({ ok: true, added: n });
}));

app.get("/healthz", (req, res) => res.json({ ok: true }));
app.use(express.static(path.join(here, "public"), { index: "index.html", maxAge: "5m" }));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "server_error", message: err.publicMessage || "Something went wrong on the server." });
});

export default app;
export { ensureSetup };
