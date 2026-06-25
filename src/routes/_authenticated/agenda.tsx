import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfDay, endOfDay, startOfWeek, addWeeks, subDays, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { WASH_TYPES, STATUS_META, type WashType, type WashStatus } from "@/lib/wash-types";
import { BookingModal, emptyDraft, type BookingDraft } from "@/components/BookingModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda · DTS Planner Pro" }] }),
  component: AgendaPage,
});

type View = "dia" | "semana" | "mes";
type Booking = {
  id: string;
  bay_id: string;
  wash_type: WashType;
  plate: string;
  client: string | null;
  observations: string | null;
  start_at: string;
  end_at: string;
  status: WashStatus;
  supervisor_approved: boolean;
  operators_needed: number;
};
type Bay = { id: string; name: string };

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_PX = 60;

function AgendaPage() {
  const [view, setView] = useState<View>("dia");
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<BookingDraft | null>(null);

  const range = useMemo(() => {
    if (view === "dia") return { from: startOfDay(date), to: endOfDay(date) };
    if (view === "semana") {
      const from = startOfWeek(date, { weekStartsOn: 1 });
      return { from, to: endOfDay(addDays(from, 6)) };
    }
    return { from: startOfMonth(date), to: endOfMonth(date) };
  }, [date, view]);

  const { data: bays = [] } = useQuery<Bay[]>({
    queryKey: ["bays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bays").select("id, name, active").eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []).map((b) => ({ id: b.id, name: b.name }));
    },
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["bookings", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, bay_id, wash_type, plate, client, observations, start_at, end_at, status, supervisor_approved, operators_needed")
        .gte("start_at", range.from.toISOString())
        .lte("start_at", range.to.toISOString())
        .order("start_at");
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });

  function shift(dir: 1 | -1) {
    if (view === "dia") setDate(dir === 1 ? addDays(date, 1) : subDays(date, 1));
    else if (view === "semana") setDate(dir === 1 ? addWeeks(date, 1) : subWeeks(date, 1));
    else setDate(dir === 1 ? addMonths(date, 1) : subMonths(date, 1));
  }

  function openNew(bayId?: string, startISO?: string) {
    setDraft(emptyDraft(bayId ?? bays[0]?.id ?? "", startISO));
    setModalOpen(true);
  }

  function openEdit(b: Booking) {
    setDraft({
      id: b.id,
      bay_id: b.bay_id,
      wash_type: b.wash_type,
      plate: b.plate,
      client: b.client ?? "",
      observations: b.observations ?? "",
      start_at: format(new Date(b.start_at), "yyyy-MM-dd'T'HH:mm"),
      status: b.status,
      supervisor_approved: b.supervisor_approved ?? false,
    });
    setModalOpen(true);
  }

  const headerLabel =
    view === "dia"    ? format(date, "EEEE d 'de' MMMM yyyy", { locale: es })
  : view === "semana" ? `Semana del ${format(range.from, "d MMM", { locale: es })} al ${format(range.to, "d MMM yyyy", { locale: es })}`
  :                     format(date, "MMMM yyyy", { locale: es });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Agenda Operacional</h1>
          <p className="text-sm text-muted-foreground capitalize">{headerLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
            {(["dia","semana","mes"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-xs uppercase tracking-wider rounded",
                  view === v ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >{v}</button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setDate(startOfDay(new Date()))}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button onClick={() => openNew()}><Plus className="w-4 h-4" /> Nuevo</Button>
        </div>
      </div>

      {view === "dia"    && <DayView   date={date} bays={bays} bookings={bookings} onNew={openNew} onEdit={openEdit} />}
      {view === "semana" && <WeekView  from={range.from} bays={bays} bookings={bookings} onEdit={openEdit} />}
      {view === "mes"    && <MonthView date={date} bookings={bookings} onPickDay={(d) => { setDate(d); setView("dia"); }} />}

      <BookingModal open={modalOpen} onOpenChange={setModalOpen} draft={draft} />
    </div>
  );
}

function DayView({
  date, bays, bookings, onNew, onEdit,
}: {
  date: Date;
  bays: Bay[];
  bookings: Booking[];
  onNew: (bayId?: string, startISO?: string) => void;
  onEdit: (b: Booking) => void;
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const dayStart = new Date(date); dayStart.setHours(START_HOUR, 0, 0, 0);

  return (
    <div className="erp-panel overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="grid border-b border-border" style={{ gridTemplateColumns: `140px repeat(${hours.length}, ${HOUR_PX}px)` }}>
          <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground border-r border-border bg-surface-2">Bahía</div>
          {hours.map((h) => (
            <div key={h} className="px-1 py-2 text-xs font-mono text-muted-foreground border-r border-border bg-surface-2 text-center">
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {bays.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No hay bahías activas.</div>
        )}
        {bays.map((t) => {
          const wb = bookings.filter((b) => b.bay_id === t.id);
          return (
            <div key={t.id} className="grid border-b border-border" style={{ gridTemplateColumns: `140px 1fr` }}>
              <div className="px-3 py-3 text-sm font-semibold border-r border-border bg-surface-2 flex items-center">
                {t.name}
              </div>
              <div className="relative" style={{ height: 88, width: HOUR_PX * hours.length }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-r border-grid-line"
                    style={{ left: i * HOUR_PX, width: HOUR_PX }}
                    onClick={() => {
                      const d = new Date(date); d.setHours(h, 0, 0, 0);
                      onNew(t.id, d.toISOString());
                    }}
                  />
                ))}
                {wb.map((b) => {
                  const s = new Date(b.start_at);
                  const e = new Date(b.end_at);
                  const startMin = (s.getTime() - dayStart.getTime()) / 60000;
                  const durMin = (e.getTime() - s.getTime()) / 60000;
                  if (startMin + durMin <= 0 || startMin >= hours.length * 60) return null;
                  const left = Math.max(0, startMin);
                  const width = Math.min(hours.length * 60 - left, durMin);
                  const meta = STATUS_META[b.status];
                  return (
                    <button
                      key={b.id}
                      onClick={() => onEdit(b)}
                      className="absolute top-1 bottom-1 rounded-md text-left px-2 py-1 text-xs overflow-hidden border-l-4 hover:brightness-110 transition"
                      style={{ left, width, background: meta.bg, borderColor: meta.color }}
                    >
                      <div className="font-semibold font-mono truncate">{b.plate}</div>
                      <div className="truncate opacity-80">{WASH_TYPES[b.wash_type].short} · {b.client ?? "—"}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  from, bays, bookings, onEdit,
}: {
  from: Date;
  bays: Bay[];
  bookings: Booking[];
  onEdit: (b: Booking) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="erp-panel overflow-x-auto">
      <div className="min-w-[800px] grid" style={{ gridTemplateColumns: `140px repeat(7, 1fr)` }}>
        <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground border-r border-b border-border bg-surface-2">Bahía</div>
        {days.map((d) => (
          <div key={d.toISOString()} className="px-2 py-2 text-xs font-medium border-r border-b border-border bg-surface-2 text-center">
            <div className="uppercase text-muted-foreground">{format(d, "EEE", { locale: es })}</div>
            <div className="font-mono">{format(d, "d/MM")}</div>
          </div>
        ))}
        {bays.map((t) => (
          <div key={t.id} className="contents">
            <div className="px-3 py-2 text-sm border-r border-b border-border bg-surface-2 font-semibold">{t.name}</div>
            {days.map((d) => {
              const list = bookings.filter((b) => b.bay_id === t.id && isSameDay(new Date(b.start_at), d));
              return (
                <div key={t.id + d.toISOString()} className="border-r border-b border-border p-1 space-y-1 min-h-20">
                  {list.map((b) => {
                    const meta = STATUS_META[b.status];
                    return (
                      <button
                        key={b.id}
                        onClick={() => onEdit(b)}
                        className="w-full text-left text-[11px] rounded px-1.5 py-1 border-l-2 truncate"
                        style={{ background: meta.bg, borderColor: meta.color }}
                      >
                        <span className="font-mono font-semibold">{format(new Date(b.start_at), "HH:mm")}</span>
                        {" "}
                        <span className="font-mono">{b.plate}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({
  date, bookings, onPickDay,
}: {
  date: Date;
  bookings: Booking[];
  onPickDay: (d: Date) => void;
}) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 41);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="erp-panel">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2">
        {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => (
          <div key={d} className="px-2 py-2 text-[10px] uppercase tracking-widest text-muted-foreground text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = isSameMonth(d, date);
          const items = bookings.filter((b) => isSameDay(new Date(b.start_at), d));
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPickDay(d)}
              className={cn(
                "min-h-24 p-2 border-r border-b border-border text-left hover:bg-surface-2 transition",
                !inMonth && "opacity-40"
              )}
            >
              <div className={cn("text-xs font-mono mb-1", isSameDay(d, new Date()) && "text-primary font-bold")}>
                {format(d, "d")}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((b) => {
                  const meta = STATUS_META[b.status];
                  return (
                    <div key={b.id} className="text-[10px] truncate rounded px-1 py-0.5 border-l-2" style={{ background: meta.bg, borderColor: meta.color }}>
                      <span className="font-mono">{format(new Date(b.start_at), "HH:mm")}</span> {b.plate}
                    </div>
                  );
                })}
                {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} más</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
