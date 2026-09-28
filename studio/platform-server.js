/* Server platform layer for Darman Studio.
   Gives the page the same `window.claude.use(...)` surface it has as a
   claude.ai artifact (db, sample, downloads), backed by the Studio server,
   and adds sign-in, an account menu and team management. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(method, url, body) {
    const res = await fetch(url, {
      method, credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (res.status === 401 && url !== "/api/login" && url !== "/api/me") { showLogin("Your session ended. Sign in again."); }
    if (!res.ok) throw Object.assign(new Error(data?.message || data?.error || res.statusText), { status: res.status, code: data?.error, message: data?.message });
    return data;
  }

  /* ---------- styles for the platform UI ---------- */
  const css = document.createElement("style");
  css.textContent = `
  .plat-overlay{position:fixed;inset:0;z-index:100;background:var(--bg);display:grid;place-items:center;padding:16px}
  .plat-card{width:100%;max-width:380px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:14px;box-shadow:var(--shadow)}
  .plat-card h2{font-size:24px;display:flex;align-items:baseline;gap:8px}
  .plat-card h2 em{font-family:var(--script);font-style:normal;font-weight:400;font-size:32px;color:var(--coral-text)}
  .plat-card input{width:100%;border:1px solid var(--line-strong);background:var(--bg);border-radius:8px;padding:10px 12px}
  .plat-err{color:var(--bad);font-size:13.5px;min-height:1em}
  .plat-account{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .plat-modal{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.35);display:grid;place-items:center;padding:16px}
  .plat-panel{width:100%;max-width:620px;max-height:90vh;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:14px}
  .plat-row{display:flex;gap:10px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:8px 0;flex-wrap:wrap}
  .plat-row .who{display:flex;flex-direction:column}
  .plat-row .who span{font-size:12.5px;color:var(--muted)}
  .plat-add{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center}
  @media (max-width:560px){.plat-add{grid-template-columns:1fr}}
  .plat-add input{border:1px solid var(--line-strong);background:var(--bg);border-radius:8px;padding:8px 10px;width:100%}
  .plat-pw{font-family:var(--mono);background:var(--sunk);border:1px solid var(--line);border-radius:8px;padding:10px;user-select:all;overflow-wrap:anywhere}`;
  document.head.appendChild(css);

  /* ---------- sign-in ---------- */
  let me = null;
  let resolveAuth, wasAuthed = false, pollStarted = false;
  const authed = new Promise((r) => (resolveAuth = r));

  function showLogin(msg) {
    if ($("platLogin")) return;
    const o = document.createElement("div");
    o.className = "plat-overlay"; o.id = "platLogin";
    o.innerHTML = `<form class="plat-card" id="platLoginForm">
      <h2>darman.ai <em>studio</em></h2>
      <p class="muted" style="margin:0">Sign in to write, review and plan Darman's LinkedIn posts.</p>
      <label class="f" for="platEmail">Email<input id="platEmail" type="email" autocomplete="username" required></label>
      <label class="f" for="platPw">Password<input id="platPw" type="password" autocomplete="current-password" required></label>
      <div class="plat-err" id="platErr">${esc(msg || "")}</div>
      <button class="btn primary" type="submit" style="justify-content:center">Sign in</button>
      <p class="muted" style="margin:0;font-size:12.5px">No account? Ask a Studio admin to add you.</p>
    </form>`;
    document.body.appendChild(o);
    $("platEmail").focus();
    $("platLoginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      $("platErr").textContent = "";
      try {
        await api("POST", "/api/login", { email: $("platEmail").value, password: $("platPw").value });
        me = await api("GET", "/api/me");
        o.remove();
        if (wasAuthed) { location.reload(); return; }
        wasAuthed = true; renderAccount(); resolveAuth();
      } catch (err) {
        $("platErr").textContent = err.status === 429 ? "Too many attempts. Wait 15 minutes and try again." : "Wrong email or password.";
      }
    });
  }

  (async () => {
    try { me = await api("GET", "/api/me"); wasAuthed = true; renderAccount(); resolveAuth(); }
    catch { showLogin(); }
  })();

  /* ---------- account menu and team ---------- */
  function renderAccount() {
    const row = document.querySelector(".top-row");
    if (!row || !me) return;
    let el = $("platAccount");
    if (!el) { el = document.createElement("div"); el.id = "platAccount"; el.className = "plat-account"; row.appendChild(el); }
    el.innerHTML = `<span class="muted" style="font-size:13px">${esc(me.name)}</span>
      ${me.isAdmin ? `<button class="btn ghost sm" id="platTeam">Team</button>` : ""}
      <button class="btn ghost sm" id="platPwBtn">Password</button>
      <button class="btn ghost sm" id="platOut">Sign out</button>`;
    $("platOut").onclick = async () => { await api("POST", "/api/logout").catch(() => {}); location.reload(); };
    $("platPwBtn").onclick = openPassword;
    if (me.isAdmin) $("platTeam").onclick = openTeam;
    if (!me.ai) {
      const b = $("banner");
      if (b) b.innerHTML = `<div class="notice warn" style="margin-bottom:16px">AI drafting isn't set up yet. Add OPENAI_API_KEY and OPENAI_MODEL to the server's environment variables (on Vercel: Settings > Environment Variables) and redeploy. You can still review and edit drafts.<div id="platModels"></div></div>`;
      if (me.isAdmin && me.provider === "openai") api("GET", "/api/models").then((r) => {
        const el = $("platModels"); if (!el || !r.models?.length) return;
        el.innerHTML = `<p style="margin:8px 0 4px"><b>Models your OpenAI key can use</b> (pick the newest general-purpose one for OPENAI_MODEL):</p><div class="plat-pw" style="max-height:160px;overflow:auto;font-size:12.5px">${r.models.map(esc).join("<br>")}</div>`;
      }).catch(() => {});
    }
  }

  function modal(html) {
    const m = document.createElement("div");
    m.className = "plat-modal";
    m.innerHTML = `<div class="plat-panel" role="dialog" aria-modal="true">${html}</div>`;
    m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
    return m;
  }

  function openPassword() {
    const m = modal(`<h3 style="font-size:20px">Change your password</h3>
      <label class="f" for="pwCur">Current password<input id="pwCur" type="password" autocomplete="current-password"></label>
      <label class="f" for="pwNew">New password (10+ characters)<input id="pwNew" type="password" autocomplete="new-password"></label>
      <div class="plat-err" id="pwErr"></div>
      <div class="actions"><button class="btn primary" id="pwSave">Save password</button><button class="btn ghost" id="pwClose">Close</button></div>`);
    m.querySelector("#pwClose").onclick = () => m.remove();
    m.querySelector("#pwSave").onclick = async () => {
      try { await api("POST", "/api/me/password", { current: $("pwCur").value, next: $("pwNew").value }); m.remove(); toast("Password changed"); }
      catch (e) { $("pwErr").textContent = e.code === "too_short" ? "Use at least 10 characters." : e.code === "wrong_password" ? "Current password is wrong." : "Couldn't change it."; }
    };
  }

  async function openTeam() {
    const m = modal(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 style="font-size:20px">Team</h3><button class="btn ghost sm" id="tClose">Close</button></div>
      <p class="muted" style="margin:0;font-size:13.5px">Everyone here shares the same ideas, drafts, research and voice. Admins can add and remove people.</p>
      <div id="tList"></div>
      <h4 style="margin:6px 0 0">Add someone</h4>
      <div class="plat-add"><input id="tEmail" type="email" placeholder="email@darman.ai" aria-label="Email"><input id="tName" type="text" placeholder="Name" aria-label="Name"><button class="btn primary" id="tAdd">Add</button></div>
      <label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="tAdmin"> Make them an admin</label>
      <div id="tOut"></div>`);
    m.querySelector("#tClose").onclick = () => m.remove();
    const out = m.querySelector("#tOut");
    const showPw = (email, pw) => { out.innerHTML = `<div class="notice"><b>Send ${esc(email)} this temporary password</b> (it's shown only once). They can change it under Password after signing in.<div class="plat-pw" style="margin-top:8px">${esc(pw)}</div></div>`; };
    async function load() {
      const users = await api("GET", "/api/users");
      m.querySelector("#tList").innerHTML = users.map((u) => `<div class="plat-row"><div class="who"><b>${esc(u.name)}${u.isAdmin ? " · admin" : ""}</b><span>${esc(u.email)}</span></div>
        <div class="actions">${u.id === me.id ? `<span class="muted" style="font-size:12.5px">You</span>` : `<button class="btn ghost sm" data-reset="${u.id}" data-email="${esc(u.email)}">Reset password</button><button class="btn bad sm" data-rm="${u.id}">Remove</button>`}</div></div>`).join("");
      m.querySelectorAll("[data-reset]").forEach((b) => (b.onclick = async () => { const r = await api("POST", `/api/users/${b.dataset.reset}/reset`); showPw(b.dataset.email, r.password); }));
      m.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => {
        b.outerHTML = `<span class="confirm">Remove? <button class="btn bad sm" data-yes="${b.dataset.rm}">Remove</button></span>`;
        m.querySelector(`[data-yes="${b.dataset.rm}"]`).onclick = async () => { await api("DELETE", `/api/users/${b.dataset.rm}`); load(); };
      }));
    }
    m.querySelector("#tAdd").onclick = async () => {
      const email = $("tEmail").value.trim(), name = $("tName").value.trim();
      try { const r = await api("POST", "/api/users", { email, name, isAdmin: $("tAdmin").checked }); showPw(email, r.password); $("tEmail").value = ""; $("tName").value = ""; load(); }
      catch (e) { out.innerHTML = `<div class="notice err">${e.code === "exists" ? "That email already has an account." : e.code === "bad_email" ? "Enter a valid email." : "Couldn't add them."}</div>`; }
    };
    load();
  }
  function toast(msg) { const t = $("toast"); if (!t) return; t.textContent = msg; t.hidden = false; setTimeout(() => (t.hidden = true), 2600); }

  /* ---------- db: same shape as the artifact capability ---------- */
  const cache = {};            // collection -> Map(id -> data)
  const listeners = {};        // collection -> Set(fn)
  const docListeners = {};     // "col/id" -> Set(fn)
  let lastRev = -1;

  const snap = (col) => {
    const docs = [...(cache[col] || new Map()).entries()].map(([id, d]) => ({ id, exists: true, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } }));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const docSnap = (col, id) => { const d = cache[col]?.get(id); return { id, exists: !!d, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } }; };
  function notify(col) {
    (listeners[col] || []).forEach((fn) => { try { fn(snap(col)); } catch (e) { console.error(e); } });
    Object.entries(docListeners).forEach(([key, fns]) => { const [c, id] = key.split("/"); if (c === col) fns.forEach((fn) => { try { fn(docSnap(c, id)); } catch (e) { console.error(e); } }); });
  }
  async function fetchCol(col) {
    const r = await api("GET", `/api/docs/${col}`);
    cache[col] = new Map(r.docs.map((d) => [d.id, d.data]));
    lastRev = Math.max(lastRev, r.rev);
    notify(col);
  }
  const subscribed = () => new Set([...Object.keys(listeners), ...Object.keys(docListeners).map((k) => k.split("/")[0])]);
  async function poll() {
    if (document.visibilityState === "visible" && me) {
      try { const { rev } = await api("GET", "/api/rev"); if (rev !== lastRev) { lastRev = rev; await Promise.all([...subscribed()].map(fetchCol)); } } catch { /* offline: try again next tick */ }
    }
    setTimeout(poll, 8000);
  }
  const split = (p) => { const i = p.lastIndexOf("/"); return [p.slice(0, i), p.slice(i + 1)]; };
  const toDbErr = (e) => ({ code: e.status === 400 ? "invalid_argument" : "unavailable", message: e.message });

  const db = Object.freeze({
    collection(col) {
      return {
        path: col,
        onSnapshot(next) { (listeners[col] ||= new Set()).add(next); fetchCol(col).catch(() => {}); return () => listeners[col].delete(next); },
        async get() { await fetchCol(col); return snap(col); },
        doc(id) { return db.doc(col + "/" + id); },
      };
    },
    doc(path) {
      const [col, id] = split(path);
      return {
        id, path,
        onSnapshot(next) { const k = col + "/" + id; (docListeners[k] ||= new Set()).add(next); fetchCol(col).catch(() => {}); return () => docListeners[k].delete(next); },
        async get() { await fetchCol(col); return docSnap(col, id); },
        async set(data) {
          (cache[col] ||= new Map()).set(id, data); notify(col);
          try { const r = await api("PUT", `/api/docs/${col}/${encodeURIComponent(id)}`, data); lastRev = r.rev; }
          catch (e) { fetchCol(col).catch(() => {}); throw toDbErr(e); }
        },
        async delete() {
          cache[col]?.delete(id); notify(col);
          try { const r = await api("DELETE", `/api/docs/${col}/${encodeURIComponent(id)}`); lastRev = r.rev; }
          catch (e) { fetchCol(col).catch(() => {}); throw toDbErr(e); }
        },
      };
    },
  });

  /* ---------- sample: Claude through the server ---------- */
  async function sampleJson(prompt, opts) {
    if (opts?.signal?.aborted) throw { code: "cancelled" };
    try { const r = await api("POST", "/api/ai", { prompt }); return r.value; }
    catch (e) { throw { code: e.code || "upstream_error", message: e.message }; }
  }
  async function sample(prompt, opts) { const v = await sampleJson(prompt, opts); return { text: JSON.stringify(v), truncated: false, modelTierApplied: "default" }; }
  sample.json = sampleJson;
  sample.limits = async () => ({ maxPromptBytes: 120000 });

  /* ---------- downloads ---------- */
  const downloads = Object.freeze({
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return { status: "saved" };
    },
  });

  const caps = { db, sample, downloads };
  window.claude = Object.freeze({
    use: async (name) => { await authed; if (name === "db" && !pollStarted) { pollStarted = true; setTimeout(poll, 5000); } return caps[name] || null; },
  });
})();
