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
