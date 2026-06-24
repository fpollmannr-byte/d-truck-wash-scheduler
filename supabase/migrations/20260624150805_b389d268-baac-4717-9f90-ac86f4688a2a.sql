
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'jefe';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lider';

ALTER TYPE public.wash_status ADD VALUE IF NOT EXISTS 'en_espera';
ALTER TYPE public.wash_status ADD VALUE IF NOT EXISTS 'en_lavado_interior';
ALTER TYPE public.wash_status ADD VALUE IF NOT EXISTS 'en_lavado_exterior';
ALTER TYPE public.wash_status ADD VALUE IF NOT EXISTS 'control_calidad';
ALTER TYPE public.wash_status ADD VALUE IF NOT EXISTS 'finalizado';
ALTER TYPE public.wash_status ADD VALUE IF NOT EXISTS 'entregado';
