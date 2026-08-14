const PLACEHOLDER_HOST = "your-project-ref.supabase.co";
const DELETED_PROJECT_HOST = "asenwmnrivrcunbclajp.supabase.co";

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and set your Supabase project URL."
    );
  }
  if (url.includes(PLACEHOLDER_HOST) || url.includes(DELETED_PROJECT_HOST)) {
    throw new Error(
      "Supabase project URL is not configured. Create a project at https://supabase.com/dashboard, then set NEXT_PUBLIC_SUPABASE_URL in .env.local."
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key || key === "your-anon-key") {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Add your anon key from Supabase Dashboard → Project Settings → API."
    );
  }
  return key;
}

export async function assertSupabaseReachable(url: string): Promise<void> {
  if (typeof window !== "undefined") return;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${url}`);
  }

  const { lookup } = await import("node:dns/promises");
  try {
    await lookup(hostname);
  } catch {
    throw new Error(
      `Cannot resolve Supabase host "${hostname}". The project may have been deleted or the URL is wrong. Create a new project at https://supabase.com/dashboard and update .env.local.`
    );
  }
}
