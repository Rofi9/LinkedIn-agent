# Deploying Darman Studio on your Hetzner server

Darman Studio is the team's LinkedIn writing desk: research-backed ideas,
Claude-written drafts to review, accept or reject, a human-score check, and
on-brand visuals. **It never posts to LinkedIn.** People copy the finished
post and publish it themselves.

It runs as one Docker container with a SQLite database stored in a Docker
volume. Claude runs through your Anthropic API key, on the server; the key
never reaches anyone's browser.

---

## What you need

- The Hetzner server (Ubuntu 22.04 or 24.04; the smallest CX or CAX plan is enough).
- SSH access to it as root or a sudo user.
- An **Anthropic API key**: [console.anthropic.com](https://console.anthropic.com) → API keys.
  Usage is billed to that account. Each draft is one Claude Opus 5 request.

## 1. Install Docker (once)

```bash
ssh root@YOUR_SERVER_IP
curl -fsSL https://get.docker.com | sh
```

## 2. Get the code

The repository is private, so give the server read-only access with a deploy key:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/studio_deploy
cat ~/.ssh/studio_deploy.pub
```

Copy the line it prints. On GitHub, open **rofi9/linkedin-agent → Settings →
Deploy keys → Add deploy key**, paste it, leave "Allow write access" off, and
save. Then:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/studio_deploy" \
  git clone -b claude/linkedin-agent-skill-install-yvlx2i \
  git@github.com:rofi9/linkedin-agent.git /opt/studio
cd /opt/studio
git config core.sshCommand "ssh -i ~/.ssh/studio_deploy"
```

(Once this work is merged into `main`, drop the `-b …` part.)

## 3. Configure

```bash
cp .env.example .env
nano .env
```

Fill in at least:

| Setting | What to put |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `ADMIN_EMAIL` | Your email; this becomes the first admin |
| `ADMIN_NAME` | Your name |
| `ADMIN_PASSWORD` | A password of 10+ characters, or leave empty and read the generated one from the logs |

Save with Ctrl+O, Enter, then Ctrl+X.

## 4. Start it

```bash
docker compose up -d --build
docker compose logs app
```

The logs should show `Loaded 98 starter documents`, `Created admin …` and
`Darman Studio on http://0.0.0.0:3000 (… Claude configured)`.

Open **http://YOUR_SERVER_IP** in a browser and sign in.

If the page doesn't load, the firewall may be closed. With Hetzner's Cloud
Firewall, allow inbound TCP 80 (and 443 later). With `ufw` on the server:
`ufw allow 80/tcp`.

## 5. Add your team

Signed in as admin, press **Team** (top right), enter a colleague's email and
name, and press **Add**. Studio shows a temporary password once. Send it to
them; they change it under **Password** after signing in.

From the server instead:

```bash
docker compose exec app node manage.js add-user ruzanna@darman.ai "Ruzanna Hovhannisyan"
docker compose exec app node manage.js add-user someone@darman.ai "Name" --admin
docker compose exec app node manage.js list-users
docker compose exec app node manage.js reset-password someone@darman.ai
docker compose exec app node manage.js remove-user someone@darman.ai
```

---

## Security note while you're on the IP address

Without a domain there's no HTTPS, so passwords and drafts travel
unencrypted between browsers and the server. That's acceptable for a short
test with non-sensitive content, but add a domain before the team relies on
it:

1. Point a DNS **A record** (for example `studio.darman.ai`) at the server IP.
2. In `.env` set `DOMAIN=studio.darman.ai`, `HTTP_PORT=8080`,
   `COOKIE_SECURE=true`, `TRUST_PROXY=true`.
3. Run `docker compose --profile https up -d`.
4. Allow TCP 443 in the firewall. Caddy fetches the HTTPS certificate
   automatically. Open **https://studio.darman.ai**.

---

## Updating

```bash
cd /opt/studio
git pull
docker compose up -d --build
```

Data lives in the `studio-data` volume and survives updates and restarts.

## Backups

```bash
docker compose exec app node manage.js backup
docker compose cp app:/data/backup-$(date +%F).db ./studio-backup-$(date +%F).db
```

Copy that file somewhere off the server (or enable Hetzner's server backups).
To restore: stop the app, copy the file into the volume as `studio.db`, start again.

## Settings reference

| Setting | Default | Meaning |
|---|---|---|
| `CLAUDE_MODEL` | `claude-opus-5` | The Claude model used for every request |
| `CLAUDE_FALLBACKS` | `on` | If Claude declines a request, Anthropic re-runs it on its recommended fallback model. `off` disables this |
| `HTTP_PORT` | `80` | Port on the server |
| `INGEST_TOKEN` | empty | Lets automations add research and ideas with `POST /api/ingest` and `Authorization: Bearer <token>` |

## Troubleshooting

- **"Claude isn't connected on this server"** banner: `ANTHROPIC_API_KEY` is
  missing. Add it to `.env` and run `docker compose up -d`.
- **"The server's Anthropic API key is missing or invalid"**: the key is wrong
  or revoked. Create a new one.
- **Forgot the admin password**: `docker compose exec app node manage.js reset-password you@darman.ai`.
- **See what's happening**: `docker compose logs -f app`.
