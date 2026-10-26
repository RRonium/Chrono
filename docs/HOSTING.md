# Hosting the web app on GitHub Pages

GitHub Pages serves static files only. The Next.js frontend (`apps/web`) is built as a static export and deployed by `.github/workflows/pages.yml` on every push to `main` that touches `apps/web`. The FastAPI backend, WebSocket, databases and ingestion worker cannot run on Pages and must be hosted elsewhere.

## One-time setup

1. Repo **Settings > Pages > Build and deployment > Source: GitHub Actions**.
2. Push to `main` (or run the workflow from the Actions tab). The site appears at `https://rronium.github.io/Chrono/`.
3. Point the site at a backend: **Settings > Secrets and variables > Actions > Variables**:
   - `NEXT_PUBLIC_API_URL` = `https://api.example.com`
   - `NEXT_PUBLIC_WS_URL` = `wss://api.example.com/ws/live`
   - `NEXT_PUBLIC_ANALYTICS_URL` = `https://analytics.example.com` (optional)
   Without these the site falls back to `localhost` and shows demo data.

## Backend: Pages is https, so the API must be https/wss

Browsers block `http://` and `ws://` calls from an https page (mixed content). The backend already allows all CORS origins.

- **Cloudflare Tunnel (recommended for the review):** keep Docker on your machine and run `cloudflared tunnel --url http://localhost:8000`. This gives a free `https://<random>.trycloudflare.com` URL with wss support. Use a named tunnel on your own domain for a stable URL. The site only shows live data while your machine is on.
- **Always-on host:** a small VM, Fly.io or Render running `docker compose`. Needs a persistent disk for the databases and costs a few dollars a month.

## Custom domain

1. Set Actions variable `CUSTOM_DOMAIN` = `chrono.example.com` (this also sets the base path to empty and writes the CNAME file).
2. At your DNS provider: for a subdomain add `CNAME chrono -> rronium.github.io`. For an apex domain add `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
3. In **Settings > Pages > Custom domain** enter the domain, wait for the DNS check, then tick **Enforce HTTPS**.

To force a base path explicitly, set `NEXT_PUBLIC_BASE_PATH` (for example `/Chrono`, or empty).
