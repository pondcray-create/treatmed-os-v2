"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { canAccess, getDefaultRedirect } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // อย่าใช้ role หลอก (as_service) ตอน profile ยังไม่มา — จะทำให้หน้า /se/* โดน redirect ทิ้งก่อนโหลดจบ
    if (!profile) return;
    const role = profile.role as UserRole;
    if (!canAccess(role, pathname)) {
      router.replace(getDefaultRedirect(role));
    }
  }, [loading, profile, pathname, router]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
