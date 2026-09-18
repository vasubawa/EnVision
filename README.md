# EnVision

![EnVision Landing Page](./public/landingpage.png)

An AI-tutored whiteboard for STEM subjects — physics, chemistry, calculus, circuits, algorithms, and more. Upload a problem set or start with a blank canvas, work it out by hand, and get Socratic feedback as you go instead of just being handed the answer.

Jump straight in anonymously, or sign up to save your work and pick up where you left off.

## Features

- **Instant Workspaces**: Start learning immediately — no account required. Drop in a PDF, image, or snap a photo of your homework with the built-in camera.
- **Socratic AI Tutor**: Two analysis modes: a quick check and a deep analysis. The AI reads your whiteboard via vision, then asks guiding questions rather than giving answers. Full chat is also available.
- **LaTeX Rendering**: All AI responses render math using KaTeX — inline and block expressions, fractions, integrals, chemistry notation, and more.
- **Freehand Whiteboard**: Pen, eraser, shapes (rectangle, circle, line), text tool, color palette, undo/redo, grid toggle, and canvas download. Built on Fabric.js.
- **File Uploads**: PDF and image support (PNG, JPG, WEBP). Pages are rendered onto the canvas via PDF.js.
- **Privacy-first**: Anonymous sessions are created on first use, protected by a one-time Captcha. Sign up later to migrate all your workspaces to a permanent account.
- **Email Auth**: Sign in or create an account with email and password. Anonymous workspaces are automatically migrated on sign-up.

## Tech Stack

- **Framework**: Next.js (App Router) + Tailwind CSS v4
- **Database & Auth**: Supabase (Postgres, anonymous sessions, email/password auth)
- **Canvas**: Fabric.js for drawing, PDF.js for worksheet imports
- **AI — Vision**: NVIDIA NIM (`nemotron-3-nano-omni` reasoning model) for whiteboard transcription
- **AI — Reasoning**: Groq for Socratic feedback (quick check) and chat; NVIDIA NIM (`nemotron-3-super-120b`) for deep analysis and more indepth guidance.
- **AI SDK**: Vercel AI SDK (`ai` + `@ai-sdk/groq`) for streaming chat
- **Math Rendering**: KaTeX via `rehype-katex` + `remark-math`
- **Security**: Cloudflare Turnstile for Captcha verification

## Getting Started

1. Clone the repo and copy `.env.example` to `.env.local`, then fill in all keys.

> **Note:** Make sure to enable **"Enable Captcha protection"** in your Supabase Auth configuration (using Cloudflare Turnstile) to secure the auth endpoints.

2. Install dependencies and start the dev server:

```bash
pnpm install
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database

The database schema and RLS policies are in `supabase/migrations/`. Push them to your Supabase project with:

```bash
pnpm db:push
```

## Deployment

The project is designed to deploy on Vercel.

### Keep-alive (Supabase free tier)

Free Supabase projects can pause after ~7 days of low database activity. Two Vercel Cron jobs (Hobby allows 2/day) hit `GET /api/cron/keep-alive` at **06:00** and **18:00** UTC. Each run calls `run_keep_alive()`, which:

1. Increments `keep_alive_counter` (write)
2. Inserts a row into `keep_alive_pings` (write)
3. Prunes old ping rows (delete)
4. Counts rows in `profiles`, `workspaces`, and `messages` (reads)
5. Optionally pings Upstash Redis if configured

**Vercel:** set `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in Production. Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron invocations. Success looks like `{ "ok": true, "supabase": { "ok": true, "result": { "pingCount": N, ... } } }`.

If the project is already paused, restore it in the Supabase dashboard first; keep-alive cannot unpause a project.

After pulling schema changes, push migrations:

```bash
pnpm db:push
```

## Available Scripts

- `pnpm dev` — Start the development server
- `pnpm build` / `pnpm start` — Production build and serve
- `pnpm check` — Typecheck, lint, and format-check
- `pnpm fix` — Lint and auto-fix formatting
- `pnpm db:push` — Push local Supabase migrations to your linked project
