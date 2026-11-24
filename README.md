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

## Cashless cards

Students spend with a 13.56 MHz NFC card. The card stores **only its factory
UID** — the balance stays in `ledger_entries`, so a lost card is killed by
revoking a row rather than by chasing money written onto the card.

- Staff assign a card from the student's profile in the accountant dashboard.
- Tapping a card on the students list opens that student.
- Schema and the `assign_card_to_student` / `find_student_by_card` functions
  live in `supabase/migrations/20261123120000_student_cards.sql`.

The USB reader cannot be reached from a browser, so a small local program owns
it and streams taps over loopback. See [tools/nfc-bridge](tools/nfc-bridge).
It must run on each machine that assigns or reads cards.

## Applying migrations

```bash
cd tools/db && npm install && node apply-migrations.mjs --list
```

Needs `SUPABASE_DB_URL` (session pooler connection string) in `.env.local`.
Each file runs in a transaction and is recorded in `schema_migrations`, so
re-running is safe. Use `--file <name>` to apply one.
