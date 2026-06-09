# salki

Internal web application hosted on [Cloudflare Pages](https://pages.cloudflare.com/) under a custom subdomain.

## DNS setup (for client IT)

The main domain is managed at home.pl. To point a subdomain at this Cloudflare Pages deployment, add a **CNAME record** in the home.pl DNS panel:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME | `<subdomain>` | `salki.pages.dev` | 3600 |

> Replace `<subdomain>` with the agreed hostname (e.g. `app` → `app.clientdomain.pl`).  
> Replace `salki.pages.dev` with the actual Pages URL after first deploy.

After the CNAME propagates, add the custom domain in Cloudflare Pages:  
**Pages project → Settings → Custom domains → Add custom domain**.

Cloudflare will issue a TLS certificate automatically.

## Deploy

Push to `main` — Cloudflare Pages deploys automatically.

Manual deploy via Wrangler:

```bash
npx wrangler pages deploy . --project-name salki
```

## Local development

```bash
npm install
npm run dev
```

## Environment variables

Copy `.env.example` to `.env` for local secrets. Production secrets go in Cloudflare Pages dashboard under **Settings → Environment variables**.

## License

Proprietary — see [LICENSE](./LICENSE).
