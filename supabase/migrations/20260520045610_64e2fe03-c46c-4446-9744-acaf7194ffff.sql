-- Admin balance ledger: every entry is +ledger from a reservation (10% of paid amount) or -ledger from a withdrawal.
CREATE TABLE public.admin_balance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('commission','withdrawal','adjustment')),
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_balance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read balance entries" ON public.admin_balance_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write balance entries" ON public.admin_balance_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: when reservation is inserted (and not cancelled) credit 10% of amount_paid
CREATE OR REPLACE FUNCTION public.credit_admin_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'cancelled' AND NEW.amount_paid > 0 THEN
    INSERT INTO public.admin_balance_entries (amount, kind, reservation_id, note)
    VALUES (ROUND((NEW.amount_paid * 0.10)::numeric, 2), 'commission', NEW.id, '10% komissiya');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservation_commission
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.credit_admin_commission();

-- Trigger: when reservation is cancelled (status changes to cancelled), reverse commission
CREATE OR REPLACE FUNCTION public.reverse_admin_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO public.admin_balance_entries (amount, kind, reservation_id, note)
    VALUES (-ROUND((OLD.amount_paid * 0.10)::numeric, 2), 'adjustment', OLD.id, 'Rezerv ləğv edildi');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservation_commission_reverse
AFTER UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.reverse_admin_commission();
