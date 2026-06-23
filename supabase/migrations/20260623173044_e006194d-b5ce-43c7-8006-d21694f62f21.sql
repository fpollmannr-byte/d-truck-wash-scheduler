
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operador');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'operador',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto asignar rol operador al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operador')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tipo de lavado
CREATE TYPE public.wash_type AS ENUM ('exterior','interior_3','interior_4','interior_5','interior_6');
CREATE TYPE public.wash_status AS ENUM ('programado','en_proceso','completado','cancelado');

-- Lavadores
CREATE TABLE public.washers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.washers TO authenticated;
GRANT ALL ON public.washers TO service_role;
ALTER TABLE public.washers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read washers" ON public.washers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage washers" ON public.washers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lavados (bookings)
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  washer_id uuid NOT NULL REFERENCES public.washers(id) ON DELETE RESTRICT,
  wash_type public.wash_type NOT NULL,
  plate text NOT NULL,
  client text,
  observations text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status public.wash_status NOT NULL DEFAULT 'programado',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_at > start_at)
);
CREATE INDEX bookings_washer_time_idx ON public.bookings (washer_id, start_at, end_at);
CREATE INDEX bookings_start_idx ON public.bookings (start_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read bookings" ON public.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update bookings" ON public.bookings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete bookings" ON public.bookings FOR DELETE TO authenticated USING (true);

-- Validar solapamiento
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.washer_id = NEW.washer_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status <> 'cancelado'
      AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'El lavador ya tiene un trabajo programado en ese horario';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER bookings_overlap_check
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.check_booking_overlap();

-- Lavadores demo
INSERT INTO public.washers (name) VALUES ('Lavador 1'), ('Lavador 2'), ('Lavador 3');
