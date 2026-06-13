import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign, Calendar as CalIcon, Star, Eye, Wallet, Clock } from "lucide-react";

export const Route = createFileRoute("/owner/dashboard/$username")({ component: OwnerDashboard });

type Profile = {
  id: string; name: string; email: string; username: string | null; role: string; status: string;
  business_name: string | null; pitch_id: string | null;
};
type Pitch = { id: string; name: string; view_count: number; price_per_hour: number };
type Resv = { id: string; pitch_id: string; user_name: string; reservation_date: string; start_hour: number; end_hour: number; amount_paid: number; total_cost: number; status: string };
type Review = { id: string; user_name: string; rating: number; comment: string | null; created_at: string };
type Cashout = { id: string; amount: number; status: string; note: string | null; created_at: string };

function OwnerDashboard() {
  const { username } = Route.useParams();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [resvs, setResvs] = useState<Resv[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cashouts, setCashouts] = useState<Cashout[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // Load owner profile & guard access
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/" }); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles").select("*").ilike("username", username).maybeSingle();
      const p = data as Profile | null;
      if (!p) { navigate({ to: "/" }); return; }
      // Access: must be admin OR the owner himself
      if (!isAdmin && p.id !== user.id) {
        // Owners are sent to their own dashboard
        const { data: mine } = await supabase.from("profiles").select("username,role").eq("id", user.id).maybeSingle();
        const me = mine as { username?: string; role?: string } | null;
        if (me?.role === "owner" && me.username) {
          navigate({ to: "/owner/dashboard/$username", params: { username: me.username } });
        } else navigate({ to: "/" });
        return;
      }
      setProfile(p);
      // Admins skip password gate
      if (isAdmin || p.id !== user.id) setUnlocked(true);
    })();
  }, [loading, user, isAdmin, username, navigate]);

  const loadAll = async (pid: string | null, ownerId: string) => {
    const [pitchRes, rRes, revRes, cRes] = await Promise.all([
      pid ? supabase.from("pitches").select("id,name,view_count,price_per_hour").eq("id", pid).maybeSingle() : Promise.resolve({ data: null }),
      pid ? supabase.from("reservations").select("*").eq("pitch_id", pid).order("reservation_date", { ascending: false }) : Promise.resolve({ data: [] }),
      pid ? supabase.from("reviews").select("*").eq("pitch_id", pid).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      supabase.from("cashout_requests").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }),
    ]);
    setPitch((pitchRes.data as Pitch) || null);
    setResvs((rRes.data as Resv[]) || []);
    setReviews((revRes.data as Review[]) || []);
    setCashouts((cRes.data as Cashout[]) || []);
  };

  useEffect(() => {
    if (profile && unlocked) loadAll(profile.pitch_id, profile.id);
  }, [profile, unlocked]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: profile.email, password });
    setBusy(false);
    if (error) return toast.error("Yanlış parol");
    setUnlocked(true);
  };

  const totalEarnings = useMemo(() =>
    resvs.filter(r => r.status !== "cancelled").reduce((s, r) => s + Number(r.amount_paid) * 0.9, 0),
  [resvs]);
  const monthStart = new Date(); monthStart.setDate(1);
  const monthEarnings = useMemo(() =>
    resvs.filter(r => r.status !== "cancelled" && new Date(r.reservation_date) >= monthStart)
         .reduce((s, r) => s + Number(r.amount_paid) * 0.9, 0),
  [resvs]);
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const paidOut = cashouts.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
  const pendingOut = cashouts.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
  const available = totalEarnings - paidOut - pendingOut;

  const requestCashout = async () => {
    if (!profile) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Məbləğ daxil edin");
    if (amt > available) return toast.error("Balans kifayət deyil");
    const { error } = await supabase.from("cashout_requests").insert({
      owner_id: profile.id, amount: amt, note: note || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Cashout sorğusu göndərildi");
    setAmount(""); setNote("");
    loadAll(profile.pitch_id, profile.id);
  };

  if (loading || !profile) return null;

  if (profile.status === "pending") {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl">
            <Clock className="mx-auto mb-3 h-10 w-10 text-warning" />
            <h2 className="text-xl font-bold">Waiting for admin approval</h2>
            <p className="mt-2 text-sm text-muted-foreground">Müraciətiniz baxılır.</p>
          </div>
        </main>
      </div>
    );
  }

  if (profile.status === "rejected") {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl">
            <h2 className="text-xl font-bold text-destructive">Müraciət rədd edildi</h2>
          </div>
        </main>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center p-4">
          <form onSubmit={verify} className="w-full max-w-sm space-y-3 rounded-2xl border bg-card p-6 shadow-xl">
            <h1 className="text-xl font-bold">{profile.business_name || profile.name}</h1>
            <p className="text-sm text-muted-foreground">Parolunuzu daxil edin</p>
            <div className="space-y-1"><Label>Parol</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>Giriş</Button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{profile.business_name || profile.name}</h1>
          <p className="text-muted-foreground">@{profile.username}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={DollarSign} label="Ümumi qazanc" value={`${totalEarnings.toFixed(2)} AZN`} color="bg-success" />
          <StatCard icon={DollarSign} label="Bu ay" value={`${monthEarnings.toFixed(2)} AZN`} color="bg-primary" />
          <StatCard icon={CalIcon} label="Rezervlər" value={resvs.length} color="bg-warning" />
          <StatCard icon={Eye} label="Baxış" value={pitch?.view_count ?? 0} color="bg-accent-foreground" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Cashout */}
          <div className="rounded-xl border bg-card p-4 lg:col-span-1">
            <h3 className="mb-2 flex items-center gap-2 font-bold"><Wallet className="h-4 w-4" />Cashout</h3>
            <div className="rounded-lg bg-gradient-to-br from-primary to-primary/70 p-4 text-primary-foreground">
              <div className="text-xs opacity-80">Mövcud balans</div>
              <div className="text-2xl font-bold">{available.toFixed(2)} AZN</div>
            </div>
            <div className="mt-3 space-y-2">
              <Input type="number" placeholder="Məbləğ" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input placeholder="Qeyd (ixtiyari)" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button onClick={requestCashout} className="w-full">Cashout sorğusu</Button>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              {cashouts.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded border p-2">
                  <span>{Number(c.amount).toFixed(2)} AZN</span>
                  <span className={`text-xs ${c.status === "paid" ? "text-success" : c.status === "rejected" ? "text-destructive" : "text-warning"}`}>{c.status}</span>
                </div>
              ))}
              {!cashouts.length && <p className="text-xs text-muted-foreground">Hələ sorğu yoxdur.</p>}
            </div>
          </div>

          {/* Reservations Calendar */}
          <div className="rounded-xl border bg-card p-4 lg:col-span-2">
            <h3 className="mb-2 flex items-center gap-2 font-bold"><CalIcon className="h-4 w-4" />Rezerv Təqvimi</h3>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs">
                  <tr><th className="p-2">Tarix</th><th className="p-2">Saat</th><th className="p-2">İstifadəçi</th><th className="p-2">Status</th><th className="p-2 text-right">Məbləğ</th></tr>
                </thead>
                <tbody>
                  {resvs.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{r.reservation_date}</td>
                      <td className="p-2">{String(r.start_hour).padStart(2,"0")}:00–{String(r.end_hour).padStart(2,"0")}:00</td>
                      <td className="p-2">{r.user_name}</td>
                      <td className="p-2"><span className={`rounded px-2 py-0.5 text-xs ${r.status === "cancelled" ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>{r.status}</span></td>
                      <td className="p-2 text-right font-medium">{r.amount_paid} AZN</td>
                    </tr>
                  ))}
                  {!resvs.length && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Rezerv yoxdur</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reviews */}
          <div className="rounded-xl border bg-card p-4 lg:col-span-3">
            <h3 className="mb-2 flex items-center gap-2 font-bold">
              <Star className="h-4 w-4 fill-warning text-warning" /> Reytinq və rəylər
              <span className="ml-auto text-lg">{avgRating.toFixed(1)} / 5</span>
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              {reviews.map(r => (
                <div key={r.id} className="rounded border p-3">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{r.user_name}</span>
                    <span className="text-warning">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
                </div>
              ))}
              {!reviews.length && <p className="text-sm text-muted-foreground">Hələ rəy yoxdur.</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}
