import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WASH_TYPES, STATUS_META, type WashType, type WashStatus } from "@/lib/wash-types";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/historial")({
  head: () => ({ meta: [{ title: "Historial · DTS Lavados" }] }),
  component: HistorialPage,
});

function HistorialPage() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [washerId, setWasherId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: washers = [] } = useQuery({
    queryKey: ["washers-all"],
    queryFn: async () => (await supabase.from("washers").select("*").order("name")).data ?? [],
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["historial", from, to, washerId, status],
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select("*, washers(name)")
        .gte("start_at", startOfDay(new Date(from)).toISOString())
        .lte("start_at", endOfDay(new Date(to)).toISOString())
        .order("start_at", { ascending: false });
      if (washerId !== "all") q = q.eq("washer_id", washerId);
      if (status !== "all") q = q.eq("status", status as WashStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) =>
      r.plate?.toLowerCase().includes(s) ||
      r.client?.toLowerCase().includes(s) ||
      r.observations?.toLowerCase().includes(s)
    );
  }, [rows, search]);

  function exportExcel() {
    const data = filtered.map((r: any) => ({
      Fecha: format(new Date(r.start_at), "yyyy-MM-dd HH:mm"),
      Fin: format(new Date(r.end_at), "yyyy-MM-dd HH:mm"),
      Lavador: r.washers?.name ?? "",
      Tipo: WASH_TYPES[r.wash_type as WashType].label,
      "Duración (min)": Math.round((new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 60000),
      Patente: r.plate,
      Cliente: r.client ?? "",
      Estado: STATUS_META[r.status as WashStatus].label,
      Observaciones: r.observations ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, `historial-lavados-${from}_${to}.xlsx`);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Historial</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} registros</p>
        </div>
        <Button onClick={exportExcel}><Download className="w-4 h-4" /> Exportar Excel</Button>
      </div>

      <div className="erp-panel p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label className="text-xs">Lavador</Label>
          <Select value={washerId} onValueChange={setWasherId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {washers.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Estado</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2 md:col-span-1">
          <Label className="text-xs">Buscar</Label>
          <Input placeholder="Patente, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="erp-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Lavador</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Patente</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Sin resultados.</td></tr>
            )}
            {filtered.map((r: any) => {
              const meta = STATUS_META[r.status as WashStatus];
              return (
                <tr key={r.id} className="border-t border-border hover:bg-surface-2">
                  <td className="px-3 py-2 font-mono text-xs">{format(new Date(r.start_at), "yyyy-MM-dd HH:mm")}</td>
                  <td className="px-3 py-2">{r.washers?.name}</td>
                  <td className="px-3 py-2 text-xs">{WASH_TYPES[r.wash_type as WashType].short}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{r.plate}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.client ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border-l-2" style={{ background: meta.bg, borderColor: meta.color }}>
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
