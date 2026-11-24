// Apply SQL migrations to the Supabase Postgres database.
//
//   node apply-migrations.mjs                  # apply any not yet recorded
//   node apply-migrations.mjs --file <name>    # apply one file
//   node apply-migrations.mjs --list           # show what would run
//
// Reads SUPABASE_DB_URL from ../../.env.local. Each file runs inside a
// transaction and is recorded in public.schema_migrations, so re-running is
// safe and already-applied files are skipped.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const only = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const listOnly = args.includes("--list");

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  connectionString,
  // Supabase's pooler terminates TLS with its own cert chain.
  ssl: { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  create table if not exists public.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  );
`);

const { rows } = await client.query("select name from public.schema_migrations");
const applied = new Set(rows.map((r) => r.name));

const pending = files.filter((f) => (only ? f === only : !applied.has(f)));

if (listOnly) {
  for (const f of files) console.log(`${applied.has(f) ? "applied" : "PENDING"}  ${f}`);
  await client.end();
  process.exit(0);
}

if (pending.length === 0) {
  console.log("Nothing to apply.");
  await client.end();
  process.exit(0);
}

let failed = false;

for (const file of pending) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  process.stdout.write(`${file} ... `);

  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      "insert into public.schema_migrations (name) values ($1) on conflict (name) do nothing",
      [file]
    );
    await client.query("commit");
    console.log("ok");
  } catch (err) {
    await client.query("rollback");
    console.log("FAILED");
    console.error(`  ${err.message}`);
    if (err.position) {
      // Point at the offending statement; these files are long.
      const upto = sql.slice(0, Number(err.position));
      console.error(`  at line ${upto.split("\n").length}`);
    }
    failed = true;
    break;
  }
}

await client.end();
process.exit(failed ? 1 : 0);
