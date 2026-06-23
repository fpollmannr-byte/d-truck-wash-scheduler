import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WASH_TYPES, STATUS_META, computeEndAt, formatDuration, validateSchedule, type WashType, type WashStatus } from "@/lib/wash-types";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

export type BookingDraft = {
  id?: string;
  washer_id: string;
  wash_type: WashType;
  plate: string;
  client: string;
  observations: string;
  start_at: string; // ISO local "YYYY-MM-DDTHH:mm"
  status: WashStatus;
  supervisor_approved: boolean;
};

export function emptyDraft(washerId = "", startISO?: string): BookingDraft {
  const d = startISO ? new Date(startISO) : new Date();
  d.setSeconds(0, 0);
  if (!startISO) d.setMinutes(0);
  return {
    washer_id: washerId,
    wash_type: "exterior",
    plate: "",
    client: "",
    observations: "",
    start_at: format(d, "yyyy-MM-dd'T'HH:mm"),
    status: "programado",
    supervisor_approved: false,
  };
}

export function BookingModal({
  open, onOpenChange, draft, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: BookingDraft | null;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<BookingDraft | null>(draft);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setD(draft); }, [draft]);

  const { data: washers } = useQuery({
    queryKey: ["washers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("washers").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  if (!d) return null;

  const start_iso_preview = d.start_at ? new Date(d.start_at).toISOString() : null;
  const end_iso_preview = start_iso_preview ? computeEndAt(start_iso_preview, d.wash_type) : null;
  const schedule = start_iso_preview && end_iso_preview
    ? validateSchedule(start_iso_preview, end_iso_preview, d.supervisor_approved)
    : null;

  async function save() {
    if (!d) return;
    if (!d.washer_id) return toast.error("Selecciona un lavador");
    if (!d.plate.trim()) return toast.error("Ingresa la patente");
    const start_iso = new Date(d.start_at).toISOString();
    const end_iso = computeEndAt(start_iso, d.wash_type);
    const check = validateSchedule(start_iso, end_iso, d.supervisor_approved);
    if (!check.ok) return toast.error(check.reason);
    setSaving(true);
    const payload = {
      washer_id: d.washer_id,
      wash_type: d.wash_type,
      plate: d.plate.trim().toUpperCase(),
      client: d.client.trim() || null,
      observations: d.observations.trim() || null,
      start_at: start_iso,
      end_at: end_iso,
      status: d.status,
      supervisor_approved: d.supervisor_approved,
    };
    const res = d.id
      ? await supabase.from("bookings").update(payload).eq("id", d.id)
      : await supabase.from("bookings").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(d.id ? "Lavado actualizado" : "Lavado creado");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    onSaved?.();
    onOpenChange(false);
  }

  async function remove() {
    if (!d?.id) return;
    if (!confirm("¿Eliminar este lavado?")) return;
    const { error } = await supabase.from("bookings").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Lavado eliminado");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    onOpenChange(false);
  }

  const duration = WASH_TYPES[d.wash_type].minutes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{d.id ? "Editar lavado" : "Nuevo lavado"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Tipo de lavado</Label>
              <Select value={d.wash_type} onValueChange={(v: WashType) => setD({ ...d, wash_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(WASH_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label} — {formatDuration(v.minutes)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Duración total: <span className="text-primary font-medium">{formatDuration(duration)}</span></p>
            </div>

            <div className="space-y-1.5">
              <Label>Lavador</Label>
              <Select value={d.washer_id} onValueChange={(v) => setD({ ...d, washer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {washers?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={d.status} onValueChange={(v: WashStatus) => setD({ ...d, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Patente</Label>
              <Input value={d.plate} onChange={(e) => setD({ ...d, plate: e.target.value })} placeholder="AB-CD-12" maxLength={12} />
            </div>

            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Input value={d.client} onChange={(e) => setD({ ...d, client: e.target.value })} maxLength={120} />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label>Fecha y hora de inicio</Label>
              <Input type="datetime-local" value={d.start_at} onChange={(e) => setD({ ...d, start_at: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                Horario: Lun–Vie 08:00–20:00 · Sábado 08:00–13:00 (con aprobación) · Domingo cerrado.
              </p>
            </div>

            {schedule && !schedule.ok && (
              <div
                className={`col-span-2 flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                  schedule.needsApproval
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                }`}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{schedule.reason}</span>
              </div>
            )}

            <div className="col-span-2 flex items-center gap-2">
              <Checkbox
                id="supervisor-approved"
                checked={d.supervisor_approved}
                onCheckedChange={(v) => setD({ ...d, supervisor_approved: v === true })}
              />
              <Label htmlFor="supervisor-approved" className="text-sm font-normal cursor-pointer">
                Cuenta con aprobación de jefatura (fuera de horario o sábados)
              </Label>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label>Observaciones</Label>
              <Textarea rows={3} value={d.observations} onChange={(e) => setD({ ...d, observations: e.target.value })} maxLength={500} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {d.id && (
            <Button variant="destructive" size="sm" onClick={remove} className="mr-auto">
              <Trash2 className="w-4 h-4" /> Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
