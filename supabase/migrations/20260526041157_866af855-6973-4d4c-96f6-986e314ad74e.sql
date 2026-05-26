
ALTER TABLE public.pitches
  ADD COLUMN IF NOT EXISTS manager_name text NOT NULL DEFAULT 'Stadion Meneceri',
  ADD COLUMN IF NOT EXISTS manager_phone text NOT NULL DEFAULT '+994 50 000 00 00';

-- Allow demo / guest reservations so the public demo flow can complete without auth.
-- (Demo mode: admin panel is also open without auth.)
DROP POLICY IF EXISTS "Users insert own reservations" ON public.reservations;
CREATE POLICY "Anyone insert reservations"
  ON public.reservations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Seed varied manager contacts for existing pitches
UPDATE public.pitches SET
  manager_name = (ARRAY['Elvin Məmmədov','Rəşad Quliyev','Tural Hüseynov','Nicat Əliyev','Kamran Babayev','Vüsal Cəfərov','Orxan Səfərli','Ramil İsmayılov'])[1 + (abs(hashtext(id::text)) % 8)],
  manager_phone = '+994 ' || (ARRAY['50','51','55','70','77','99'])[1 + (abs(hashtext(id::text)) % 6)] || ' ' ||
                  lpad((abs(hashtext(id::text || 'a')) % 1000)::text, 3, '0') || ' ' ||
                  lpad((abs(hashtext(id::text || 'b')) % 100)::text, 2, '0') || ' ' ||
                  lpad((abs(hashtext(id::text || 'c')) % 100)::text, 2, '0')
WHERE manager_phone = '+994 50 000 00 00';
