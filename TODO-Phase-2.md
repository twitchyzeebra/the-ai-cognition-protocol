# Phase 2 — Community Backend (Deferred)

This track is currently paused. Hub/auth/DB code has been removed to keep the app lean. The checklist below is retained only for future reference.

## Setup
- [ ] Choose DB provider (Vercel Postgres or Supabase) and provision database
- [ ] Add connection env vars and local dev strategy
- [ ] Install client library and minimal migration tooling (SQL files or drizzle/prisma)

## Auth
- [ ] Add NextAuth with GitHub + Google providers
- [ ] Create basic `/api/auth/[...nextauth]` config and sessions
- [ ] Protect server routes using session check helpers

## Data model (SQL)
- [ ] Prompts: id, title, description_md, prompt_text, author_id, tags (text[]), upvotes int, created_at
- [ ] Reports: id, prompt_id, reporter_id, reason text, created_at
- [ ] Seed script for a few demo community prompts (optional)

## API endpoints
- [ ] `GET /api/hub/prompts` — list with paging, query (q, tags), sort
- [ ] `GET /api/hub/prompts/:id` — single prompt
- [ ] `POST /api/hub/prompts` — create (auth required)
- [ ] `POST /api/hub/prompts/:id/report` — create report (auth required)

## Pages
- [ ] `/hub` — grid/list, search box, tag chips, sort dropdown, disclaimer banner
- [ ] `/hub/prompt/[id]` — details, “Use this Prompt” button (activates in chat), Report button
- [ ] `/hub/submit` — form (title, description, prompt text, tags) with client validation

## Wiring
- [ ] Sidebar: add clear “Community Hub” entry under prompts, linking to `/hub`
- [ ] “Use this Prompt” flow: store selected community prompt in UI state; send as system instruction

## Moderation & Safety
- [ ] Prominent disclaimer on all hub pages (user-submitted content)
- [ ] Server-side input validation and size limits
- [ ] Basic rate limiting for create/report endpoints (IP/session)

## Telemetry (Optional)
- [ ] Lightweight server logs on API errors (no PII)
- [ ] Count basic usage metrics (list, view, submit) in memory or DB table

## Docs
- [ ] Update README and plan.md with setup steps and routes
- [ ] Add environment variable reference for DB/Auth

Stretch
- [ ] Tag suggestions/autocomplete
- [ ] Upvote endpoint and UI
- [ ] Simple admin list of reports (auth-gated)
