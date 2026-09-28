// Storage for Studio: one generic document table (the same collections as the
// claude.ai version), plus users and login sessions. Postgres everywhere:
//   DATABASE_URL (or POSTGRES_URL) set -> hosted Postgres, e.g. Neon on Vercel
//   not set                           -> embedded Postgres (PGlite) in DATA_DIR, for Docker or local use
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
export const driver = URL ? "postgres" : "embedded";

let q; // q(text, params) -> rows
if (!URL && process.env.VERCEL) {
  // Vercel has no lasting disk, so the embedded database can't be used there.
  const err = new Error("No database connected. In Vercel, open this project > Storage > connect a Neon Postgres database, then redeploy.");
  err.publicMessage = err.message;
  q = async () => { throw err; };
} else if (URL) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: URL, max: Number(process.env.PG_POOL_MAX || 3), idleTimeoutMillis: 10_000 });
  q = async (text, params = []) => (await pool.query(text, params)).rows;
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.join(process.env.DATA_DIR || path.resolve("data"), "pg");
  fs.mkdirSync(dir, { recursive: true });
  const lite = new PGlite(dir);
  q = async (text, params = []) => (await lite.query(text, params)).rows;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS docs (
  collection TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by INTEGER,
  PRIMARY KEY (collection, id)
);
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL,
  password   TEXT NOT NULL,
  is_admin   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (lower(email));
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value BIGINT NOT NULL);
INSERT INTO meta (key, value) VALUES ('rev', 0) ON CONFLICT (key) DO NOTHING;`;

let ready;
export function init() {
  return (ready ||= (async () => { for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await q(stmt); })());
}

export const COLLECTIONS = new Set(["ideas", "posts", "research", "config"]);

/* Revision counter: bumped on every write so browsers can poll cheaply. */
export async function rev() { return Number((await q("SELECT value FROM meta WHERE key = 'rev'"))[0]?.value || 0); }
async function bump() { return Number((await q("UPDATE meta SET value = value + 1 WHERE key = 'rev' RETURNING value"))[0].value); }

export async function listDocs(collection) {
  return (await q("SELECT id, data FROM docs WHERE collection = $1", [collection])).map((r) => ({ id: r.id, data: r.data }));
}
export async function putDoc(collection, id, data, userId) {
  await q(`INSERT INTO docs (collection, id, data, updated_at, updated_by) VALUES ($1, $2, $3, now(), $4)
    ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [collection, id, JSON.stringify(data), userId ?? null]);
  return bump();
}
export async function deleteDoc(collection, id) {
  await q("DELETE FROM docs WHERE collection = $1 AND id = $2", [collection, id]);
  return bump();
}

/* First start: load the research, ideas, drafts and voice shipped in seed/. */
export async function seedIfEmpty(seedDir) {
  const n = Number((await q("SELECT COUNT(*)::int AS n FROM docs"))[0].n);
  if (n > 0 || !fs.existsSync(seedDir)) return 0;
  const files = fs.readdirSync(seedDir).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const [collection, rest] = f.split("__");
    if (!COLLECTIONS.has(collection)) continue;
    await q("INSERT INTO docs (collection, id, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [collection, rest.replace(/\.json$/, ""), fs.readFileSync(path.join(seedDir, f), "utf8")]);
  }
  await bump();
  return files.length;
}

/* Users and sessions */
export async function createUser({ email, name, password, isAdmin = false }) {
  const hash = bcrypt.hashSync(password, 12);
  return (await q("INSERT INTO users (email, name, password, is_admin) VALUES ($1, $2, $3, $4) RETURNING id",
    [email.trim(), name.trim(), hash, !!isAdmin]))[0].id;
}
export async function setPassword(userId, password) {
  await q("UPDATE users SET password = $1 WHERE id = $2", [bcrypt.hashSync(password, 12), userId]);
  await q("DELETE FROM sessions WHERE user_id = $1", [userId]);
}
export async function listUsers() {
  return (await q("SELECT id, email, name, is_admin, created_at FROM users ORDER BY created_at"))
    .map((u) => ({ id: u.id, email: u.email, name: u.name, isAdmin: !!u.is_admin, createdAt: u.created_at }));
}
export async function deleteUser(id) { await q("DELETE FROM users WHERE id = $1", [id]); }
export async function findUserByEmail(email) {
  return (await q("SELECT * FROM users WHERE lower(email) = lower($1)", [String(email).trim()]))[0] || null;
}
export async function userCount() { return Number((await q("SELECT COUNT(*)::int AS n FROM users"))[0].n); }
export function checkPassword(user, password) { return bcrypt.compareSync(password, user.password); }

const SESSION_DAYS = 30;
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await q("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')", [token, userId]);
  return token;
}
export async function sessionUser(token) {
  if (!token) return null;
  const row = (await q(`SELECT u.id, u.email, u.name, u.is_admin, s.expires_at < now() AS expired
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1`, [token]))[0];
  if (!row) return null;
  if (row.expired) { await endSession(token); return null; }
  return { id: row.id, email: row.email, name: row.name, isAdmin: !!row.is_admin };
}
export async function endSession(token) { await q("DELETE FROM sessions WHERE token = $1", [token]); }
export { SESSION_DAYS };

export function randomPassword() { return crypto.randomBytes(9).toString("base64url"); }

/* Export everything (documents and user list, without password hashes) as JSON. */
export async function exportAll() {
  return {
    exportedAt: new Date().toISOString(),
    docs: await q("SELECT collection, id, data, updated_at FROM docs ORDER BY collection, id"),
    users: await listUsers(),
  };
}
