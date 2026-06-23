import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfWeek, addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { WASH_TYPES, STATUS_META, type WashType, type WashStatus } from "@/lib/wash-types";
import { Calendar, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · DTS Lavados" }] }),
  component: DashboardPage,
});

const SHIFT_MINUTES = (22 - 7) * 60; // 7am - 10pm = 900 min

function DashboardPage() {
  const today = new Date();
  const dayFrom = startOfDay(today);
  const dayTo = endOfDay(today);
  const weekFrom = startOfWeek(today, { weekStartsOn: 1 });
  const weekTo = endOfDay(addDays(weekFrom, 6));

  const { data: washers = [] } = useQuery({
    queryKey: ["washers"],
    queryFn: async () => (await supabase.from("washers").select("*").eq("active", true).order("name")).data ?? [],
  });

  const { data: today_bookings = [] } = useQuery({
    queryKey: ["bookings-today"],
    queryFn: async () => (await supabase.from("bookings").select("*").gte("start_at", dayFrom.toISOString()).lte("start_at", dayTo.toISOString())).data ?? [],
  });

  const { data: week_bookings = [] } = useQuery({
    queryKey: ["bookings-week"],
    queryFn: async () => (await supabase.from("bookings").select("*").gte("start_at", weekFrom.toISOString()).lte("start_at", weekTo.toISOString())).data ?? [],
  });

  const usedByWasher = washers.map((w) => {
    const used = today_bookings
      .filter((b) => b.washer_id === w.id && b.status !== "cancelado")
      .reduce((acc, b) => acc + (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000, 0);
    return { ...w, used, pct: Math.min(100, Math.round((used / SHIFT_MINUTES) * 100)), available: Math.max(0, SHIFT_MINUTES - used) };
  });

  const totalUsed = usedByWasher.reduce((a, w) => a + w.used, 0);
  const totalCapacity = washers.length * SHIFT_MINUTES || 1;
  const globalPct = Math.round((totalUsed / totalCapacity) * 100);

  const statusCounts: Record<WashStatus, number> = { programado: 0, en_proceso: 0, completado: 0, cancelado: 0 };
  today_bookings.forEach((b) => { statusCounts[b.status as WashStatus]++; });

  const weekChart = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekFrom, i);
    const day = format(d, "EEE", { locale: es });
    const count = week_bookings.filter((b) => format(new Date(b.start_at), "yyyy-MM-dd") === format(d, "yyyy-MM-dd")).length;
    return { day, count };
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground capitalize">{format(today, "EEEE d 'de' MMMM yyyy", { locale: es })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Calendar className="w-4 h-4" />} label="Lavados hoy" value={today_bookings.length.toString()} accent="var(--accent)" />
        <Kpi icon={<Clock className="w-4 h-4" />} label="Utilización global" value={`${globalPct}%`} accent="var(--primary)" />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Completados" value={statusCounts.completado.toString()} accent="var(--status-done)" />
        <Kpi icon={<AlertCircle className="w-4 h-4" />} label="Cancelados" value={statusCounts.cancelado.toString()} accent="var(--destructive)" />
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(STATUS_META) as WashStatus[]).map((s) => (
          <div key={s} className="erp-panel p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{STATUS_META[s].label}</span>
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].color }} />
            </div>
            <div className="text-2xl font-mono font-bold mt-2">{statusCounts[s]}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Utilización por lavador */}
        <div className="erp-panel p-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Utilización por lavador · Hoy</h2>
          <div className="space-y-4">
            {usedByWasher.length === 0 && <p className="text-sm text-muted-foreground">Sin lavadores activos.</p>}
            {usedByWasher.map((w) => (
              <div key={w.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{w.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {Math.round(w.used / 60 * 10) / 10}h / {SHIFT_MINUTES / 60}h · <span className="text-primary">{w.pct}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${w.pct}%`, background: "var(--primary)" }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Disponible: {Math.round(w.available / 60 * 10) / 10}h</div>
              </div>
            ))}
          </div>
        </div>

        {/* Semana */}
        <div className="erp-panel p-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Lavados por día · Esta semana</h2>
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
