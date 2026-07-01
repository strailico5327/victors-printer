# Victor's Printer API Worker

Public Cloudflare Worker for lightweight blog APIs at `api.strailico.me`.

## Routes

- `GET /health` returns a simple health check.
- `GET /now-playing` returns the currently playing Last.fm track for the sidebar widget.
- `HEAD /now-playing` returns `204` for availability checks.

`/now-playing` returns `track: null` when no song is currently playing. The sidebar widget hides itself in that case.

## Secrets

Set these on the Worker:

```powershell
cd X:\Blog\victors-printer\api-worker
pnpm exec wrangler secret put LASTFM_API_KEY
```

- `LASTFM_API_KEY`: Last.fm API key used by `/now-playing`. This stays backend-only and must not be exposed as a `PUBLIC_` variable.

## Config

`wrangler.jsonc` contains non-secret config:

- `LASTFM_USER=strailynx`
- `PUBLIC_SITE_ORIGIN=https://strailico.me`
- custom domain route `api.strailico.me`

## Deploy

```powershell
cd X:\Blog\victors-printer\api-worker
pnpm install
pnpm type-check
pnpm exec wrangler deploy
```

After deploy, check:

```powershell
Invoke-WebRequest -Uri https://api.strailico.me/now-playing -UseBasicParsing
```

The response should be JSON, not a Cloudflare Access login redirect.

## Local Development

Create `api-worker/.dev.vars`:

```dotenv
LASTFM_API_KEY=lastfm_api_key
```

Run locally:

```powershell
cd X:\Blog\victors-printer\api-worker
pnpm dev
```
