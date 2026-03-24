import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccess, getDefaultRedirect } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database";

export async function middleware(request: NextRequest) {
  // DEV MODE: ถ้ายังไม่ได้ตั้งค่า Supabase ให้ bypass auth ทั้งหมด
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl === "your-supabase-url") {
    const { pathname } = request.nextUrl;
    if (pathname === "/login" || pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ถ้าไม่ได้ login แล้วพยายามเข้า protected route → redirect ไป login
  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ถ้า login แล้วพยายามเข้า /login → redirect ออก
  if (user && pathname === "/login") {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role ?? "as_service") as UserRole;
    return NextResponse.redirect(
      new URL(getDefaultRedirect(role), request.url)
    );
  }

  // ตรวจสอบ role permission
  if (user && pathname !== "/login") {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role ?? "as_service") as UserRole;

    if (!canAccess(role, pathname)) {
      return NextResponse.redirect(
        new URL(getDefaultRedirect(role), request.url)
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
