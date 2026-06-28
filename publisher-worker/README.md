# Timeline Publisher Worker

Private Cloudflare Worker for `publish.strailico.me`. It accepts a protected timeline event submission, validates it, and writes Markdown, images, and the monthly manifest into the Astro blog repository through the GitHub Contents API.

## API

- `GET /api/health`
- `POST /api/publish`

`POST /api/publish` expects `multipart/form-data`:

- `manifest`: JSON string for one timeline event
- `content`: Markdown string, or a `content.md` file
- `images[]`: processed `.webp` image files
- `thumbs[]`: processed `.webp` thumbnail files

The Worker does not trust submitted paths. It derives repository paths from `datetime` and `id`.

## Secrets

Set these with Wrangler before deployment:

```sh
wrangler secret put GITHUB_TOKEN
wrangler secret put CF_ACCESS_AUD
```

`GITHUB_TOKEN` needs permission to read and write repository contents.

For local development, create `publisher-worker/.dev.vars`:

```dotenv
GITHUB_TOKEN=github_pat_xxx
CF_ACCESS_AUD=access-application-aud
ALLOW_LOCAL_BYPASS=true
LOCAL_DRY_RUN=true
```

`ALLOW_LOCAL_BYPASS=true` only bypasses Access verification for localhost requests.
`LOCAL_DRY_RUN=true` makes localhost publish requests validate and return computed paths without writing to GitHub.

## Cloudflare Access Setup

Use Cloudflare Access as the only login layer for `publish.strailico.me`.

1. Create a self-hosted Access application for `publish.strailico.me`.
2. Add an allow policy for your email address or email domain.
3. Enable the email one-time-pin/MFA flow you want in Cloudflare Zero Trust.
4. Copy the Access application audience tag into `CF_ACCESS_AUD`.
5. Set `CF_ACCESS_TEAM_DOMAIN` in `wrangler.jsonc` to the team domain shown by Zero Trust, for example `https://<team-name>.cloudflareaccess.com`.

The Worker verifies the `cf-access-jwt-assertion` header on every API request. Requests without a valid Access JWT are rejected before any GitHub write.

## GitHub Token

Use a fine-grained GitHub token scoped to the blog repository.

Required repository permission:

- Contents: read and write

The token should be stored only as the Worker secret `GITHUB_TOKEN`.

## Local Contract Test

Start the Worker:

```sh
pnpm dev
```

In another terminal:

```sh
pnpm sample:publish
```

The sample request posts one event with one `.webp` image and thumbnail to `http://localhost:8787/api/publish`.

Recommended local flow while the frontend prototype is still moving:

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Keep `ALLOW_LOCAL_BYPASS=true` and `LOCAL_DRY_RUN=true`.
3. Start the Worker with `pnpm dev`.
4. Point the frontend publish call at `http://localhost:8787/api/publish`.
5. Switch off `LOCAL_DRY_RUN` only when testing real GitHub writes.

## Frontend Request Contract

Example `manifest` field:

```json
{
  "id": "a8f3k2p9",
  "datetime": "2026-06-21T23:15:00+08:00",
  "location": "Fuzhou",
  "content": "content.md",
  "images": [
    {
      "id": "a8f3k2p9-1",
      "width": 1600,
      "height": 1200,
      "thumbWidth": 480,
      "thumbHeight": 360,
      "alt": ""
    }
  ]
}
```

Rules the frontend should follow:

- `datetime` must be ISO 8601 with timezone, such as `2026-06-21T23:15:00+08:00`.
- Image files must be named `{eventId}-{number}.webp`.
- Thumbnail files must be named `{eventId}-{number}_thumb.webp`.
- A publish payload may include at most 16 uploaded image/thumbnail pairs by default.
- Bare image names in Markdown are fine; final public paths become `/images/timeline/{name}`.
- Empty `location` can be omitted.

## Repository Writes

MVP uses the GitHub Contents API:

1. Read `src/content/timeline/YYYY/MM/manifest.json`.
2. Treat 404 as an empty array.
3. Reject duplicate event ids.
4. Upload `content.md`.
5. Upload images and thumbnails.
6. Write the updated monthly manifest last.

This can create multiple commits. A later version can switch to the Git Data API for one clean commit.
