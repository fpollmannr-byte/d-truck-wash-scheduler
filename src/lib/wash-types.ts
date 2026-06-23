export type WashType = "exterior" | "interior_3" | "interior_4" | "interior_5" | "interior_6";
export type WashStatus = "programado" | "en_proceso" | "completado" | "cancelado";

export const WASH_TYPES: Record<WashType, { label: string; minutes: number; short: string }> = {
  exterior:   { label: "Lavado Exterior",                 short: "EXT",   minutes: 40  },
  interior_3: { label: "Interior 3 Comp. + Exterior",     short: "INT3",  minutes: 180 + 45 },
  interior_4: { label: "Interior 4 Comp. + Exterior",     short: "INT4",  minutes: 240 + 45 },
  interior_5: { label: "Interior 5 Comp. + Exterior",     short: "INT5",  minutes: 300 + 45 },
  interior_6: { label: "Interior 6 Comp. + Exterior",     short: "INT6",  minutes: 300 + 45 },
};

export const STATUS_META: Record<WashStatus, { label: string; color: string; bg: string }> = {
  programado:  { label: "Programado",  color: "var(--status-scheduled)",  bg: "color-mix(in oklch, var(--status-scheduled) 25%, var(--surface))" },
  en_proceso:  { label: "En Proceso",  color: "var(--status-progress)",   bg: "color-mix(in oklch, var(--status-progress) 30%, var(--surface))" },
  completado:  { label: "Completado",  color: "var(--status-done)",       bg: "color-mix(in oklch, var(--status-done) 25%, var(--surface))" },
  cancelado:   { label: "Cancelado",   color: "var(--status-cancelled)",  bg: "color-mix(in oklch, var(--status-cancelled) 25%, var(--surface))" },
};

export function computeEndAt(startISO: string, type: WashType): string {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + WASH_TYPES[type].minutes * 60_000);
  return end.toISOString();
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Horarios permitidos:
// - Lun-Vie: 08:00 a 20:00. Después de 20:00 requiere aprobación de jefatura (hasta 23:59).
// - Sábado: cerrado por defecto; 08:00 a 13:00 con aprobación de jefatura.
// - Domingo: cerrado.
export function validateSchedule(
  startISO: string,
  endISO: string,
  supervisorApproval: boolean,
): { ok: true } | { ok: false; reason: string; needsApproval?: boolean } {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const day = start.getDay(); // 0=Dom .. 6=Sab
  if (start.toDateString() !== end.toDateString()) {
    return { ok: false, reason: "El lavado debe terminar el mismo día que inicia." };
  }
  if (day === 0) {
    return { ok: false, reason: "No se trabaja los domingos." };
  }
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();

  if (day === 6) {
    // Sábado: 08:00–13:00 solo con aprobación
    if (startMin < 8 * 60 || endMin > 13 * 60) {
      return { ok: false, reason: "Los sábados el horario es de 08:00 a 13:00." };
    }
    if (!supervisorApproval) {
      return { ok: false, needsApproval: true, reason: "Los sábados requieren aprobación de jefatura." };
    }
    return { ok: true };
  }

  // Lun-Vie
  if (startMin < 8 * 60) {
    return { ok: false, reason: "El horario inicia a las 08:00." };
  }
  if (endMin > 20 * 60) {
    if (!supervisorApproval) {
      return {
        ok: false,
        needsApproval: true,
        reason: "Después de las 20:00 se requiere aprobación de jefatura.",
      };
    }
  }
  return { ok: true };
}
