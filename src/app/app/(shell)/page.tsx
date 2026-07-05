import Link from "next/link";
import { PageStack } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/money-ui";
import { getParentStudents, getProfile } from "@/lib/ledger/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ParentHomeClient } from "./parent-home-client";
import { ParentHomeHeader } from "./parent-home-header";

export default async function ParentHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await getProfile(supabase, user.id);
  const students = await getParentStudents(supabase, user.id);

  return (
    <PageStack>
      <ParentHomeHeader />

      <div>
        <p className="text-xs text-[var(--app-text-muted)] md:text-sm">Good day</p>
        <h1 className="page-title">{profile.full_name}</h1>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title">Your students</h2>
        <Link href="/app/send" className="shrink-0 text-xs font-semibold md:text-sm">
          Send money
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="space-y-2.5 md:space-y-3">
          <EmptyState
            title="No students linked yet"
            description="Link your child to start sending money."
          />
          <Link href="/app/onboard" className="btn-primary block w-full text-center">
            Link a child
          </Link>
        </div>
      ) : (
        <ParentHomeClient initialStudents={students} />
      )}
    </PageStack>
  );
}
