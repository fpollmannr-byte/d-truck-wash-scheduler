import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfWeek, addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  STATUS_META, ACTIVE_STATUSES, CLOSED_STATUSES,
  OPERATORS_POOL, BAYS_TOTAL, type WashStatus,
} from "@/lib/wash-types";
import { Calendar, Clock, CheckCircle2, AlertCircle, Activity, Users, Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · DTS Planner Pro" }] }),
  component: DashboardPage,
});

const SHIFT_MINUTES = (20 - 8) * 60; // operación 08–20 = 720 min

function DashboardPage() {
  const today = new Date();
  const dayFrom = startOfDay(today);
  const dayTo = endOfDay(today);
  const weekFrom = startOfWeek(today, { weekStartsOn: 1 });
  const weekTo = endOfDay(addDays(weekFrom, 6));

  const { data: bays = [] } = useQuery({
    queryKey: ["bays"],
    queryFn: async () => (await supabase.from("bays").select("id, name, active").eq("active", true).order("name")).data ?? [],
  });

  const { data: today_bookings = [] } = useQuery({
    queryKey: ["bookings-today"],
    queryFn: async () => (await supabase.from("bookings")
      .select("id, bay_id, status, start_at, end_at, operators_needed")
      .gte("start_at", dayFrom.toISOString()).lte("start_at", dayTo.toISOString())).data ?? [],
  });

  const { data: week_bookings = [] } = useQuery({
    queryKey: ["bookings-week"],
    queryFn: async () => (await supabase.from("bookings")
      .select("id, status, start_at")
      .gte("start_at", weekFrom.toISOString()).lte("start_at", weekTo.toISOString())).data ?? [],
  });

  const usedByBay = bays.map((t) => {
    const used = today_bookings
      .filter((b) => b.bay_id === t.id && b.status !== "cancelado")
      .reduce((acc, b) => acc + (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000, 0);
    return { ...t, used, pct: Math.min(100, Math.round((used / SHIFT_MINUTES) * 100)), available: Math.max(0, SHIFT_MINUTES - used) };
  });

  const totalUsed = usedByBay.reduce((a, t) => a + t.used, 0);
  const baysCapacity = (bays.length || BAYS_TOTAL) * SHIFT_MINUTES;
  const baysPct = Math.round((totalUsed / baysCapacity) * 100);

  // Utilización de personal: operadores·minuto / (pool * jornada)
  const opMinutes = today_bookings
    .filter((b) => b.status !== "cancelado")
    .reduce((acc, b) => {
      const m = (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000;
      return acc + m * (b.operators_needed ?? 3);
    }, 0);
  const personnelCapacity = OPERATORS_POOL * SHIFT_MINUTES;
  const personnelPct = Math.min(100, Math.round((opMinutes / personnelCapacity) * 100));

  const counts: Record<WashStatus, number> = {
    programado: 0, en_espera: 0, en_proceso: 0,
    en_lavado_interior: 0, en_lavado_exterior: 0, control_calidad: 0,
    completado: 0, finalizado: 0, entregado: 0, cancelado: 0,
  };
  today_bookings.forEach((b) => { counts[b.status as WashStatus]++; });
  const activeCount = ACTIVE_STATUSES.reduce((a, s) => a + counts[s], 0);
  const closedCount = CLOSED_STATUSES.filter((s) => s !== "cancelado").reduce((a, s) => a + counts[s], 0);

  const now = Date.now();
  const overdue = today_bookings.filter((b) =>
    ACTIVE_STATUSES.includes(b.status as WashStatus) && new Date(b.end_at).getTime() < now
  ).length;

  const weekChart = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekFrom, i);
    const day = format(d, "EEE", { locale: es });
    const count = week_bookings.filter((b) => format(new Date(b.start_at), "yyyy-MM-dd") === format(d, "yyyy-MM-dd")).length;
    return { day, count };
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard Ejecutivo</h1>
        <p className="text-sm text-muted-foreground capitalize">{format(today, "EEEE d 'de' MMMM yyyy", { locale: es })}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<Calendar className="w-4 h-4" />} label="Lavados hoy" value={today_bookings.length.toString()} accent="var(--accent)" />
        <Kpi icon={<Activity className="w-4 h-4" />} label="En proceso" value={activeCount.toString()} accent="var(--status-progress)" />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Finalizados" value={closedCount.toString()} accent="var(--status-done)" />
        <Kpi icon={<Users className="w-4 h-4" />} label="Util. personal" value={`${personnelPct}%`} accent="var(--primary)" />
        <Kpi icon={<AlertCircle className="w-4 h-4" />} label="Atrasados" value={overdue.toString()} accent="var(--destructive)" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(STATUS_META) as WashStatus[]).map((s) => (
          <div key={s} className="erp-panel p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{STATUS_META[s].label}</span>
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].color }} />
            </div>
            <div className="text-2xl font-mono font-bold mt-1">{counts[s]}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="erp-panel p-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            <Layers className="w-4 h-4 inline mr-1.5" />Utilización por bahía · Hoy
          </h2>
          <div className="space-y-4">
            {usedByBay.length === 0 && <p className="text-sm text-muted-foreground">Sin bahías activas.</p>}
            {usedByBay.map((t) => (
              <div key={t.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{t.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {Math.round(t.used / 60 * 10) / 10}h / {SHIFT_MINUTES / 60}h · <span className="text-primary">{t.pct}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: "var(--primary)" }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Disponible: {Math.round(t.available / 60 * 10) / 10}h</div>
              </div>
            ))}

            <div className="pt-3 mt-3 border-t border-border space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">Bahías ({bays.length || BAYS_TOTAL} totales)</span>
                  <span className="font-mono text-accent">{baysPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${baysPct}%`, background: "var(--accent)" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">Personal ({OPERATORS_POOL} operadores)</span>
                  <span className="font-mono text-primary">{personnelPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${personnelPct}%`, background: "var(--primary)" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="erp-panel p-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            <Clock className="w-4 h-4 inline mr-1.5" />Lavados por día · Esta semana
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekChart}>
                <CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6 }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="erp-panel p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <span style={{ color: accent }}>{icon}</span> {label}
      </div>
      <div className="text-3xl font-mono font-bold mt-2" style={{ color: accent }}>{value}</div>
    </div>
  );
}
