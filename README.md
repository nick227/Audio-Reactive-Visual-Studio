# Audio Visual Layer

Audio Visual Layer is a music visualizer studio you can run in the browser. Drop in a track, stack visual layers, add motion/audio-reactive effects, and build little animated scenes without having to wire everything together from scratch.

It is still a work in progress, but the core editor, auth, projects, profile, admin basics, and local media workflow are in place.

![Audio Visual Layer editor](./screen.png)

## What You Need

- Node.js 20+
- pnpm 10+
- MySQL 8+
- A Google OAuth client ID for sign-in

Optional:

- `OPENAI_API_KEY` for Whisper transcription
- Cloudflare R2 credentials later, once upload support is fully wired

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create your env file:

```bash
cp .env.example .env
```

Edit `.env` and set at least:

```bash
DATABASE_URL=mysql://root:password@localhost:3306/avl_dev
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
CORS_ORIGIN=http://localhost:5173
APP_URL=http://localhost:5173
VITE_API_URL=http://localhost:3001
```

Push the database schema and generate the SDK:

```bash
pnpm db:push
pnpm sdk:generate
```

Or let the bootstrap script do the install/generate/db steps for you:

```bash
pnpm bootstrap
```

Start the app:

```bash
pnpm dev
```

Open:

- Web app: `http://localhost:5173`
- API: `http://localhost:3001`
- API docs: `http://localhost:3001/docs`

## Seeding An Admin

Set these in `.env`:

```bash
ADMIN_EMAIL=admin@email.com
ADMIN_PASSWORD=change-this-admin-password
ADMIN_DISPLAY_NAME=Admin
```

Then run:

```bash
pnpm db:seed
```

The seed creates or updates that user as an `ADMIN` and stores a bcrypt password hash from `ADMIN_PASSWORD`. Use that email and password on the normal login screen.

Google sign-in is optional for the same account. If the admin later signs in with Google using the same Gmail address, for example `admin@gmail.com`, the app links that Google account to the seeded admin user.

Admins can open `/admin` after signing in. Current admin features include user listing, role changes, suspend/unsuspend, delete guards, and basic community asset management. R2 upload buttons are still Phase 2 stubs.

## Useful Commands

```bash
pnpm dev          # run web + API in dev mode
pnpm build        # build packages and apps
pnpm typecheck    # typecheck everything
pnpm lint         # lint packages/apps that define lint scripts
pnpm test         # run tests
pnpm db:push      # push Prisma schema to MySQL
pnpm db:seed      # seed/update the admin user
pnpm db:studio    # open Prisma Studio
pnpm sdk:generate # regenerate SDK types from OpenAPI
```

## Deploying

The app deploys as two services from this repo:

- `apps/server`: the Fastify API
- `apps/web`: the Vite frontend

Use a hosted MySQL database and set the same production `DATABASE_URL` on the API service and on any one-off migration/seed job.

### API Service

Build command:

```bash
pnpm install --frozen-lockfile
pnpm --filter server build
```

Start command:

```bash
pnpm --filter server start
```

Production API env:

```bash
NODE_ENV=production
DATABASE_URL=mysql://...
PORT=3001
SESSION_SECRET=use-a-long-random-secret
CORS_ORIGIN=https://your-web-app.example.com
APP_URL=https://your-web-app.example.com
# Optional: set explicitly if your platform does not send forwarded host/proto headers.
API_PUBLIC_URL=https://your-api.example.com
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
OPENAI_API_KEY=sk-...
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=use-a-long-random-admin-password
ADMIN_DISPLAY_NAME=Admin
```

Before the first production start, run the schema push:

```bash
pnpm db:push
```

Then seed the first admin:

```bash
pnpm db:seed
```

### Web Service

Build command:

```bash
pnpm install --frozen-lockfile
pnpm --filter './packages/*' build
pnpm --filter web build
```

Output directory:

```txt
apps/web/dist
```

Production web env:

```bash
VITE_API_URL=https://your-api.example.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Vite reads `VITE_*` values at build time, so rebuild the web app after changing them.

## Notes

- Password reset emails are logged in development. Production email delivery still needs a real provider wired in.
- R2 upload endpoints exist, but uploads are not fully implemented yet.
- Cross-site production auth cookies require HTTPS and matching `CORS_ORIGIN` / `APP_URL` values. `CORS_ORIGIN` accepts comma-separated origins for deploy previews or local admin testing.
