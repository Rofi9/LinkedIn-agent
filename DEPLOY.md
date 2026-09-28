# Putting Darman Studio online (Vercel)

Darman Studio is the team's LinkedIn writing desk: research-backed ideas,
AI-written drafts to review, accept or reject, a human-score check, and
on-brand visuals. **It never posts to LinkedIn.** People copy the finished
post and publish it themselves.

On Vercel you get, with no server to manage:
- a web address like `https://darman-studio.vercel.app`, with HTTPS already on;
- a free Postgres database (Neon) for drafts, ideas, research and accounts;
- automatic updates whenever the code on GitHub changes.

**Cost:** Vercel's Hobby plan and Neon's free plan cost nothing. You pay OpenAI
for what you generate. Vercel's Hobby plan is meant for personal and
non-commercial projects; if Vercel asks, the Pro plan is about $20 per month
per team member (check vercel.com/pricing).

About 15 minutes, all in the browser.

---

## 1. Create the project

1. Go to [vercel.com/signup](https://vercel.com/signup) and sign up **with GitHub**.
2. Click **Add New… → Project**. If `rofi9/linkedin-agent` isn't listed,
   click **Adjust GitHub App Permissions** and give Vercel access to that
   repository.
3. Click **Import** next to `linkedin-agent`.
4. On the setup screen:
   - **Root Directory:** click **Edit** and choose `server`.
   - **Framework Preset:** Other.
   - Open **Environment Variables** and add:

| Name | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key (platform.openai.com → API keys) |
| `OPENAI_MODEL` | Leave out for now if you don't know it; Studio will list the options (step 3) |
| `ADMIN_EMAIL` | Your email; this becomes the first admin account |
| `ADMIN_NAME` | Your name |
| `ADMIN_PASSWORD` | A password of 10+ characters for your admin account |

5. Click **Deploy**. It takes about a minute.

## 2. Add the database

1. In the project, open the **Storage** tab.
2. Click **Create Database** (or **Connect Database**) → **Neon** (serverless
   Postgres) → keep the free plan → **Create**, and connect it to this project
   for all environments. Vercel adds `DATABASE_URL` for you.
3. Open **Deployments**, click **⋯** on the latest one → **Redeploy**.

## 3. Sign in and finish setup

1. Open the project's address (shown on the project page, e.g.
   `https://linkedin-agent-xxxx.vercel.app`). You can rename it under
   **Settings → Domains**.
2. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The first sign-in loads the
   starter research, ideas, drafts and voice profile.
3. If you didn't set `OPENAI_MODEL`, a yellow banner lists the models your
   OpenAI key can use. Pick OpenAI's newest general-purpose model (not a
   "mini" or "nano" one), add it as `OPENAI_MODEL` under **Settings →
   Environment Variables**, and **Redeploy** again.
4. Test once: **Ideas → Generate post**. A draft should appear within a minute.

## 4. Add your team

Press **Team** (top right), enter a colleague's email and name, and press
**Add**. Studio shows a temporary password once; send it to them. They change
it under **Password** after signing in. Admins can reset passwords and remove
people from the same panel.

---

## Good to know

- **Updates:** when the code on GitHub changes, Vercel redeploys by itself.
- **After changing an environment variable,** always Redeploy; the change only
  applies to new deployments.
- **Your data** lives in the Neon database, not in Vercel, so redeploys never
  lose anything. Neon's dashboard (reachable from the Storage tab) has backups.
- **Time limit:** each AI request may run up to 60 seconds. If drafts time
  out, choose a faster model or, on Vercel Pro, raise `maxDuration` in
  `server/vercel.json`.
- **Claude instead of OpenAI:** add `ANTHROPIC_API_KEY` and set
  `AI_PROVIDER=anthropic`. The default Claude model is `claude-opus-5`.

## Troubleshooting

| What you see | Fix |
|---|---|
| "No database connected" when signing in | Do step 2, then Redeploy |
| Can't sign in the first time | Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` were set before the first sign-in, then Redeploy. The admin is created only while there are no users |
| "AI drafting isn't set up yet" banner | Add `OPENAI_API_KEY` and `OPENAI_MODEL`, then Redeploy |
| "OpenAI doesn't recognize the model" | `OPENAI_MODEL` has a typo; copy a name from the banner's list exactly |
| "out of credit" | Add billing credit to the OpenAI account |
| Anything else | Project → **Logs** shows the server's error messages |

---

## Alternative: your own server with Docker

The same code also runs on any Linux server (such as the Hetzner one) with a
built-in database, no Neon needed:

```bash
curl -fsSL https://get.docker.com | sh
git clone <this repository> /opt/studio && cd /opt/studio
cp .env.example .env && nano .env        # OPENAI_API_KEY, OPENAI_MODEL, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build             # then open http://SERVER_IP
docker compose exec app node manage.js models   # list model names for OPENAI_MODEL
```

Without a domain this runs without HTTPS; see `deploy/Caddyfile` and the
`https` profile in `docker-compose.yml` to add one. Other admin commands:
`add-user`, `reset-password`, `list-users`, `remove-user`, `export`.
