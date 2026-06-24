import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Users, Layers, Clock } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/recursos")({
  head: () => ({ meta: [{ title: "Recursos · DTS Planner Pro" }] }),
  component: RecursosPage,
});

function RecursosPage() {
  const { canManage } = useRoles();
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Recursos Operacionales</h1>
        <p className="text-sm text-muted-foreground">Gestiona equipos, pistas y turnos. {canManage ? "" : "Solo lectura para tu rol."}</p>
      </div>

      <Tabs defaultValue="teams">
        <TabsList>
          <TabsTrigger value="teams"><Users className="w-4 h-4 mr-1.5" />Equipos</TabsTrigger>
          <TabsTrigger value="lanes"><Layers className="w-4 h-4 mr-1.5" />Pistas</TabsTrigger>
          <TabsTrigger value="shifts"><Clock className="w-4 h-4 mr-1.5" />Turnos</TabsTrigger>
        </TabsList>
        <TabsContent value="teams"><SimpleResource table="teams" label="equipo" canManage={canManage} /></TabsContent>
        <TabsContent value="lanes"><SimpleResource table="lanes" label="pista" canManage={canManage} /></TabsContent>
        <TabsContent value="shifts"><ShiftsList canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleResource({ table, label, canManage }: { table: "teams" | "lanes"; label: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: [table, "all"],
    queryFn: async () => (await supabase.from(table).select("*").order("name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nombre requerido");
      const { error } = await supabase.from(table).insert({ name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: [table] }); qc.invalidateQueries({ queryKey: [table, "all"] }); toast.success(`${label} agregado`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from(table).update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table] }); qc.invalidateQueries({ queryKey: [table, "all"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table, "all"] }); toast.success(`${label} eliminado`); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 pt-3">
      {canManage && (
        <div className="erp-panel p-4 flex gap-2">
          <Input placeholder={`Nombre del ${label}`} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add.mutate(); }} />
          <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="w-4 h-4" /> Agregar</Button>
        </div>
      )}
      <div className="erp-panel divide-y divide-border">
        {items.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin registros.</div>}
        {items.map((w) => (
          <div key={w.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium">{w.name}</div>
              <div className="text-xs text-muted-foreground">{w.active ? "Activo" : "Inactivo"}</div>
            </div>
            {canManage && (
              <div className="flex items-center gap-3">
                <Switch checked={w.active} onCheckedChange={(v) => toggle.mutate({ id: w.id, active: v })} />
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`¿Eliminar ${w.name}?`)) remove.mutate(w.id); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShiftsList({ canManage }: { canManage: boolean }) {
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => (await supabase.from("shifts").select("*").order("start_time")).data ?? [],
  });

  return (
    <div className="space-y-3 pt-3">
      <p className="text-xs text-muted-foreground">
        Los turnos definen las horas de operación y colaciones. {canManage ? "Edición avanzada próximamente." : ""}
      </p>
      <div className="erp-panel divide-y divide-border">
        {shifts.map((s) => (
          <div key={s.id} className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="font-semibold">{s.name}</div>
            <div><span className="text-muted-foreground">Horario:</span> <span className="font-mono">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</span></div>
            <div><span className="text-muted-foreground">Colación:</span> <span className="font-mono">{s.break_start?.slice(0,5)}–{s.break_end?.slice(0,5)}</span></div>
            <div><span className="text-muted-foreground">Dotación:</span> <span className="font-mono">{s.headcount}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
