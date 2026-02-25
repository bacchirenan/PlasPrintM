ALTER TABLE public.ink_withdrawals
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consumption_per_day_ml NUMERIC;
