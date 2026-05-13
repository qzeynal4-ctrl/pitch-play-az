import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ClientPitchMap } from "@/components/ClientPitchMap";
import { PitchSidebar } from "@/components/PitchSidebar";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Search, List, X, MapPin } from "lucide-react";

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
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("pitches").select("*").order("name");
    setPitches((data as Pitch[]) || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () =>
      q.trim()
        ? pitches.filter((p) => `${p.name} ${p.location}`.toLowerCase().includes(q.toLowerCase()))
        : pitches,
    [pitches, q]
  );

  const pickPitch = (p: Pitch) => {
    setSelected(p);
    setShowSearchResults(false);
    setListOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="relative flex-1">
        <div className="absolute inset-0">
          <ClientPitchMap pitches={pitches} onSelect={setSelected} selectedId={selected?.id} />
        </div>

        {/* Left toggle button to open pitch list */}
        <button
          onClick={() => setListOpen((v) => !v)}
          className="absolute left-4 top-4 z-[999] flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-sm font-medium shadow-lg backdrop-blur hover:bg-background"
        >
          {listOpen ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
          <span className="hidden sm:inline">{t("pitchList")}</span>
        </button>

        {/* Search bar with live dropdown */}
        <div className="absolute left-1/2 top-4 z-[999] w-full max-w-md -translate-x-1/2 px-4 sm:left-auto sm:right-4 sm:translate-x-0">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => { setQ(e.target.value); setShowSearchResults(true); }}
                onFocus={() => setShowSearchResults(true)}
                placeholder={t("findPitches")}
                className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              {q && (
                <button onClick={() => { setQ(""); setShowSearchResults(false); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {showSearchResults && q.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto rounded-xl border bg-background shadow-2xl">
                {filtered.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">{t("noResults")}</div>
                ) : (
                  filtered.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickPitch(p)}
                      className="flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-0 hover:bg-accent"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{highlight(p.name, q)}</div>
                        <div className="truncate text-xs text-muted-foreground">{p.location}</div>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-primary">{p.price_per_hour} AZN/h</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Left slide-in pitch list */}
        {listOpen && (
          <aside className="absolute left-0 top-16 z-[950] flex h-[calc(100%-4rem)] w-72 flex-col overflow-hidden rounded-r-2xl border-r bg-card/95 shadow-2xl backdrop-blur">
            <div className="border-b p-3 text-sm font-semibold">{t("pitchList")} ({pitches.length})</div>
            <div className="flex-1 overflow-y-auto p-2">
              {pitches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickPitch(p)}
                  className={`mb-2 flex w-full gap-3 rounded-xl border bg-card p-2 text-left transition hover:shadow-md ${
                    selected?.id === p.id ? "border-primary ring-2 ring-primary/30" : ""
                  }`}
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
          </aside>
        )}

        <PitchSidebar pitch={selected} onClose={() => setSelected(null)} />
      </main>
    </div>
  );
}

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-primary/20 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
