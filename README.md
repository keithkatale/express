# Benchmark Express

Boarding school money management app for parents and school bursars.

## Setup

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Run the migration in `supabase/migrations/20260705120000_initial_schema.sql` via the Supabase SQL editor or CLI.
3. Install dependencies: `npm install`
4. Start dev server: `npm run dev`

## Demo seed

After creating users in Supabase Auth, run:

```bash
npm run seed
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

## Roles

- **parent** — view linked students, send deposits
- **secretary** — confirm deposits, record withdrawals
- **admin** — secretary access + link students to parents
