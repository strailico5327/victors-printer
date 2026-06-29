# Victor's Printer

A personal Astro blog based on Fuwari, with a private Cloudflare Worker dashboard for publishing timeline events.

## Project Shape

- Public site: `https://strailico.me`
- Dashboard: `https://dashboard.strailico.me`
- Publish page: `https://dashboard.strailico.me/publish/`
- Cloudflare Pages project: `victors-printer`
- Worker name: `victors-dashboard`
- Worker folder: `worker/`
- GitHub repo: `strailico5327/victors-printer`

The public site and the dashboard live in this same repo because the Worker writes content and images directly into the site source tree.

## Folders

- `src/`: Astro site source, pages, layouts, components, styles, and content collections.
- `src/content/posts/`: blog posts.
- `src/content/timeline/`: timeline events.
- `public/images/`: static images served by the public site.
- `worker/`: Cloudflare Worker backend for the private dashboard and publish API.
- `scripts/`: local helper scripts.
- `docs/`: project notes and operational docs.

## Commands

Install and run the public site:

```powershell
pnpm install
pnpm dev
```

Check and build the public site:

```powershell
pnpm type-check
pnpm build
pnpm preview
```

Deploy the Worker:

```powershell
cd X:\Blog\victors-printer\worker
pnpm install
pnpm type-check
pnpm exec wrangler deploy
```

More Worker details are in `worker/README.md`.

## Publish Flow

1. Open `https://dashboard.strailico.me/publish/`.
2. Cloudflare Access protects the dashboard host.
3. The Worker serves the publish UI and accepts `POST /api/publish`.
4. The Worker validates the draft zip.
5. The Worker commits images first, then Markdown, to GitHub.
6. The Worker calls `PAGES_DEPLOY_HOOK_URL`.
7. Cloudflare Pages rebuilds `https://strailico.me/timeline/`.

If a published event appears in GitHub but not on the public timeline, check the Cloudflare Pages deployment for the `victors-printer` project first.

## Secrets

Do not commit secrets. Worker secrets are stored in Cloudflare:

```powershell
cd X:\Blog\victors-printer\worker
pnpm exec wrangler secret put GITHUB_TOKEN
pnpm exec wrangler secret put CF_ACCESS_AUD
pnpm exec wrangler secret put PAGES_DEPLOY_HOOK_URL
```

For local Worker testing, use ignored file `worker/.dev.vars`.

## License

The source code of this website is licensed under the MIT License, unless otherwise stated.

Blog posts, articles, essays, personal notes, fiction, images, photographs, illustrations, audio, video, and other original creative content are copyright Victor Christie / Strailico. All rights reserved unless explicitly stated otherwise.

This project is based on or derived from the Fuwari theme, which is licensed under the MIT License. The original copyright notices and license terms of Fuwari and other third-party dependencies remain applicable.
