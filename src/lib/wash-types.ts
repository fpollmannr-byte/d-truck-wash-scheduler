export type WashType = "exterior" | "interior_3" | "interior_4" | "interior_5" | "interior_6";
export type WashStatus =
  | "programado"
  | "en_espera"
  | "en_proceso"
  | "en_lavado_interior"
  | "en_lavado_exterior"
  | "control_calidad"
  | "completado"
  | "finalizado"
  | "entregado"
  | "cancelado";

export const WASH_TYPES: Record<WashType, { label: string; minutes: number; short: string; lanes: number }> = {
  exterior:   { label: "Lavado Exterior",             short: "EXT",  minutes: 40,        lanes: 1 },
  interior_3: { label: "Interior 3 Comp. + Exterior", short: "INT3", minutes: 180 + 45,  lanes: 2 },
  interior_4: { label: "Interior 4 Comp. + Exterior", short: "INT4", minutes: 240 + 45,  lanes: 2 },
  interior_5: { label: "Interior 5 Comp. + Exterior", short: "INT5", minutes: 300 + 45,  lanes: 2 },
  interior_6: { label: "Interior 6 Comp. + Exterior", short: "INT6", minutes: 300 + 45,  lanes: 2 },
};

// Estados — colores: azul=programado, ámbar=en proceso, verde=cierre, gris=cancelado
export const STATUS_META: Record<WashStatus, { label: string; color: string; bg: string }> = {
  programado:         { label: "Programado",        color: "var(--status-scheduled)", bg: "color-mix(in oklch, var(--status-scheduled) 25%, var(--surface))" },
  en_espera:          { label: "En Espera",         color: "var(--status-scheduled)", bg: "color-mix(in oklch, var(--status-scheduled) 18%, var(--surface))" },
  en_proceso:         { label: "En Proceso",        color: "var(--status-progress)",  bg: "color-mix(in oklch, var(--status-progress) 30%, var(--surface))" },
  en_lavado_interior: { label: "Lavado Interior",   color: "var(--status-progress)",  bg: "color-mix(in oklch, var(--status-progress) 30%, var(--surface))" },
  en_lavado_exterior: { label: "Lavado Exterior",   color: "var(--status-progress)",  bg: "color-mix(in oklch, var(--status-progress) 30%, var(--surface))" },
  control_calidad:    { label: "Control Calidad",   color: "var(--accent)",           bg: "color-mix(in oklch, var(--accent) 25%, var(--surface))" },
  completado:         { label: "Completado",        color: "var(--status-done)",      bg: "color-mix(in oklch, var(--status-done) 25%, var(--surface))" },
  finalizado:         { label: "Finalizado",        color: "var(--status-done)",      bg: "color-mix(in oklch, var(--status-done) 25%, var(--surface))" },
  entregado:          { label: "Entregado",         color: "var(--status-done)",      bg: "color-mix(in oklch, var(--status-done) 35%, var(--surface))" },
  cancelado:          { label: "Cancelado",         color: "var(--status-cancelled)", bg: "color-mix(in oklch, var(--status-cancelled) 25%, var(--surface))" },
};

export const ACTIVE_STATUSES: WashStatus[] = ["programado", "en_espera", "en_proceso", "en_lavado_interior", "en_lavado_exterior", "control_calidad"];
export const CLOSED_STATUSES: WashStatus[] = ["completado", "finalizado", "entregado", "cancelado"];

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
// - Lun-Vie: 08:00 a 20:00. Después de 20:00 requiere aprobación de jefatura.
// - Sábado: 08:00 a 13:00 con aprobación de jefatura.
// - Domingo: cerrado.
export function validateSchedule(
  startISO: string,
  endISO: string,
  supervisorApproval: boolean,
): { ok: true } | { ok: false; reason: string; needsApproval?: boolean } {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const day = start.getDay();
  if (start.toDateString() !== end.toDateString()) {
    return { ok: false, reason: "El lavado debe terminar el mismo día que inicia." };
  }
  if (day === 0) return { ok: false, reason: "No se trabaja los domingos." };
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();

  if (day === 6) {
    if (startMin < 8 * 60 || endMin > 13 * 60) {
      return { ok: false, reason: "Los sábados el horario es de 08:00 a 13:00." };
    }
    if (!supervisorApproval) {
      return { ok: false, needsApproval: true, reason: "Los sábados requieren aprobación de jefatura." };
    }
    return { ok: true };
  }

  if (startMin < 8 * 60) return { ok: false, reason: "El horario inicia a las 08:00." };
  if (endMin > 20 * 60 && !supervisorApproval) {
    return { ok: false, needsApproval: true, reason: "Después de las 20:00 se requiere aprobación de jefatura." };
  }
  return { ok: true };
}
