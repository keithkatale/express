import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types/database";

function isStaffRole(role: UserRole) {
  return role === "secretary" || role === "admin";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isInviteRoute = pathname.startsWith("/invite/");
  const isParentAuthRoute = pathname === "/login" || pathname === "/signup";
  const isAccountantSignup = pathname === "/accountant/signup";
  const isAccountantLogin = pathname === "/accountant";
  const isAccountantAuth = isAccountantLogin || isAccountantSignup;
  const isAccountantApp =
    pathname.startsWith("/accountant/") && pathname !== "/accountant/signup";
  const isParentApp = pathname.startsWith("/app");
  const isOnboard = pathname === "/app/onboard";
  const isLegacySecretary = pathname.startsWith("/secretary");

  if (isInviteRoute) {
    return supabaseResponse;
  }

  if (isLegacySecretary) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace("/secretary", "/accountant");
    return NextResponse.redirect(url);
  }

  if (!user && (isParentApp || isAccountantApp)) {
    const url = request.nextUrl.clone();
    url.pathname = isAccountantApp ? "/accountant" : "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isParentAuthRoute) {
    const url = request.nextUrl.clone();
    const role = await getUserRole(supabase, user.id);
    if (role === "parent") {
      const hasStudents = await parentHasStudents(supabase, user.id);
      url.pathname = hasStudents ? "/app" : "/app/onboard";
    } else {
      url.pathname = "/accountant/students";
    }
    return NextResponse.redirect(url);
  }

  if (user && isAccountantAuth) {
    const role = await getUserRole(supabase, user.id);
    if (isStaffRole(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/accountant/students";
      return NextResponse.redirect(url);
    }
  }

  if (user && isParentApp) {
    const role = await getUserRole(supabase, user.id);
    if (isStaffRole(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/accountant/students";
      return NextResponse.redirect(url);
    }

    const hasStudents = await parentHasStudents(supabase, user.id);
    if (hasStudents && isOnboard) {
      const url = request.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
  }

  if (user && isAccountantApp) {
    const role = await getUserRole(supabase, user.id);
    if (role === "parent") {
      const url = request.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

async function getUserRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<UserRole> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data?.role as UserRole) ?? "parent";
}

async function parentHasStudents(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("parent_students")
    .select("*", { count: "exact", head: true })
    .eq("parent_id", userId);
  return (count ?? 0) > 0;
}
