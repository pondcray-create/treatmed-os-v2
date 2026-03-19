"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types/database";

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "your-supabase-url";

export function useAuth() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // DEV MODE: ใช้ mock profile เมื่อยังไม่ได้ตั้งค่า Supabase
    if (DEV_MODE) {
      setProfile({
        id: "dev-user",
        email: "dev@treatmed.com",
        full_name: "Dev Admin",
        role: "admin",
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as UserProfile);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (DEV_MODE) { window.location.href = "/login"; return; }
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return { profile, loading, signOut };
}
