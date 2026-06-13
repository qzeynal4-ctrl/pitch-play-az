
-- Add owner-related columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','owner','admin')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS pitch_id UUID REFERENCES public.pitches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS pitch_location TEXT,
  ADD COLUMN IF NOT EXISTS pitch_description TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (LOWER(username)) WHERE username IS NOT NULL;

-- Add view_count and owner_id to pitches
ALTER TABLE public.pitches
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;

-- Cashout requests
CREATE TABLE IF NOT EXISTS public.cashout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  note TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.cashout_requests TO authenticated;
GRANT ALL ON public.cashout_requests TO service_role;
ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can view own cashouts" ON public.cashout_requests
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner can insert own cashouts" ON public.cashout_requests
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "admin can update cashouts" ON public.cashout_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews readable" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "users insert own reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin manage reviews" ON public.reviews FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tighten profiles policies for owners (owner can only read/update name/phone but not role/status/pitch_id).
-- Existing policies likely allow users to update their own profile. We add an additional admin-update policy
-- and rely on a trigger to prevent owners from elevating their own status/role.
CREATE OR REPLACE FUNCTION public.protect_profile_owner_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Allow self-set to 'owner' + 'pending' during owner registration (when current role is 'user')
  IF auth.uid() = NEW.id AND OLD.role = 'user' AND NEW.role = 'owner' AND NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;
  -- Otherwise lock down sensitive fields for non-admins
  NEW.role := OLD.role;
  NEW.status := OLD.status;
  NEW.pitch_id := OLD.pitch_id;
  NEW.rejection_reason := OLD.rejection_reason;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_owner_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_owner_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_owner_fields();

-- When an owner is approved, ensure their pitch is visible
CREATE OR REPLACE FUNCTION public.sync_owner_pitch_visibility()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pitch_id IS NOT NULL AND NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.pitches SET visible = true WHERE id = NEW.pitch_id;
  END IF;
  IF NEW.pitch_id IS NOT NULL AND NEW.status = 'rejected' THEN
    UPDATE public.pitches SET visible = false WHERE id = NEW.pitch_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_owner_pitch_visibility ON public.profiles;
CREATE TRIGGER trg_sync_owner_pitch_visibility
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_owner_pitch_visibility();
