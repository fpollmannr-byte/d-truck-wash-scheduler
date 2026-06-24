import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppRole = "admin" | "jefe" | "lider" | "operador";

export function useRoles() {
  const { user } = useAuth();
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const hasRole = (r: AppRole) => roles.includes(r);
  const hasAnyRole = (rs: AppRole[]) => rs.some((r) => roles.includes(r));
  // Por defecto cualquier autenticado tiene rol 'operador'
  const isOperator  = hasRole("operador") || roles.length === 0;
  const isLeader    = hasAnyRole(["lider", "jefe", "admin"]);
  const isManager   = hasAnyRole(["jefe", "admin"]);
  const isAdmin     = hasRole("admin");
  const canEdit     = isLeader; // crear/editar bookings
  const canManage   = isManager; // recursos
  return { roles, isLoading, hasRole, hasAnyRole, isOperator, isLeader, isManager, isAdmin, canEdit, canManage };
}
