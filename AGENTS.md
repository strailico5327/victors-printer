# AGENTS.md

Public-safe working rules for Codex and other AI agents in this repository.

This is an Astro/Fuwari blog project with a Cloudflare Worker dashboard. Inspect the real source before changing behaviour, keep edits small, and prefer existing project patterns.

Do not commit, push, deploy, install dependencies, change secrets, or alter Cloudflare settings unless explicitly asked.

Do not put secrets, tokens, passwords, private deployment credentials, sensitive personal information, or private progress chatter in this file.

## Local AI Handoff Notes

Detailed local AI handoff notes are stored in root `CONTEXT.md`.

If `CONTEXT.md` exists in the local working tree, read it before making project changes. It records the current project state, progress, known traps, and update log.

After meaningful project changes, update `CONTEXT.md` with:

- what changed
- why it changed
- files touched
- how it was verified
- remaining issues or risks

Do not put secrets, tokens, passwords, private deployment credentials, or sensitive personal information in `AGENTS.md` or `CONTEXT.md`.

## Commit Message Rules

After every meaningful project change, commit the work unless the user explicitly says not to commit.

Use these commit prefixes for every commit, strictly following this format:

- `feat: new feature`
- `fix: bug fix`
- `style: css/ui only`
- `refactor: code cleanup`
- `docs: documentation`
- `perf: performance`
- `chore: misc`

Every commit message must start with exactly one allowed prefix above, followed by a short description.

If any extra identifier or tag is needed, append it at the end of the commit message. Do not put identifiers or tags before the prefix.



**ANOTHER LLM SHALL INSPECT THE CODE AFTER ANY CHANGES, SO KEEP ALL THE CODE READABLE AND MAINTIANABLE AND TIDY.**
