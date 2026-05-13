import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { PitchMap } from "@/components/PitchMap";
import { PitchSidebar } from "@/components/PitchSidebar";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type Pitch = {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  price_per_hour: number;
  photo_url: string | null;
  description: string | null;
};

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { t } = useI18n();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [selected, setSelected] = useState<Pitch | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await supabase.from("pitches").select("*").order("name");
    setPitches((data as Pitch[]) || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => pitches.filter((p) => `${p.name} ${p.location}`.toLowerCase().includes(q.toLowerCase())),
    [pitches, q]
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="relative flex-1">
        <div className="absolute inset-0">
          <PitchMap pitches={filtered} onSelect={setSelected} selectedId={selected?.id} />
        </div>

        {/* Search bar */}
        <div className="pointer-events-none absolute left-1/2 top-4 z-[999] w-full max-w-md -translate-x-1/2 px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("findPitches")}
              className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Pitch list (mobile/desktop bottom strip) when nothing selected */}
        {!selected && (
          <div className="absolute bottom-4 left-4 right-4 z-[900] flex gap-3 overflow-x-auto pb-2 md:right-auto md:max-w-md">
            {filtered.slice(0, 6).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="flex w-56 shrink-0 gap-3 rounded-xl border bg-card p-2 text-left shadow-md transition hover:shadow-xl"
              >
                {p.photo_url && (
                  <img src={p.photo_url} alt={p.name} className="h-14 w-14 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.location}</div>
                  <div className="text-xs font-bold text-primary">{p.price_per_hour} AZN/h</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <PitchSidebar pitch={selected} onClose={() => setSelected(null)} />
      </main>
    </div>
  );
}
