import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfDay, endOfDay, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  WASH_TYPES, computeEndAt, formatDuration, validateSchedule, type WashType,
} from "@/lib/wash-types";
import { Truck, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reservar")({
  head: () => ({ meta: [{ title: "Reservar lavado · DTS Planner Pro" }] }),
  component: PublicBookingPage,
});

type Slot = {
  id: string;
  bay_id: string;
  bay_name: string;
  start_at: string;
  end_at: string;
  status: string;
};

const START_HOUR = 8;
const END_HOUR = 20;

function PublicBookingPage() {
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [washType, setWashType] = useState<WashType>("exterior");
  const [time, setTime] = useState<string>("08:00");
  const [plate, setPlate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [obs, setObs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { data: slots = [], refetch } = useQuery<Slot[]>({
    queryKey: ["public-schedule", date.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_schedule", {
        date_from: startOfDay(date).toISOString(),
        date_to: endOfDay(date).toISOString(),
      });
      if (error) throw error;
      return (data ?? []) as Slot[];
    },
  });

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  // construir mapa bahía → reservas del día
  const bayMap = useMemo(() => {
    const m: Record<string, { name: string; slots: Slot[] }> = {};
    slots.forEach((s) => {
      if (!m[s.bay_id]) m[s.bay_id] = { name: s.bay_name, slots: [] };
      m[s.bay_id].slots.push(s);
    });
    return m;
  }, [slots]);

  async function submit() {
    if (!plate.trim() || !name.trim() || !phone.trim()) {
      return toast.error("Completa patente, nombre y teléfono");
    }
    const [hh, mm] = time.split(":").map(Number);
    const start = new Date(date);
    start.setHours(hh, mm, 0, 0);
    const startISO = start.toISOString();
    const endISO = computeEndAt(startISO, washType);

    const sched = validateSchedule(startISO, endISO, false);
    if (!sched.ok && !sched.needsApproval) return toast.error(sched.reason);

    // Buscar primera bahía libre en ese rango
    const overlapsBay = (bayId: string) =>
      (bayMap[bayId]?.slots ?? []).some((s) => new Date(s.start_at) < new Date(endISO) && new Date(s.end_at) > new Date(startISO));

    const bayIds = Object.keys(bayMap);
    const freeBay = bayIds.find((id) => !overlapsBay(id)) ?? bayIds[0];
    if (!freeBay) return toast.error("No fue posible cargar las bahías. Intenta nuevamente.");

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_public_booking", {
        p_bay_id: freeBay,
        p_contact_name: name.trim(),
        p_contact_phone: phone.trim(),
        p_end_at: endISO,
        p_observations: obs.trim() || undefined,
        p_plate: plate.trim().toUpperCase(),
        p_start_at: startISO,
        p_wash_type: washType,
      });
      if (error) throw error;
      setDone(true);
      toast.success("Solicitud enviada. Te contactaremos para confirmar.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="erp-panel p-8 max-w-md text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-[var(--status-done)]" />
          <h1 className="text-2xl font-bold">¡Solicitud enviada!</h1>
          <p className="text-sm text-muted-foreground">
            Tu solicitud quedó como <span className="text-amber-400 font-semibold">pendiente de confirmación</span>.
            El equipo DTS te contactará al teléfono indicado para confirmar el horario.
          </p>
          <Button onClick={() => { setDone(false); setPlate(""); setObs(""); }} variant="outline">
            Hacer otra reserva
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-bold">DTS Planner Pro</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Reserva en línea</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reserva tu lavado</h1>
          <p className="text-sm text-muted-foreground">
            Consulta la disponibilidad y envía tu solicitud. Tu información permanece privada — otros usuarios solo ven los horarios marcados como reservados.
          </p>
        </div>

        <div className="erp-panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Disponibilidad — {format(date, "EEEE d 'de' MMMM", { locale: es })}
            </h2>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setDate(startOfDay(new Date()))}>Hoy</Button>
              <Button size="icon" variant="outline" onClick={() => setDate(addDays(date, 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid" style={{ gridTemplateColumns: `100px repeat(${hours.length}, 1fr)` }}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-2">Bahía</div>
                {hours.map((h) => (
                  <div key={h} className="text-[10px] font-mono text-muted-foreground text-center py-2 border-l border-grid-line">
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
              </div>
              {Object.entries(bayMap).length === 0 && (
                <div className="text-sm text-muted-foreground p-3">
                  No hay bahías informadas todavía. Aun así puedes enviar tu solicitud y te asignaremos una bahía disponible.
                </div>
              )}
              {Object.entries(bayMap).map(([bayId, info]) => (
                <div key={bayId} className="grid border-t border-border" style={{ gridTemplateColumns: `100px repeat(${hours.length}, 1fr)` }}>
                  <div className="px-2 py-2 text-xs font-semibold">{info.name}</div>
                  {hours.map((h) => {
                    const cellStart = new Date(date); cellStart.setHours(h, 0, 0, 0);
                    const cellEnd = new Date(date); cellEnd.setHours(h + 1, 0, 0, 0);
                    const reserved = info.slots.some((s) =>
                      isSameDay(new Date(s.start_at), date) &&
                      new Date(s.start_at) < cellEnd && new Date(s.end_at) > cellStart
                    );
                    return (
                      <div
                        key={h}
                        className={`h-8 border-l border-grid-line ${reserved ? "bg-[color-mix(in_oklch,var(--status-progress)_35%,var(--surface))]" : ""}`}
                        title={reserved ? "Reservado" : "Disponible"}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[color-mix(in_oklch,var(--status-progress)_35%,var(--surface))]" /> Reservado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border border-border" /> Disponible
            </span>
          </div>
        </div>

        <div className="erp-panel p-4 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Tus datos</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Tipo de servicio</Label>
              <Select value={washType} onValueChange={(v: WashType) => setWashType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(WASH_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label} — {formatDuration(v.minutes)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={format(date, "yyyy-MM-dd")} onChange={(e) => setDate(startOfDay(new Date(e.target.value)))} />
            </div>
            <div className="space-y-1.5">
              <Label>Hora de inicio</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={900} />
            </div>
            <div className="space-y-1.5">
              <Label>Patente</Label>
              <Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="AB-CD-12" maxLength={12} />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre de contacto</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 1234 5678" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Observaciones (opcional)</Label>
              <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 px-3 py-2 text-xs">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Tu reserva queda pendiente hasta que el equipo DTS la confirme. Horario: Lun–Vie 08:00–20:00.</span>
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting}>{submitting ? "Enviando..." : "Enviar solicitud"}</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
