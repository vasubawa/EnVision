# EnVision

An AI-tutored whiteboard for physics, chemistry, and calculus. Upload a problem set, work it out by hand on the canvas, and get Socratic feedback as you go instead of a worked answer.

## Stack

- Next.js (App Router) + Tailwind CSS
- Supabase (magic-link auth, Postgres)
- Fabric.js canvas, pdf.js for worksheet imports
- Groq / NVIDIA NIM for vision transcription and tutoring models

## Getting started

1. Copy `.env.example` to `.env.local` and fill in the Supabase and model provider keys. `CRON_SECRET` is a required environment variable in production, and keep-alive requests must use its value as the `Bearer` token.
2. Install dependencies and run the dev server:

   ```bash
   pnpm install
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

## Database

Schema and RLS policies live in `supabase/migrations/`. Push them to your Supabase project with:

```bash
pnpm db:push
```

## Scripts

- `pnpm dev` — start the dev server
- `pnpm build` / `pnpm start` — production build and serve
- `pnpm check` — typecheck, lint, and format-check
- `pnpm fix` — lint and format-fix
- `pnpm db:push` — push local Supabase migrations to the linked project
