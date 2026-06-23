import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lavadores")({
  head: () => ({ meta: [{ title: "Lavadores · DTS Lavados" }] }),
  component: LavadoresPage,
});

function LavadoresPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: washers = [] } = useQuery({
    queryKey: ["washers-all"],
    queryFn: async () => (await supabase.from("washers").select("*").order("name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nombre requerido");
      const { error } = await supabase.from("washers").insert({ name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["washers-all"] }); qc.invalidateQueries({ queryKey: ["washers"] }); toast.success("Lavador agregado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("washers").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["washers-all"] }); qc.invalidateQueries({ queryKey: ["washers"] }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("washers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["washers-all"] }); toast.success("Lavador eliminado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Lavadores</h1>
        <p className="text-sm text-muted-foreground">Gestiona los recursos del taller.</p>
      </div>

      <div className="erp-panel p-4 flex gap-2">
        <Input
          placeholder="Nombre del lavador"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add.mutate(); }}
        />
        <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="w-4 h-4" /> Agregar</Button>
      </div>

      <div className="erp-panel divide-y divide-border">
        {washers.length === 0 && <div className="p-4 text-sm text-muted-foreground">No hay lavadores.</div>}
        {washers.map((w) => (
          <div key={w.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium">{w.name}</div>
              <div className="text-xs text-muted-foreground">{w.active ? "Activo" : "Inactivo"}</div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={w.active} onCheckedChange={(v) => toggle.mutate({ id: w.id, active: v })} />
              <Button variant="ghost" size="icon" onClick={() => { if (confirm(`¿Eliminar ${w.name}?`)) remove.mutate(w.id); }}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
