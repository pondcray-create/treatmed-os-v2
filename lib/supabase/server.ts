import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "your-supabase-url";

const mockServerClient = {
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
  },
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
  }),
};

export async function createClient() {
  if (DEV_MODE) return mockServerClient as any;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ไม่สามารถ set cookie ได้ (ไม่ใช่ error)
          }
        },
      },
    }
  );
}
