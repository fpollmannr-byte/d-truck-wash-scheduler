import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Layers, Clock, UserCog, ShieldCheck } from "lucide-react";
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
        <p className="text-sm text-muted-foreground">Gestiona bahías, operadores y turnos. {canManage ? "" : "Solo lectura para tu rol."}</p>
      </div>

      <Tabs defaultValue="bays">
        <TabsList>
          <TabsTrigger value="bays"><Layers className="w-4 h-4 mr-1.5" />Bahías</TabsTrigger>
          <TabsTrigger value="operators"><UserCog className="w-4 h-4 mr-1.5" />Operadores</TabsTrigger>
          <TabsTrigger value="shifts"><Clock className="w-4 h-4 mr-1.5" />Turnos</TabsTrigger>
        </TabsList>
        <TabsContent value="bays"><BaysList canManage={canManage} /></TabsContent>
        <TabsContent value="operators"><OperatorsList canManage={canManage} /></TabsContent>
        <TabsContent value="shifts"><ShiftsList canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
}

function BaysList({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["bays", "all"],
    queryFn: async () => (await supabase.from("bays").select("*").order("name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nombre requerido");
      const { error } = await supabase.from("bays").insert({ name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["bays"] }); toast.success("Bahía agregada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("bays").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bays"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bays"] }); toast.success("Bahía eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 pt-3">
      {canManage && (
        <div className="erp-panel p-4 flex gap-2">
          <Input placeholder="Nombre de la bahía" value={name} onChange={(e) => setName(e.target.value)}
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
              <div className="text-xs text-muted-foreground">{w.active ? "Activa" : "Inactiva"}</div>
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

function OperatorsList({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [isSupervisor, setIsSupervisor] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["operators", "all"],
    queryFn: async () => (await supabase.from("operators").select("*").order("name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nombre requerido");
      const { error } = await supabase.from("operators").insert({ name: name.trim(), is_supervisor: isSupervisor });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setIsSupervisor(false); qc.invalidateQueries({ queryKey: ["operators"] }); toast.success("Operador agregado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("operators").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operators"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["operators"] }); toast.success("Operador eliminado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeOps = items.filter((o) => o.active && !o.is_supervisor).length;
  const supervisors = items.filter((o) => o.is_supervisor).length;

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="erp-panel p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Operadores activos</div>
          <div className="text-2xl font-mono font-bold mt-1 text-primary">{activeOps}</div>
        </div>
        <div className="erp-panel p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Supervisores</div>
          <div className="text-2xl font-mono font-bold mt-1 text-accent">{supervisors}</div>
        </div>
      </div>

      {canManage && (
        <div className="erp-panel p-4 flex flex-wrap gap-2 items-center">
          <Input className="flex-1 min-w-[200px]" placeholder="Nombre del operador" value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add.mutate(); }} />
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={isSupervisor} onCheckedChange={setIsSupervisor} /> Supervisor
          </label>
          <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="w-4 h-4" /> Agregar</Button>
        </div>
      )}
      <div className="erp-panel divide-y divide-border">
        {items.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sin registros.</div>}
        {items.map((w) => (
          <div key={w.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              {w.is_supervisor && <ShieldCheck className="w-4 h-4 text-accent" />}
              <div>
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-muted-foreground">
                  {w.is_supervisor ? "Supervisor (Jefe)" : "Operador"} · {w.active ? "Activo" : "Inactivo"}
                </div>
              </div>
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
