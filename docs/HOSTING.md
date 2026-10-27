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

- **Cloudflare Tunnel (recommended for the review):** keep Docker on your machine and run `cloudflared tunnel --url http://localhost:8000`. This gives a free `https://<random>.trycloudflare.com` URL with wss support (`NEXT_PUBLIC_API_URL=https://<random>.trycloudflare.com`, `NEXT_PUBLIC_WS_URL=wss://<random>.trycloudflare.com/ws/live`). A quick tunnel gets a new URL every time `cloudflared` restarts, so update both variables and rerun the workflow each time. Use a named tunnel on your own domain for a stable URL. The site only shows live data while your machine is on.

Live quotes only exist for the symbols the ingestion worker tracks (`services/ingestion/connectors/`). Country-page rows outside that list show "no live feed" even with a working backend, and the chart and news panels show sample data until the backend has stored OHLC history and articles.
- **Always-on host:** a small VM, Fly.io or Render running `docker compose`. Needs a persistent disk for the databases and costs a few dollars a month.

## Custom domain

1. Set Actions variable `CUSTOM_DOMAIN` = `chrono.example.com` (this also sets the base path to empty and writes the CNAME file).
2. At your DNS provider: for a subdomain add `CNAME chrono -> rronium.github.io`. For an apex domain add `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. In **Settings > Pages > Custom domain** enter the domain, wait for the DNS check, then tick **Enforce HTTPS**.

To force a base path explicitly, set `NEXT_PUBLIC_BASE_PATH` (for example `/Chrono`, or empty).
