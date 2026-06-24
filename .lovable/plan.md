
# DTS Planner Pro — Plan por fases

Renombramos la app a **DTS Planner Pro** y refactorizamos la operación a un modelo industrial real (equipos, pistas, turnos, colaciones, roles, KPIs, reportes).

## Fase 1 — Recursos operacionales + Roles  (esta entrega)

### Modelo de datos (migración)

Reemplazo de `washers` por `teams` y adición de `lanes`, `shifts` y nuevos campos en `bookings`.

- `teams` — Equipo A / Equipo B (semilla). Campos: name, active.
- `lanes` — Pista 1..4 (semilla). Campos: name, active.
- `shifts` — turnos configurables. Semilla:
  - Turno A: 08:00–20:00, colación 14:00–15:00
  - Turno B: 11:00–20:00, colación 15:00–16:00
- `bookings`:
  - `washer_id` → renombrado a `team_id` (FK `teams`)
  - nueva tabla puente `booking_lanes` (booking_id, lane_id) — ext usa 1 pista, interior usa 2
  - nuevo estado enum ampliado: `programado | en_espera | en_lavado_interior | en_lavado_exterior | control_calidad | finalizado | entregado | cancelado`
- `app_role` enum se amplía: `admin | jefe | lider | operador`
- Trigger `check_booking_overlap` se actualiza para validar:
  - máximo 2 bookings simultáneos (capacidad total)
  - mismo equipo no solapado
  - pistas no solapadas (vía `booking_lanes`)
  - solo lun-vie 08–20 (sáb 08–13 con aprobación, según regla previa)
  - bloqueo de colaciones cuando no hay dotación cubierta

### Asignación automática

Al crear booking el usuario selecciona tipo + hora de inicio:
- el server fn `createBooking` busca el primer equipo libre (A→B)
- busca N pistas libres (1 o 2 según tipo)
- si no hay recurso, devuelve conflicto con sugerencia del siguiente slot

### UI

- Sidebar renombrado **DTS Planner Pro**, color y header industrial.
- Agenda: filas = Equipo A / Equipo B (en vez de lavadores). Toggle alternativo "Vista por Pista".
- Modal de booking: selector de tipo, hora, cliente (texto), patente; muestra recursos asignados automáticamente.
- Página "Recursos" reemplaza "Lavadores": tabs Equipos / Pistas / Turnos (CRUD básico, solo Admin/Jefe editan).
- Nueva página "Operación" (vista de timeline por pista).

### Roles

- Migración crea roles: `admin, jefe, lider, operador`.
- `has_role(_user_id, _role)` ya existe; agregamos `has_any_role(_user_id, _roles[])`.
- Trigger `handle_new_user` mantiene default `operador`.
- Gates en UI:
  - Admin/Jefe: todo
  - Líder: crear/editar bookings, no recursos
  - Operador: solo lectura
- Acción "Promover usuario" (solo admin) en página Configuración.

### Estados visuales

Verde=disponible (slot libre), Azul=programado, Amarillo=en proceso (interior/exterior/QC), Rojo=atrasado (fin < ahora && !finalizado), Gris=finalizado/entregado, Tachado=cancelado.

---

## Fase 2 — Clientes y Camiones (siguiente)

- Tablas `clients` (rut, empresa, contacto, tel, email, obs) y `trucks` (patente, cliente_id, tipo, compartimentos, obs).
- Booking referencia `client_id` y `truck_id` (con autocomplete + creación inline).
- Historial por cliente y por camión.

## Fase 3 — Dashboard + KPIs

- KPIs en tiempo real: utilización personal y pistas, productividad día/sem/mes, rendimiento Equipo A vs B, cumplimiento, atrasados, horas muertas.
- Gráficos comparativos (recharts).
- Alertas en banner cuando: sin equipos, sin pistas, conflictos, atrasos, sobreutilización.

## Fase 4 — Reportes Excel + PDF

- Excel ya disponible; ampliar plantillas diaria/semanal/mensual.
- PDF con jsPDF + autoTable: reporte ejecutivo con KPIs, gráficos embebidos y detalle.

---

## Entregable de esta vuelta (Fase 1)

1. Migración: `teams`, `lanes`, `shifts`, `booking_lanes`, ampliación enums status y roles, trigger nuevo.
2. Reescritura de `BookingModal` y página Agenda para Equipos/Pistas.
3. Renombrar “Lavadores” → “Recursos” con tabs.
4. Sidebar/branding DTS Planner Pro.
5. Hook `useRole` y gates de UI.

Confirma para ejecutar la Fase 1.
