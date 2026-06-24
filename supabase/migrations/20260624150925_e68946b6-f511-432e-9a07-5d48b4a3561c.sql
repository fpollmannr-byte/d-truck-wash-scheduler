
-- teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin jefe insert teams" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'));
CREATE POLICY "admin jefe update teams" ON public.teams FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'));
CREATE POLICY "admin jefe delete teams" ON public.teams FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'));

-- lanes
CREATE TABLE public.lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lanes TO authenticated;
GRANT ALL ON public.lanes TO service_role;
ALTER TABLE public.lanes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read lanes" ON public.lanes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin jefe insert lanes" ON public.lanes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'));
CREATE POLICY "admin jefe update lanes" ON public.lanes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'));
CREATE POLICY "admin jefe delete lanes" ON public.lanes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'));

-- shifts
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_start time,
  break_end time,
  headcount int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read shifts" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin jefe insert shifts" ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'));
CREATE POLICY "admin jefe update shifts" ON public.shifts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'));
CREATE POLICY "admin jefe delete shifts" ON public.shifts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'jefe'));

-- Quitar trigger viejo + función con CASCADE
DROP FUNCTION IF EXISTS public.check_booking_overlap() CASCADE;

-- Refactor bookings
TRUNCATE TABLE public.bookings;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_washer_id_fkey;
ALTER TABLE public.bookings DROP COLUMN washer_id;
ALTER TABLE public.bookings ADD COLUMN team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT;
CREATE INDEX bookings_team_id_start_at_idx ON public.bookings(team_id, start_at);
CREATE INDEX bookings_start_at_idx ON public.bookings(start_at);

DROP TABLE IF EXISTS public.washers CASCADE;

-- booking_lanes
CREATE TABLE public.booking_lanes (
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  lane_id    uuid NOT NULL REFERENCES public.lanes(id)    ON DELETE RESTRICT,
  PRIMARY KEY (booking_id, lane_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_lanes TO authenticated;
GRANT ALL ON public.booking_lanes TO service_role;
ALTER TABLE public.booking_lanes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read booking_lanes" ON public.booking_lanes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert booking_lanes" ON public.booking_lanes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update booking_lanes" ON public.booking_lanes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete booking_lanes" ON public.booking_lanes FOR DELETE TO authenticated USING (true);
CREATE INDEX booking_lanes_lane_id_idx ON public.booking_lanes(lane_id);

-- Seeds
INSERT INTO public.teams (name) VALUES ('Equipo A'), ('Equipo B');
INSERT INTO public.lanes (name) VALUES ('Pista 1'), ('Pista 2'), ('Pista 3'), ('Pista 4');
INSERT INTO public.shifts (name, start_time, end_time, break_start, break_end, headcount)
VALUES
  ('Turno A', '08:00', '20:00', '14:00', '15:00', 6),
  ('Turno B', '11:00', '20:00', '15:00', '16:00', 2);

-- Trigger nuevo de solape para equipos + máx 2 simultáneos
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  concurrent int;
BEGIN
  IF NEW.status = 'cancelado' THEN
    NEW.updated_at = now();
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.team_id = NEW.team_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status <> 'cancelado'
      AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'El equipo ya tiene un trabajo programado en ese horario';
  END IF;

  SELECT count(*) INTO concurrent
  FROM public.bookings b
  WHERE b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND b.status <> 'cancelado'
    AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)');
  IF concurrent >= 2 THEN
    RAISE EXCEPTION 'Capacidad máxima alcanzada: solo 2 lavados simultáneos';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_check_overlap
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.check_booking_overlap();

-- Trigger solape de pistas
CREATE OR REPLACE FUNCTION public.check_lane_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_start timestamptz;
  new_end   timestamptz;
  new_status public.wash_status;
BEGIN
  SELECT start_at, end_at, status INTO new_start, new_end, new_status
  FROM public.bookings WHERE id = NEW.booking_id;

  IF new_status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_lanes bl
    JOIN public.bookings b ON b.id = bl.booking_id
    WHERE bl.lane_id = NEW.lane_id
      AND bl.booking_id <> NEW.booking_id
      AND b.status <> 'cancelado'
      AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(new_start, new_end, '[)')
  ) THEN
    RAISE EXCEPTION 'La pista ya está ocupada en ese horario';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER booking_lanes_check_overlap
BEFORE INSERT OR UPDATE ON public.booking_lanes
FOR EACH ROW EXECUTE FUNCTION public.check_lane_overlap();

-- has_any_role helper
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;
