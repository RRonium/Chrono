# Hosting the web app on GitHub Pages

GitHub Pages serves static files only. The Next.js frontend (`apps/web`) is built as a static export and deployed by `.github/workflows/pages.yml` on every push to `main` that touches `apps/web`. The FastAPI backend, WebSocket, databases and ingestion worker cannot run on Pages and must be hosted elsewhere.

## One-time setup

1. Repo **Settings > Pages > Build and deployment > Source: GitHub Actions**.
2. Push to `main` (or run the workflow from the Actions tab). The site appears at `https://rronium.github.io/Chrono/`.
3. Point the site at a backend: **Settings > Secrets and variables > Actions > Variables**:
   - `NEXT_PUBLIC_API_URL` = `https://api.example.com`
   - `NEXT_PUBLIC_WS_URL` = `wss://api.example.com/ws/live`
   - `NEXT_PUBLIC_ANALYTICS_URL` = `https://analytics.example.com` (optional)
   Without these the site falls back to `localhost`. That still works in your own browser while Docker is running (Chrome treats `localhost` as secure), but every other visitor sees demo data.

   Use the repository-level **Actions** variables tab, not **Settings > Environments > github-pages**. The build job reads `vars.*` and does not run in the `github-pages` environment, so environment variables there are never seen.

   Never put anything from `.env` here except these public URLs. `NEXT_PUBLIC_*` values are baked into the public JavaScript, so API keys (`GEMINI_API_KEY`), database passwords and `JWT_SECRET` stay in the backend `.env` on the machine running Docker.

4. After changing a variable, rebuild: **Actions > Deploy web to GitHub Pages > Run workflow** (branch `main`).

## Backend: Pages is https, so the API must be https/wss

Browsers block `http://` and `ws://` calls from an https page (mixed content). The backend already allows all CORS origins.

- **Cloudflare Tunnel (recommended for the review):** keep Docker on your machine and let Cloudflare carry
  https/wss traffic to it. Full steps are in [Cloudflare Tunnel setup](#cloudflare-tunnel-setup) below. The
  site only shows live data while your machine and the tunnel are running.
- **Always-on host:** a small VM, Fly.io or Render running `docker compose`. Needs a persistent disk for the databases and costs a few dollars a month.

## Custom domain

1. Set Actions variable `CUSTOM_DOMAIN` = `chrono.example.com` (this also sets the base path to empty and writes the CNAME file).
2. At your DNS provider: for a subdomain add `CNAME chrono -> rronium.github.io`. For an apex domain add `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. In **Settings > Pages > Custom domain** enter the domain, wait for the DNS check, then tick **Enforce HTTPS**.

To force a base path explicitly, set `NEXT_PUBLIC_BASE_PATH` (for example `/Chrono`, or empty).

## Cloudflare Tunnel setup

A tunnel makes a public `https://` address that forwards to a port on your machine, so the Pages site can
reach your local backend without opening any router ports. WebSockets (`wss://`) work through it. Cloudflare
terminates TLS, so you do not manage certificates.

### Before you start

- The stack is running: `docker compose up -d`, and `curl http://localhost:8000/` returns `{"status":"ok", ...}`.
- Install `cloudflared` once:
  - macOS: `brew install cloudflared`
  - Windows: `winget install --id Cloudflare.cloudflared`
  - Linux and other options: see the Cloudflare docs page "Downloads" for `cloudflared`.
- Check it: `cloudflared --version`.

### Option A: quick tunnel (no account, good for a demo)

1. In a spare terminal, leave this running:

   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```

2. It prints a line like `https://random-words.trycloudflare.com`. Test it:
   `curl https://random-words.trycloudflare.com/` should return the same JSON as localhost.
3. In the repo go to **Settings > Secrets and variables > Actions > Variables** and set:
   - `NEXT_PUBLIC_API_URL` = `https://random-words.trycloudflare.com`
   - `NEXT_PUBLIC_WS_URL` = `wss://random-words.trycloudflare.com/ws/live`
4. Re-run the **Deploy to GitHub Pages** workflow (Actions tab > the workflow > Run workflow). The values are
   baked into the JavaScript at build time, so a change only takes effect after a new build.
5. Open `https://rronium.github.io/Chrono/`. The header should say SYSTEM ONLINE.

Limits: the address **changes every time you restart `cloudflared`**, so you must repeat steps 3 and 4 each
time. Quick tunnels are for testing and have no uptime guarantee.

### Option B: named tunnel on your own domain (stable URL)

Needs a free Cloudflare account and a domain whose DNS is managed by Cloudflare (for example
`example.com`). The address then stays the same across restarts.

1. Log in. A browser window opens; pick the domain:

   ```bash
   cloudflared tunnel login
   ```

2. Create the tunnel and note the tunnel ID it prints:

   ```bash
   cloudflared tunnel create chrono
   ```

   This writes a credentials file `<TUNNEL_ID>.json` into `~/.cloudflared/`. Keep it private; never commit it.
3. Create `~/.cloudflared/config.yml` (outside the repo):

   ```yaml
   tunnel: chrono
   credentials-file: /home/YOU/.cloudflared/<TUNNEL_ID>.json
   ingress:
     - hostname: api.example.com
       service: http://localhost:8000
     - hostname: analytics.example.com      # optional, only if you run the analytics service
       service: http://localhost:8001
     - service: http_status:404
   ```

   Use the real path to the credentials file for your system.
4. Create the DNS records for the hostnames (one command each):

   ```bash
   cloudflared tunnel route dns chrono api.example.com
   cloudflared tunnel route dns chrono analytics.example.com
   ```

5. Run it:

   ```bash
   cloudflared tunnel run chrono
   ```

6. Test: `curl https://api.example.com/` returns the health JSON.
7. Set the Actions variables once and re-run the Pages workflow:
   - `NEXT_PUBLIC_API_URL` = `https://api.example.com`
   - `NEXT_PUBLIC_WS_URL` = `wss://api.example.com/ws/live`
   - `NEXT_PUBLIC_ANALYTICS_URL` = `https://analytics.example.com` (optional)

To start the tunnel automatically at login, install it as a service: `sudo cloudflared service install`
(Linux/macOS; see the Cloudflare docs for Windows). It uses the config file above.

### If you also use Cloudflare DNS for the Pages site

When the website's custom domain (`CUSTOM_DOMAIN`, see below) is also on Cloudflare DNS, create its
`CNAME chrono -> rronium.github.io` record as **DNS only** (grey cloud), not Proxied, until GitHub has issued
the HTTPS certificate and **Enforce HTTPS** can be ticked. The backend hostnames above are separate and are
created by `cloudflared` for you.

### Troubleshooting

- **Site says offline or shows demo data:** the page was built without the variables, or the tunnel is down.
  Check `curl <your https URL>/`, then confirm the Actions variables and re-run the workflow.
- **Browser console shows mixed content errors:** the variables use `http://` or `ws://`. They must be
  `https://` and `wss://`.
- **Quick tunnel URL stopped working:** you restarted `cloudflared`, so the address changed. Update the
  variables and re-deploy.
- **Live ticker never connects:** open `https://<your tunnel>/docs` to confirm the backend answers, and check
  `docker compose logs --tail=50 backend`. Do not edit Docker health checks to work around this.
- **Port conflict on 8000:** do not run the backend by hand while Docker is running it.

### Security notes

- A tunnel makes your local backend reachable by anyone who has the URL. It has no login in front of it. Only
  expose it for the demo, stop it afterwards (`Ctrl+C`), and keep secrets (Gemini and Finnhub keys, database
  passwords, `JWT_SECRET`) in the backend `.env`, never in `NEXT_PUBLIC_*` variables.
- The tunnel credentials file and `cloudflared` login certificate in `~/.cloudflared/` are secrets.
