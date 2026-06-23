# Agenda DTS Lavados

App web para programar lavados de camiones con calendario tipo taller, recursos (lavadores), validación de traslapes y dashboard.

## Stack
- TanStack Start + React + Tailwind v4
- Lovable Cloud (Supabase) para datos y auth
- shadcn/ui, dnd-kit (drag & drop), date-fns, xlsx (export)

## Modelo de datos

**washers** (lavadores)
- id, name, active, created_at

**bookings** (lavados)
- id, washer_id (fk), wash_type (enum), plate, client, observations
- start_at, end_at (calculados según tipo)
- status: programado | en_proceso | completado | cancelado
- created_by, created_at

**Tipos y duraciones** (constantes en frontend):
- exterior: 40 min
- interior_3: 225 min (3h + 45min ext)
- interior_4: 285 min
- interior_5: 345 min
- interior_6: 345 min

RLS: usuarios autenticados leen/escriben; roles vía tabla `user_roles` (admin/operador).

## Pantallas

1. **Auth** — login/registro email+password
2. **Agenda** (`/`) — vista principal tipo taller
   - Toggle Día / Semana / Mes
   - Eje Y = lavadores, eje X = horas (vista día/semana)
   - Bloques arrastrables, redimensionables fijos por tipo
   - Click bloque → editar / cambiar estado
   - Botón "+ Nuevo lavado" → modal con tipo, patente, cliente, lavador, fecha/hora, observaciones
   - Validación traslape antes de guardar (server-side via server fn)
3. **Dashboard** (`/dashboard`)
   - % utilización diaria por lavador
   - Horas disponibles hoy
   - Conteo por estado
   - Lavados de la semana (gráfico)
4. **Historial** (`/historial`)
   - Tabla filtrable (rango fecha, lavador, patente, cliente, estado)
   - Botón "Exportar Excel"
5. **Lavadores** (`/lavadores`) — CRUD simple

## Lógica clave

- `computeEndAt(start, type)` calcula `end_at`
- Server fn `createBooking` valida traslape con `EXISTS` por washer_id e intervalo
- Drag & drop: al soltar, calcula nuevo start, llama `updateBooking` con re-validación
- Estados con colores: azul/amarillo/verde/gris

## Diseño

ERP industrial: fondo oscuro slate, acentos ámbar/cian, tipografía Inter, densidad alta, badges por estado, grid con líneas finas.

## Pasos de implementación

1. Enable Lovable Cloud
2. Migración: tablas + RLS + grants + roles
3. Design system en `src/styles.css` (tema industrial oscuro)
4. Layout con sidebar de navegación
5. Página Auth
6. Página Agenda con vista día (prioritaria) + semana + mes
7. Modal nuevo/editar lavado con validación
8. Drag & drop con dnd-kit
9. Dashboard
10. Historial + exportación Excel
11. CRUD lavadores
12. Responsive (sidebar colapsable en móvil, agenda scroll horizontal)
