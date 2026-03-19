"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Package,
  BarChart2,
  Wrench,
  Activity,
  TrendingUp,
  Briefcase,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/database";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type NavGroup = {
  label: string;
  color: string;
  roles: UserRole[];
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "TreatMed AS",
    color: "text-emerald-600",
    roles: ["admin", "as_staff"],
    items: [
      { label: "Customer Register", href: "/as/customers", icon: <Users size={16} /> },
      { label: "Stock In/Out", href: "/as/stock", icon: <Package size={16} /> },
      { label: "Stock Monitor", href: "/as/stock-monitor", icon: <BarChart2 size={16} /> },
      { label: "Service Request", href: "/as/service-request", icon: <Wrench size={16} /> },
      { label: "Service Monitor", href: "/as/service-monitor", icon: <Activity size={16} /> },
    ],
  },
  {
    label: "TreatMed SE",
    color: "text-violet-600",
    roles: ["admin", "se_staff"],
    items: [
      { label: "Sales Pipeline", href: "/se/pipeline", icon: <TrendingUp size={16} /> },
      { label: "Deal & Activity", href: "/se/deals", icon: <Briefcase size={16} /> },
      { label: "Service Request", href: "/se/service-request", icon: <Wrench size={16} /> },
      { label: "Follow Up", href: "/se/followup", icon: <CalendarCheck size={16} /> },
      { label: "Forecast / Month", href: "/se/forecast", icon: <FileText size={16} /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const role = profile?.role ?? "as_staff";

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const visibleGroups = NAV_GROUPS.filter((g) => g.roles.includes(role));

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-treatmed-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">TreatMed OS</p>
            <p className="text-xs text-gray-400">V2.0</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            pathname === "/dashboard"
              ? "bg-sky-50 text-sky-600"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <LayoutDashboard size={16} />
          Dashboard
        </Link>

        {/* Module Groups */}
        {visibleGroups.map((group) => {
          const isOpen = !collapsed[group.label];
          return (
            <div key={group.label} className="pt-2">
              <button
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider",
                  group.color,
                  "hover:bg-gray-50"
                )}
              >
                {group.label}
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {isOpen && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                        pathname === item.href
                          ? "bg-sky-50 text-sky-600 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
            {profile?.full_name?.charAt(0) ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile?.full_name ?? "Loading..."}
            </p>
            <p className="text-xs text-gray-400 truncate">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
