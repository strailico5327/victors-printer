# Victor's Printer Worker

Private Cloudflare Worker for the dashboard at `dashboard.strailico.me`.

## Shape

- Worker name: `victors-dashboard`
- Worker folder: `worker/`
- Public site: `https://strailico.me`
- Dashboard host: `https://dashboard.strailico.me`
- Publish UI: `https://dashboard.strailico.me/publish/`
- Pages project: `victors-printer`
- GitHub repo: `strailico5327/victors-printer`

`dashboard.strailico.me` is protected by Cloudflare Access. The Worker proxies the Astro publish UI from the public Pages build, then handles publish API calls on the same protected host.

## Routes

- `GET /` serves the current dashboard entry. For now this is the publish UI until a real dashboard frontend exists.
- `GET /publish/` serves the publish UI.
- `GET /dashboard/` redirects to `/` for old links.
- `POST /api/publish` validates a draft zip, commits timeline content/images to GitHub, then triggers a Pages rebuild when `PAGES_DEPLOY_HOOK_URL` is set.
- `GET /api/health` checks Cloudflare Access auth.
- Other dashboard-host paths redirect to `https://strailico.me/{path}`.

## Publish Flow

1. Browser opens `https://dashboard.strailico.me/publish/`.
2. Cloudflare Access authenticates the request.
3. The Worker proxies `/publish/` from `https://strailico.me/publish/`.
4. The publish UI posts `multipart/form-data` to `/api/publish`.
5. The Worker validates the zip.
6. The Worker uploads images first.
7. The Worker commits the Markdown last.
8. The Worker calls the Cloudflare Pages deploy hook.
9. Pages rebuilds `https://strailico.me/timeline/`.

Images are uploaded before Markdown so a failed publish does not leave timeline HTML pointing at missing files.

## Secrets

Set these on the Worker:

```powershell
cd X:\Blog\victors-printer\worker
pnpm exec wrangler secret put GITHUB_TOKEN
pnpm exec wrangler secret put CF_ACCESS_AUD
pnpm exec wrangler secret put PAGES_DEPLOY_HOOK_URL
```

- `GITHUB_TOKEN`: GitHub fine-grained PAT with Contents read/write for this repo.
- `CF_ACCESS_AUD`: Audience tag from the Cloudflare Access app protecting `dashboard.strailico.me`.
- `PAGES_DEPLOY_HOOK_URL`: Cloudflare Pages deploy hook for `victors-printer`.

Check secrets:

```powershell
pnpm exec wrangler secret list
```

## Config

`wrangler.jsonc` contains non-secret config:

- `GITHUB_OWNER=strailico5327`
- `GITHUB_REPO=victors-printer`
- `GITHUB_BRANCH=main`
- `CF_ACCESS_TEAM_DOMAIN=https://strailico.cloudflareaccess.com`
- upload size limits
- custom domain route `dashboard.strailico.me`

## Deploy

```powershell
cd X:\Blog\victors-printer\worker
pnpm install
pnpm type-check
pnpm exec wrangler deploy
```

Deploying the Worker does not rebuild the public Pages site. Publishing an event does, through `PAGES_DEPLOY_HOOK_URL`.

## Local Development

Create `worker/.dev.vars`:

```dotenv
GITHUB_TOKEN=github_pat_xxx
CF_ACCESS_AUD=access-application-aud
PAGES_DEPLOY_HOOK_URL=https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/xxx
ALLOW_LOCAL_BYPASS=true
LOCAL_DRY_RUN=true
```

Run locally:

```powershell
cd X:\Blog\victors-printer\worker
pnpm dev
```

In another terminal:

```powershell
cd X:\Blog\victors-printer\worker
pnpm sample:publish
```

`LOCAL_DRY_RUN=true` validates the draft and returns computed GitHub paths without writing to GitHub.

## Draft Zip Contract

`POST /api/publish` expects one form field:

- `draft`: zip file

Zip contents:

- `{eventId}.md`
- `images/{eventId}-1.jpg|jpeg|png`
- `images/{eventId}-1_thumb.webp`

Frontmatter:

```md
---
type: "event"
id: "2106262315-a8f3k2p9"
published: 2026-06-21T23:15:00+08:00
draft: true
location: ""
tag: "UNKNOWN"
---
```

Rules:

- `type` must be `"event"`.
- `id` must match `ddmmyyhhmm-8 lowercase letters or digits`; use `ddmmyyxxxx` when the time is unknown.
- `published` must be ISO 8601 with timezone; use `Txx:xx:00+08:00` when the time is unknown.
- `tag` is required and must be a single string.
- Original images must be jpg, jpeg, or png.
- Thumbnails must be `{eventId}-n_thumb.webp`.
