import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  reservation_date: string;
  start_hour: number;
  end_hour: number;
  total_cost: number;
  amount_paid: number;
  payment_percentage: number;
  status: string;
  pitches: { name: string; location: string; photo_url: string | null } | null;
};

export const Route = createFileRoute("/my-reservations")({ component: MyReservations });

function MyReservations() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("reservations")
      .select("id,reservation_date,start_hour,end_hour,total_cost,amount_paid,payment_percentage,status,pitches(name,location,photo_url)")
      .eq("user_id", user.id)
      .order("reservation_date", { ascending: false });
    setRows((data as unknown as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const cancel = async (id: string) => {
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("cancelled"));
    load();
  };

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-muted-foreground">{t("loginRequired")}</p>
            <Link to="/login"><Button>{t("login")}</Button></Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">
        <h1 className="mb-6 text-2xl font-bold">{t("myReservations")}</h1>
        {loading ? (
          <p className="text-muted-foreground">…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{t("noReservations")}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="flex gap-4 rounded-xl border bg-card p-4 shadow-sm">
                {r.pitches?.photo_url && (
                  <img src={r.pitches.photo_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.pitches?.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />{r.pitches?.location}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "confirmed" ? "bg-success/15 text-success" :
                      r.status === "cancelled" ? "bg-destructive/15 text-destructive" :
                      "bg-warning/15 text-warning-foreground"
                    }`}>{t(r.status as "confirmed" | "cancelled" | "pending")}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{r.reservation_date}</span>
                    <span>{String(r.start_hour).padStart(2,"0")}:00 – {String(r.end_hour).padStart(2,"0")}:00</span>
                    <span className="font-medium text-primary">{r.amount_paid} / {r.total_cost} AZN ({r.payment_percentage}%)</span>
                  </div>
                </div>
                {r.status !== "cancelled" && (
                  <Button variant="ghost" size="icon" onClick={() => cancel(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
