-- ============================================================
-- DTS Planner Pro: Bahías + Operadores + Hermeticidad + Vista pública
-- ============================================================

-- 1) Limpiar triggers/datos del modelo Equipos+Pistas
DROP TRIGGER IF EXISTS trg_bookings_overlap ON public.bookings;
DROP TRIGGER IF EXISTS trg_lane_overlap ON public.booking_lanes;
DROP FUNCTION IF EXISTS public.check_booking_overlap() CASCADE;
DROP FUNCTION IF EXISTS public.check_lane_overlap() CASCADE;

-- Eliminar dependencias de teams/lanes en bookings
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_team_id_fkey;
DROP TABLE IF EXISTS public.booking_lanes CASCADE;

-- 2) Crear tabla de Bahías (reemplaza teams y lanes)
CREATE TABLE IF NOT EXISTS public.bays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bays TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bays TO authenticated;
GRANT ALL ON public.bays TO service_role;
ALTER TABLE public.bays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bays readable by all" ON public.bays FOR SELECT USING (true);
CREATE POLICY "bays managed by managers" ON public.bays FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','jefe']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','jefe']::app_role[]));

INSERT INTO public.bays (name) VALUES ('Bahía 1'),('Bahía 2'),('Bahía 3'),('Bahía 4')
ON CONFLICT (name) DO NOTHING;

-- 3) Operadores (7 operadores + 1 supervisor)
CREATE TABLE IF NOT EXISTS public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_supervisor boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators readable by auth" ON public.operators FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators managed by managers" ON public.operators FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','jefe']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','jefe']::app_role[]));

INSERT INTO public.operators (name, is_supervisor) VALUES
  ('Operador 1', false),('Operador 2', false),('Operador 3', false),
  ('Operador 4', false),('Operador 5', false),('Operador 6', false),
  ('Operador 7', false),('Supervisor', true);

-- 4) Eliminar teams (ya no se usa) y agregar hermeticidad al enum
DROP TABLE IF EXISTS public.teams CASCADE;
ALTER TYPE public.wash_type ADD VALUE IF NOT EXISTS 'hermeticidad';

-- 5) Bookings: reemplazar team_id por bay_id y agregar campos
ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS team_id,
  ADD COLUMN IF NOT EXISTS bay_id uuid REFERENCES public.bays(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS operators_needed integer NOT NULL DEFAULT 3 CHECK (operators_needed BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS is_public_request boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected'));

-- Como cambiamos un campo NOT NULL, limpiamos bookings huérfanos (si los hay) para que bay_id pueda ser NOT NULL
DELETE FROM public.bookings WHERE bay_id IS NULL;
ALTER TABLE public.bookings ALTER COLUMN bay_id SET NOT NULL;

-- 6) Trigger de capacidad: bahía libre + operadores suficientes
CREATE OR REPLACE FUNCTION public.check_booking_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  available_ops int;
  used_ops int;
BEGIN
  IF NEW.status = 'cancelado' OR NEW.approval_status = 'rejected' THEN
    NEW.updated_at = now();
    RETURN NEW;
  END IF;

  -- Bahía ocupada por otro booking activo
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.bay_id = NEW.bay_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status <> 'cancelado'
      AND b.approval_status <> 'rejected'
      AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'La bahía ya está ocupada en ese horario';
  END IF;

  -- Operadores activos (no supervisor)
  SELECT count(*) INTO available_ops FROM public.operators
  WHERE active = true AND is_supervisor = false;

  -- Operadores ya comprometidos en el rango
  SELECT COALESCE(sum(operators_needed),0) INTO used_ops
  FROM public.bookings b
  WHERE b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND b.status <> 'cancelado'
    AND b.approval_status <> 'rejected'
    AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)');

  IF used_ops + NEW.operators_needed > available_ops THEN
    RAISE EXCEPTION 'Sin personal disponible: faltan operadores (% de % en uso, se requieren %)',
      used_ops, available_ops, NEW.operators_needed;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bookings_capacity
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.check_booking_capacity();

-- 7) RLS de bookings: el público NO debe ver clientes/patentes.
-- Las policies existentes seguirán vigentes para authenticated.
-- Para anon: solo acceso vía RPCs SECURITY DEFINER.

REVOKE ALL ON public.bookings FROM anon;

-- Vista pública (slots ocupados, sin PII)
CREATE OR REPLACE FUNCTION public.get_public_schedule(date_from date, date_to date)
RETURNS TABLE (id uuid, bay_id uuid, bay_name text, start_at timestamptz, end_at timestamptz, status wash_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.bay_id, ba.name, b.start_at, b.end_at, b.status
  FROM public.bookings b
  JOIN public.bays ba ON ba.id = b.bay_id
  WHERE b.status <> 'cancelado'
    AND b.approval_status <> 'rejected'
    AND b.start_at::date >= date_from
    AND b.start_at::date <= date_to;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_schedule(date, date) TO anon, authenticated;

-- Creación de reserva pública (queda pendiente de aprobación)
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_bay_id uuid,
  p_wash_type wash_type,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_plate text,
  p_contact_name text,
  p_contact_phone text,
  p_observations text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF p_plate IS NULL OR length(trim(p_plate)) < 4 THEN
    RAISE EXCEPTION 'Patente inválida';
  END IF;
  IF p_contact_name IS NULL OR length(trim(p_contact_name)) < 2 THEN
    RAISE EXCEPTION 'Nombre de contacto requerido';
  END IF;

  INSERT INTO public.bookings (
    bay_id, wash_type, start_at, end_at, plate,
    contact_name, contact_phone, observations,
    is_public_request, approval_status, status, operators_needed
  ) VALUES (
    p_bay_id, p_wash_type, p_start_at, p_end_at, upper(trim(p_plate)),
    trim(p_contact_name), trim(p_contact_phone), p_observations,
    true, 'pending', 'programado',
    CASE WHEN p_wash_type = 'exterior' THEN 3
         WHEN p_wash_type = 'hermeticidad' THEN 3
         ELSE 3 END
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_public_booking(uuid, wash_type, timestamptz, timestamptz, text, text, text, text) TO anon, authenticated;

-- 8) Eliminar policy anon de lanes (ya no existe), y quitar enum-related tarjetas no usadas
-- (Las tablas shifts y user_roles se mantienen igual)