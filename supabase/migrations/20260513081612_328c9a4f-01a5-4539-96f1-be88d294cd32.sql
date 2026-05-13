
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  surname TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Pitches
CREATE TABLE public.pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  price_per_hour NUMERIC NOT NULL,
  photo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view pitches" ON public.pitches FOR SELECT USING (true);
CREATE POLICY "Admins manage pitches" ON public.pitches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reservations
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  start_hour INT NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour INT NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  total_cost NUMERIC NOT NULL,
  payment_percentage INT NOT NULL DEFAULT 40 CHECK (payment_percentage BETWEEN 40 AND 100),
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  user_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pitch_id, reservation_date, start_hour)
);
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view reservations" ON public.reservations FOR SELECT USING (true);
CREATE POLICY "Users insert own reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reservations" ON public.reservations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reservations" ON public.reservations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage reservations" ON public.reservations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, surname, email, phone, last_login)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'surname', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    now()
  );

  IF NEW.email = 'izzetqasimov2007@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sample pitches in Baku
INSERT INTO public.pitches (name, location, latitude, longitude, price_per_hour, photo_url, description) VALUES
('Neftchi Arena', 'Nizami rayonu, Bakı', 40.4093, 49.8671, 60, 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800', 'Premium artificial turf, lighting included'),
('Bakı Olympic Pitch', 'Olimpiya Stadionu yaxınlığı', 40.4302, 49.9197, 80, 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800', 'Full-size pitch with locker rooms'),
('Yasamal Football Club', 'Yasamal rayonu', 40.3897, 49.8200, 45, 'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800', 'Indoor & outdoor options'),
('Sahil Stadium', 'Sahil parkı yaxınlığı', 40.3612, 49.8398, 50, 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800', 'Sea view, great atmosphere'),
('Narimanov Pitch', 'Narimanov rayonu', 40.4015, 49.8453, 35, 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800', 'Affordable neighbourhood pitch'),
('Khatai Sport Center', 'Xətai rayonu', 40.3854, 49.9056, 55, 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800', 'Modern facility with parking');
