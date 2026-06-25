import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Calendar, LayoutDashboard, History, Boxes, LogOut, Truck, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/agenda",     label: "Agenda",    icon: Calendar },
  { to: "/dashboard",  label: "Dashboard", icon: LayoutDashboard },
  { to: "/historial",  label: "Historial", icon: History },
  { to: "/recursos",   label: "Recursos",  icon: Boxes },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside
        className={cn(
          "fixed md:sticky top-0 left-0 z-40 h-screen w-60 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-16 px-4 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold">DTS Planner Pro</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Operación · Lavados</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary border-l-2 border-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <a
            href="/reservar"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-sidebar-accent"
          >
            <Calendar className="w-4 h-4" /> Vista pública
          </a>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {open && <div onClick={() => setOpen(false)} className="md:hidden fixed inset-0 z-30 bg-black/50" />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-border bg-surface flex items-center px-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="ml-3 text-sm font-semibold">DTS Planner Pro</span>
        </header>
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
