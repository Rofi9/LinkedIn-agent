// SQLite storage: one generic document table (mirrors the artifact version's
// collections), plus users and login sessions.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "studio.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS docs (
  collection TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by INTEGER,
  PRIMARY KEY (collection, id)
);
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name       TEXT NOT NULL,
  password   TEXT NOT NULL,
  is_admin   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

export const COLLECTIONS = new Set(["ideas", "posts", "research", "config"]);

/* Revision counter: bumped on every write so clients can poll cheaply. */
const getRev = db.prepare("SELECT value FROM meta WHERE key = 'rev'");
const setRev = db.prepare("INSERT INTO meta (key, value) VALUES ('rev', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
export function rev() { return Number(getRev.get()?.value || 0); }
function bump() { setRev.run(String(rev() + 1)); }

const listStmt = db.prepare("SELECT id, data FROM docs WHERE collection = ?");
const getStmt = db.prepare("SELECT data FROM docs WHERE collection = ? AND id = ?");
const putStmt = db.prepare(`INSERT INTO docs (collection, id, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`);
const delStmt = db.prepare("DELETE FROM docs WHERE collection = ? AND id = ?");

export function listDocs(collection) {
  return listStmt.all(collection).map((r) => ({ id: r.id, data: JSON.parse(r.data) }));
}
export function getDoc(collection, id) {
  const r = getStmt.get(collection, id);
  return r ? JSON.parse(r.data) : null;
}
export const putDoc = db.transaction((collection, id, data, userId) => {
  putStmt.run(collection, id, JSON.stringify(data), new Date().toISOString(), userId ?? null);
  bump();
});
export const deleteDoc = db.transaction((collection, id) => {
  delStmt.run(collection, id);
  bump();
});

/* First start: load the research, ideas, drafts and voice shipped in seed/. */
export function seedIfEmpty(seedDir) {
  const n = db.prepare("SELECT COUNT(*) AS n FROM docs").get().n;
  if (n > 0 || !fs.existsSync(seedDir)) return 0;
  const files = fs.readdirSync(seedDir).filter((f) => f.endsWith(".json"));
  const load = db.transaction(() => {
    for (const f of files) {
      const [collection, rest] = f.split("__");
      const id = rest.replace(/\.json$/, "");
      if (!COLLECTIONS.has(collection)) continue;
      putStmt.run(collection, id, fs.readFileSync(path.join(seedDir, f), "utf8"), new Date().toISOString(), null);
    }
    bump();
  });
  load();
  return files.length;
}

/* Users and sessions */
export function createUser({ email, name, password, isAdmin = false }) {
  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare("INSERT INTO users (email, name, password, is_admin, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(email.trim(), name.trim(), hash, isAdmin ? 1 : 0, new Date().toISOString());
  return info.lastInsertRowid;
}
export function setPassword(userId, password) {
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(bcrypt.hashSync(password, 12), userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
export function listUsers() {
  return db.prepare("SELECT id, email, name, is_admin AS isAdmin, created_at AS createdAt FROM users ORDER BY created_at").all()
    .map((u) => ({ ...u, isAdmin: !!u.isAdmin }));
}
export function deleteUser(id) { db.prepare("DELETE FROM users WHERE id = ?").run(id); }
export function findUserByEmail(email) { return db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim()); }
export function userCount() { return db.prepare("SELECT COUNT(*) AS n FROM users").get().n; }
export function checkPassword(user, password) { return bcrypt.compareSync(password, user.password); }

const SESSION_DAYS = 30;
export function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires);
  return token;
}
export function sessionUser(token) {
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.email, u.name, u.is_admin AS isAdmin, s.expires_at AS exp
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
  if (!row) return null;
  if (row.exp < new Date().toISOString()) { endSession(token); return null; }
  return { id: row.id, email: row.email, name: row.name, isAdmin: !!row.isAdmin };
}
export function endSession(token) { db.prepare("DELETE FROM sessions WHERE token = ?").run(token); }

export function randomPassword() {
  return crypto.randomBytes(9).toString("base64url");
}
