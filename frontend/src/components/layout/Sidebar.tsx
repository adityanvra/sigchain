import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Upload,
  ShieldCheck,
  ScrollText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const items: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/documents", label: "Dokumen", icon: FileText },
  { to: "/upload", label: "Upload Dokumen", icon: Upload },
  { to: "/verify", label: "Verifikasi", icon: ShieldCheck },
  { to: "/audit", label: "Audit Trail", icon: ScrollText },
  { to: "/users", label: "Manajemen User", icon: Users, roles: ["admin"] },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-6 py-5">
        <img src="/logo-uad.png" alt="Logo UAD" className="h-9 w-9 rounded-lg object-contain" />
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">SIGCHAIN-UAD</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Governance Chain
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items
          .filter((it) => !it.roles || (user && it.roles.includes(user.role)))
          .map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
      </nav>

      <div className="border-t p-4 text-[11px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Universitas Ahmad Dahlan</p>
        <p>Secure Integrated Governance Chain</p>
      </div>
    </aside>
  );
}
