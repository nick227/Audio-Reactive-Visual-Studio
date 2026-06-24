# Project State — Audio Visual Layer

## Stack

- Monorepo: pnpm workspaces
- Web: `apps/web` — React 19 + Vite (existing SPA, moved from root)
- API: `apps/server` — Fastify + TypeScript
- DB: `packages/db` — Prisma + MySQL
- API contract: `packages/api-spec/openapi.yaml`
- SDK: `packages/sdk` — openapi-typescript + openapi-fetch + React Query hooks
- Auth: Google Sign-In only (google-auth plugin)
- Object storage: Cloudflare R2 (Phase 2 — stubs exist in spec and handlers)

## Phase Completed

Phase 1 — Monorepo scaffold, Prisma schema, OpenAPI spec, Fastify server, Google auth, project CRUD, SDK generated, frontend wired

## Modules Built

- [x] Auth (Google Sign-In, session cookie)
- [x] Project CRUD (documentJson stored as Postgres JSON column)
- [x] Project sharing (shareToken → /p/:shareToken public route)
- [x] Profile section (/profile — account info, display name edit, password reset, media history placeholder, logout)
- [x] Password reset (PasswordResetToken model, hashed, single-use, 1h expiry; EmailService stub logs to console in dev)
- [x] Admin section (/admin — user management with role/suspend/delete guards, community asset list/publish)
- [x] AdminGuard (client-side, redirects non-ADMIN to /); adminAuth security handler (server-side, 403)
- [x] CommunityAsset model (admin-uploaded media, separate from ProjectAsset; upload stubs return 501)
- [ ] R2 media uploads (Phase 2 — spec + handler stubs exist, not wired)
- [ ] ProjectAsset records (Phase 2)
- [ ] IndexedDB → R2 migration flow (Phase 2)
- [ ] Email provider (Resend/Nodemailer) — EmailService stub logs reset URL to console

## Key Design Decisions

- **localStorage + IDB still primary**: Before sign-in the app works exactly as before.
  After sign-in, "Save to Cloud" explicitly syncs. No autosave replacement — local saves
  run as before; cloud save is additive.
- **Project JSON stored as-is**: `documentJson` is the full `Project` typed object from
  `src/features/visualizer/project/types.ts`. No SQL normalization of layers/effects.
- **schemaVersion** is an int, currently 1. Increment when Project shape changes.
- **Media not uploaded yet in Phase 1**: Cloud-saved projects reference fileKeys but blobs
  live in IDB locally. Phase 2 adds R2 upload flow.
- **No Profile model**: User has displayName/avatarUrl directly. Simpler for this app.
- **googleId is nullable**: Seeded/admin-created accounts have no googleId until they sign
  in with Google; GoogleAuthService matches by email and attaches it on first login.
- **passwordHash is nullable**: Email/password auth not wired yet; field reserved for
  the admin-created user flow in the profile+admin epic.
- **UserRole enum**: USER (default) / ADMIN. Exposed in the `User` schema and all `/auth`
  responses. Admin routes will use a separate `adminAuth` security handler.

## Deviations from Factory Defaults

- DB: MySQL (factory default, no deviation)
- Auth: Google-only (no email/password path for regular users yet)
- User model: no separate Profile table; has role + passwordHash (both nullable-safe)
- Web app: existing React 19 + Vite SPA (pre-existing, not scaffolded from template)

## Last Session Summary

Admin seed infrastructure added. Schema updated: `googleId` nullable, `passwordHash`
optional, `UserRole` enum (USER/ADMIN), `role` field on User. Seed upserts admin by
`ADMIN_EMAIL` env var. OpenAPI spec + SDK regenerated to expose `role`. Auth handler
updated to include role in response DTO.

Next: Phase 2 — R2 upload flow for both ProjectAsset and CommunityAsset; wire Resend/Nodemailer in EmailService; complete ShareViewer playback page.
