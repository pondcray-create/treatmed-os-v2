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
  const role = (profile?.role ?? "as_service") as UserRole;

  useEffect(() => {
    if (loading) return;
    if (!canAccess(role, pathname)) {
      router.replace(getDefaultRedirect(role));
    }
  }, [loading, pathname, role, router]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
