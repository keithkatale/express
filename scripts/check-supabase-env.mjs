import { lookup } from "node:dns/promises";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (!existsSync(envPath)) {
  console.error("Missing .env.local — copy .env.example and add your Supabase credentials.");
  process.exit(1);
}

const env = readFileSync(envPath, "utf8");
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const anon = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim();
const service = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();

if (!url || url.includes("your-project-ref") || url.includes("asenwmnrivrcunbclajp")) {
  console.error("NEXT_PUBLIC_SUPABASE_URL points to a missing or placeholder project.");
  console.error("Create a project at https://supabase.com/dashboard and update .env.local.");
  process.exit(1);
}

if (!anon || anon === "your-anon-key") {
  console.error("Set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
  process.exit(1);
}

let hostname;
try {
  hostname = new URL(url).hostname;
} catch {
  console.error(`Invalid URL: ${url}`);
  process.exit(1);
}

try {
  await lookup(hostname);
} catch {
  console.error(`DNS lookup failed for ${hostname} — project does not exist or URL is wrong.`);
  process.exit(1);
}

const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
});
console.log(`Supabase reachable: ${url} (HTTP ${res.status})`);

if (!service) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY is not set — admin API routes and seed will fail.");
}
