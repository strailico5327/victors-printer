# Timeline Publisher Worker

Private Cloudflare Worker for `publish.strailico.me`. It accepts a protected draft zip, validates it, and writes timeline Markdown plus images into the Astro blog repository through the GitHub Contents API.

The public site should run on Cloudflare Pages. GitHub is only the source repo; Pages watches it and rebuilds after this Worker commits.

## API

- `GET /api/health`
- `POST /api/publish`

`POST /api/publish` expects `multipart/form-data` with one field:

- `draft`: zip file

Zip contents:

- `{eventId}.md`
- `images/{eventId}-1.jpg|jpeg|png`
- `images/{eventId}-1_thumb.webp`

The Worker derives `YYYY/MM` from frontmatter `published`, writes Markdown to `src/content/timeline/YYYY/MM/{eventId}.md`, and writes images to `public/images/timeline/YYYY/MM/*`.

## Frontmatter

```md
---
type: "event"
id: "2106262315-a8f3k2p9"
published: 2026-06-21T23:15:00+08:00
draft: true
location: ""
---
```

Rules:

- `type` must be `"event"`.
- `id` must match `ddmmyyhhmm-8 lowercase letters or digits`.
- `published` must be ISO 8601 with timezone.
- Original images must be jpg, jpeg, or png.
- Thumbnails must be `{eventId}-n_thumb.webp`.

## Secrets

Set these with Wrangler before deployment:

```sh
wrangler secret put GITHUB_TOKEN
wrangler secret put CF_ACCESS_AUD
```

`GITHUB_TOKEN` needs repository Contents read/write permission.

For local development, create `publisher-worker/.dev.vars`:

```dotenv
GITHUB_TOKEN=github_pat_xxx
CF_ACCESS_AUD=access-application-aud
ALLOW_LOCAL_BYPASS=true
LOCAL_DRY_RUN=true
```

`LOCAL_DRY_RUN=true` validates and returns computed paths without writing to GitHub.

## Local Contract Test

```sh
pnpm dev
```

In another terminal:

```sh
pnpm sample:publish
```
