"use client";

import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/auth/roles";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { profile } = useAuth();

  return (
    <header className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <button aria-label="การแจ้งเตือน" className="relative p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
          <Bell size={18} />
        </button>
        {profile && (
          <span className="text-xs px-2 py-1 rounded-full bg-sky-100 text-sky-700 font-medium">
            {ROLE_LABELS[profile.role]}
          </span>
        )}
      </div>
    </header>
  );
}
