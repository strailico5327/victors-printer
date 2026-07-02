# Project Context

## Publish Preview Attempt Reverted

- A attempted New event textarea-to-code preview and separate publish log panel were reverted after they caused incorrect editor sizing and an unwanted clickable status icon.
- At that point, publish source files were restored to the prior normal layout and behavior before the corrected overlay was reimplemented below.
- Local publish testing now runs Astro at `http://localhost:4321/` and Wrangler at `http://127.0.0.1:8788/`; root `.env` points `PUBLIC_PUBLISH_API_ENDPOINT` to the local Worker.
- Dashboard Worker local requests are detected through Wrangler/Miniflare local request metadata and always bypass Access plus return publish dry-run results, so local testing does not write to GitHub or trigger deploy hooks.
- Verification passed after cleanup: `pnpm astro check`.

## Publish Progress Overlay

- Publishing now scrolls the page to the New event card, changes the top-right status icon into the existing rotating sync/loading state, fades the textarea out, and fades a code display into the exact same editor frame.
- The New event progress display reuses the same Astro Expressive Code/native code frame structure and runtime renderer used by the Images syntax editor.
- The progress code frame is an absolute overlay inside `#editor-pane`; it must stay the same size and position as the textarea frame.
- Publish progress logs append as the draft archive is built, uploaded to the Worker, accepted, and completed. Local dry-run responses show the content path and skip zero-count image lines.
- Failure messages are written into the progress code frame instead of relying only on blocking browser alerts.
- Verification passed: `pnpm astro check`, `pnpm --dir worker type-check`, and in-app browser dry-run confirmed textarea opacity `0`, code frame opacity `1`, matching editor/log frame dimensions, and Worker dry-run completion logs.

## Agent Working Rules

- `AGENTS.md` now requires Codex to commit after every meaningful project change unless the user explicitly says not to commit.
- Commits must continue to follow the existing allowed prefix patterns in `AGENTS.md`: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `perf:`, or `chore:`.
- This guidance update touched `AGENTS.md` and `CONTEXT.md`; no build or type-check was needed because only repository documentation changed.

## Publish Client Script Extraction

- The publish page client script was mechanically extracted from `src/pages/publish.astro` into `src/scripts/publish/client.js`.
- `src/pages/publish.astro` now keeps the existing markup and scoped CSS in place and imports the extracted client module from its `<script>` block.
- The extracted script body matches the previous inline script body; no IDs, classes, data attributes, selector contracts, workflow logic, API endpoint assumptions, or UI styling were changed.
- CSS was intentionally left in `src/pages/publish.astro` because the approved first batch only moves the client script and Astro scoped CSS remains risky.
- Verification passed: `pnpm astro check` and `pnpm build`.
- Remaining risk: this was build-verified but not browser-click smoke-tested in the dashboard UI.

## Publish Page Module Refactor

- `src/pages/publish.astro` is now a route wrapper that mounts `src/components/publish/PublishPage.astro` inside `MainGridLayout`.
- Publish markup is split into `PublishMainSection.astro`, `PublishImagePanel.astro`, and `PublishActions.astro` under `src/components/publish/`.
- Publish styles were moved from the Astro page `<style>` block to `src/styles/publish/publish.css`; `:global(...)` selectors were converted for external CSS and selectors are scoped under `.publish` to avoid site-wide bleed.
- Publish editor focus and selected image highlights are drawn with `::after` border overlays to keep rounded corners intact while keeping the highlight visible above textarea/image content.
- The main editor background and clipping live on `#editor-pane`; the inner textarea is transparent with no radius so the top-left and bottom-left corners are not double-painted or clipped.
- Publish section headings use the shared `.publish-section-title` accent-bar wrapper; `New event` and `Images` share the same horizontal bar offset, with only vertical position controlled by section modifier variables.
- Publish client helper logic was split into `src/scripts/publish/datetime.js`, `draft-format.js`, and `image-assets.js`; DOM queries, event wiring, IDs/classes/data attributes, workflow behavior, and API endpoint assumptions remain in `client.js`.
- Verification passed: `pnpm astro check`, `pnpm build`, HTTP 200 for local `/publish/`, and browser smoke test confirmed publish DOM/style presence plus Tag menu click behavior.
- Remaining risk: browser smoke test was targeted, not a full manual publish/draft/image workflow pass.

## Publish Timeline Tag Input

- The publish form metadata row is ordered as Date & time, Tag, Location.
- Timeline publishes require exactly one tag. If the tag field is empty, required-action validation scrolls to the tag input and focuses it without showing a blocking alert.
- Saving a draft is blocked when the current tag field is empty using the same scroll-and-focus behavior. `Open draft` does not validate the current page tag before file selection.
- The tag input is readonly by default. Choosing a preset tag from the tag button menu fills the input and keeps editing locked.
- The tag button opens a small float-panel style menu matching the existing light/dark and image mode menus.
- Current example preset tags are `Games` and `Life`.
- Choosing `New` clears the tag input and unlocks editing so a custom single tag can be typed.
- Timeline event frontmatter uses a single scalar tag field: `tag: "Tag"`. Posts still use the `tags` array.
- Existing timeline events were backfilled with `tag: "UNKNOWN"` for manual reassignment later.
- Draft export writes the selected tag as `tag: "Tag"`.
- Draft restore fills `tag`, with fallback support for old `tags` arrays. Restored preset tags stay readonly; restored custom tags become editable.
- Files touched for this follow-up: `src/scripts/publish/client.js` and `CONTEXT.md`.
- Verification for this follow-up: `pnpm astro check`.
- Remaining risk for this follow-up: the new save/load guard is build-checked but not yet click-smoke-tested in the browser after the change.

## Timeline Pages

- Timeline events are monthly paginated. `/timeline/` is the newest month, then `/timeline/2/`, `/timeline/3/`, and so on move to older months.
- The timeline route is `src/pages/timeline/[...page].astro`; the old flat `src/pages/timeline.astro` was removed.
- Timeline and Nothing share their common title/header/card/pagination rendering through `src/components/TimelineLikePage.astro`; page files should only prepare their different grouping and metadata.
- Each timeline page has a fixed header card styled like a post header: title `Timeline`, a month date widget such as `June, 2026`, and the tags that appear in that month.
- Timeline header title `Timeline` links to `/nothing/` so the Timeline/Nothing pages can toggle through their titles.
- Timeline header subtitle is configured in `siteConfig.timelineSubtitle` in `src/config.ts`. Empty string hides it.
- Timeline cards show the event date/time, the single event tag next to the date using the post tag style, and location when present.
- Pagination reuses `src/components/control/Pagination.astro`; that component now accepts optional `basePath`, with Home unchanged when it is not provided.
- Timeline content was audited for image shortcuts and mojibake: all `:!img` references have source images and `_thumb.webp` files, stuck prose/shortcut blocks were separated with blank lines, and damaged smart punctuation/Japanese/Chinese text was rewritten as valid UTF-8 or HTML entities where needed.

## Nothing Page

- Nothing entries are split into a dedicated `nothing` content collection under `src/content/nothing/YYYY/*.md`.
- Nothing Markdown filenames and frontmatter ids use `ddmmyyhhmm-xxxxxxxx`, where the suffix is eight lowercase alphanumeric random characters.
- Nothing images follow the entry id with an ordinal suffix, such as `ddmmyyhhmm-xxxxxxxx-1.jpg` and `ddmmyyhhmm-xxxxxxxx-1_thumb.webp`.
- Nothing entries are yearly paginated. `/nothing/` is the newest year, then `/nothing/2/`, `/nothing/3/`, and so on move to older years.
- The Nothing route is `src/pages/nothing/[...page].astro`; it reads the `nothing` collection, sorts entries newest first, and renders each year as separate cards similar to Timeline.
- The Nothing header title links back to `/timeline/`; the Timeline header title links to `/nothing/`.
- Nothing header does not show a year metadata widget. Its optional subtitle is configured in `siteConfig.nothingSubtitle` in `src/config.ts`; empty string hides it.
- Nothing image assets use `/images/nothing/YYYY`, supported by the shortcut asset resolver.
- Nothing image shortcuts that need a numeric gallery name should use the explicit gallery override form, for example `:!img ddmmyyhhmm-xxxxxxxx-1.jpg 75 @ddmmyyhhmm-xxxxxxxx`, so numeric gallery labels are not parsed as widths.
- The old single-file `src/content/spec/nothing.md` source was removed after migration.
- The 26/05/2026 Nothing entry was rewritten as valid UTF-8 after mojibake was found in the Japanese title; it uses HTML numeric entities for `みんなの日本語` to avoid Windows encoding corruption.
- The shortcut asset resolver reads VFile `path`, `history`, and `dirname`/`basename`; this is required for Nothing content images to resolve to `/images/nothing/YYYY` instead of page-relative URLs.

## About Page

- `src/content/spec/about.md` has frontmatter with only `title` and `published`.
- `src/pages/about.astro` reads `aboutPost.data.title` for the large post-style title and `aboutPost.data.published` for a calendar metadata widget formatted as `dd/mm/yyyy`.
- The About page no longer uses the first markdown line or `:!###` for its main title.
- The `spec` collection schema in `src/content/config.ts` allows only optional `title` and `published` fields and is strict, so extra spec frontmatter keys should fail validation.

## Markdown Shortcuts

- Posts support an `indev` frontmatter field. It is optional, defaults to `false`, and must be boolean. `indev: true` posts are visible in dev but filtered from production build output, lists, RSS, and generated routes.
- Post frontmatter must not set `draft: true` and `indev: true` at the same time. `draft` is for real unpublished content; `indev` is for development-only pages/tests/docs.
- Archive, tag widgets, and category widgets exclude `indev: true` posts even in dev; direct post routes remain available in dev.
- The shortcuts documentation now lives at `src/content/posts/shortcuts.md` as an `indev: true` post. In dev it is readable at `/posts/shortcuts/`; production does not generate it in `dist`.
- The old spec page `src/pages/shortcuts.astro` and `src/content/spec/shortcuts.md` were removed.
- `:!===!:` is the existing card separator gap.
- `:!==!:` is a light in-card separator. It renders as `shortcut-inner-separator`, not `<hr>`, so it avoids Markdown horizontal-rule spacing.

## Sidebar Now Playing Widget

- A `NowPlaying` sidebar widget was added at `src/components/widget/NowPlaying.astro` and mounted above Categories in `src/components/widget/SideBar.astro`.
- The widget uses a minimal card style: a `material-symbols:music-note` icon in the same accent position as the standard widget blue mark, with the artist on a second subtitle-style line.
- Long song titles are truncated in JavaScript by whole words with `...` included in the measured width; avoid native character-level ellipsis here because it can cut a word awkwardly.
- The widget is hidden by default and only becomes visible when the Worker returns a track with `nowPlaying: true`; no currently playing song means no sidebar card is shown.
- To avoid the music card visually arriving after Categories/Tags, the widget initially reserves its card height invisibly, renders a fresh short-lived cached track immediately when available, then refreshes from the API and hides if the API reports no active track.
- The widget polls `/now-playing` every 30 seconds. This is intentionally not shorter because Last.fm now-playing updates are not instant and the public API should stay lightweight.
- When the current track changes, only the song and artist lines animate: old text slides right and fades out, then the new text slides in from the left; the artist line starts slightly later than the song title.
- Frontend config lives in `nowPlayingConfig` in `src/config.ts`, with type support in `src/types/config.ts`.
- The frontend does not expose a Last.fm API key. It requests the public endpoint `https://api.strailico.me/now-playing`.
- Public API routes live in the separate `api-worker/` Cloudflare Worker, not the Access-protected dashboard Worker.
- `api-worker/src/index.ts` has `GET /now-playing`, `HEAD /now-playing`, `OPTIONS`, and `GET /health`.
- `GET /now-playing` reads `LASTFM_API_KEY` from the API Worker environment and `LASTFM_USER` from API Worker vars, then proxies Last.fm `user.getrecenttracks`.
- It returns `track: null` when the latest Last.fm track is not actively playing, so the sidebar widget remains hidden.
- Do not point the widget at `dashboard.strailico.me`; that host is protected by Cloudflare Access and returns an Access login redirect to public visitors.
- `api-worker/wrangler.jsonc` stores non-secret `LASTFM_USER: "strailynx"` and custom domain route `api.strailico.me`. Add the API key as an API Worker secret/environment variable named `LASTFM_API_KEY`; do not commit it.
- `.env.example` documents the backend variable name as `LASTFM_API_KEY=`.
- `api-worker/README.md` documents the `/now-playing` route, `LASTFM_API_KEY` secret, `LASTFM_USER` var, and local `.dev.vars` example.
- Verification run: `pnpm astro check`, `pnpm --dir worker type-check`, `pnpm --dir api-worker type-check`, and `pnpm build` passed. Root `pnpm type-check` still fails before checking source because existing `tsconfig.json` has an invalid `ignoreDeprecations` value.
