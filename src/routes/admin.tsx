import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarCheck, Users, DollarSign, Plus, Trash2, Pencil, Wallet, TrendingUp, BarChart3, Eye, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ClientOnly } from "@/components/ClientOnly";
import { lazy, Suspense } from "react";

const PitchPickerMap = lazy(() => import("@/components/PitchPickerMap").then(m => ({ default: m.PitchPickerMap })));

export const Route = createFileRoute("/admin")({ component: Admin });

type Profile = { id: string; name: string; surname: string; email: string; phone: string; created_at: string; last_login: string | null; role?: string; status?: string; username?: string | null; business_name?: string | null; pitch_id?: string | null; rejection_reason?: string | null; pitch_location?: string | null; pitch_description?: string | null };
type Pitch = { id: string; name: string; location: string; latitude: number; longitude: number; price_per_hour: number; photo_url: string | null; description: string | null; manager_name?: string; manager_phone?: string };
type Resv = { id: string; pitch_id: string; user_id: string; reservation_date: string; start_hour: number; end_hour: number; total_cost: number; amount_paid: number; payment_percentage: number; status: string; user_name: string; pitches: { name: string } | null };
type Entry = { id: string; amount: number; kind: string; note: string | null; created_at: string; reservation_id: string | null };
type Cashout = { id: string; owner_id: string; amount: number; status: string; note: string | null; admin_note: string | null; created_at: string };


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

function Admin() {
  const { t } = useI18n();
  const [users, setUsers] = useState<Profile[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [resvs, setResvs] = useState<Resv[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cashouts, setCashouts] = useState<Cashout[]>([]);
  const [search, setSearch] = useState("");
  const [editingPitch, setEditingPitch] = useState<Partial<Pitch> | null>(null);
  const [editingResv, setEditingResv] = useState<Resv | null>(null);
  const [viewUser, setViewUser] = useState<Profile | null>(null);
  const [viewOwner, setViewOwner] = useState<Profile | null>(null);
  const [rejectingOwner, setRejectingOwner] = useState<Profile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");

  const load = async () => {
    const [{ data: u }, { data: p }, { data: r }, { data: e }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("pitches").select("*").order("name"),
      supabase.from("reservations").select("*,pitches(name)").order("created_at", { ascending: false }),
      supabase.from("admin_balance_entries").select("*").order("created_at", { ascending: false }),
    ]);
    setUsers((u as Profile[]) || []);
    setPitches((p as Pitch[]) || []);
    setResvs((r as unknown as Resv[]) || []);
    setEntries((e as Entry[]) || []);
  };

  useEffect(() => {
    load();
    // Real-time refresh: any insert/update on reservations or balance entries refetches.
    const ch = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_balance_entries" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "pitches" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const activeResvs = useMemo(() => resvs.filter((r) => r.status !== "cancelled"), [resvs]);
  const todayResvs = activeResvs.filter((r) => r.reservation_date === today);
  const totalRevenue = activeResvs.reduce((s, r) => s + Number(r.amount_paid), 0);
  const todayRevenue = todayResvs.reduce((s, r) => s + Number(r.amount_paid), 0);
  const pendingPay = activeResvs.reduce((s, r) => s + (Number(r.total_cost) - Number(r.amount_paid)), 0);
  const balance = entries.reduce((s, e) => s + Number(e.amount), 0);

  // Per-pitch aggregation
  const perPitch = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    pitches.forEach((p) => map.set(p.id, { name: p.name, count: 0, revenue: 0 }));
    activeResvs.forEach((r) => {
      const e = map.get(r.pitch_id);
      if (e) { e.count++; e.revenue += Number(r.amount_paid); }
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [pitches, activeResvs]);



  const filteredUsers = users.filter(u => `${u.name} ${u.surname} ${u.email} ${u.phone}`.toLowerCase().includes(search.toLowerCase()));
  const filteredResvs = resvs.filter(r => `${r.user_name} ${r.pitches?.name}`.toLowerCase().includes(search.toLowerCase()));

  const savePitch = async () => {
    if (!editingPitch) return;
    const payload = {
      name: editingPitch.name || "",
      location: editingPitch.location || "",
      latitude: Number(editingPitch.latitude) || 0,
      longitude: Number(editingPitch.longitude) || 0,
      price_per_hour: Number(editingPitch.price_per_hour) || 0,
      photo_url: editingPitch.photo_url || null,
      description: editingPitch.description || null,
      manager_name: editingPitch.manager_name || "Stadion Meneceri",
      manager_phone: editingPitch.manager_phone || "+994 50 000 00 00",
    };
    const { error } = editingPitch.id
      ? await supabase.from("pitches").update(payload).eq("id", editingPitch.id)
      : await supabase.from("pitches").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("success"));
    setEditingPitch(null);
    load();
  };


  const deletePitch = async (id: string) => {
    const { error } = await supabase.from("pitches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const saveResv = async () => {
    if (!editingResv) return;
    const { error } = await supabase.from("reservations").update({
      reservation_date: editingResv.reservation_date,
      start_hour: editingResv.start_hour,
      end_hour: editingResv.end_hour,
      status: editingResv.status,
    }).eq("id", editingResv.id);
    if (error) return toast.error(error.message);
    toast.success(t("success"));
    setEditingResv(null);
    load();
  };

  const deleteResv = async (id: string) => {
    if (!confirm("?")) return;
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const doWithdraw = async () => {
    const amt = Number(withdrawAmt);
    if (!amt || amt <= 0) return toast.error(t("enterAmount"));
    if (amt > balance) return toast.error(t("insufficientBalance"));
    const { error } = await supabase.from("admin_balance_entries").insert({
      amount: -amt,
      kind: "withdrawal",
      note: withdrawNote || "Withdraw",
    });
    if (error) return toast.error(error.message);
    toast.success(t("withdrawSuccess"));
    setWithdrawAmt(""); setWithdrawNote("");
    load();
  };

  const userResvs = viewUser ? resvs.filter(r => r.user_id === viewUser.id) : [];
  const userSpent = userResvs.filter(r => r.status !== "cancelled").reduce((s, r) => s + Number(r.amount_paid), 0);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <h1 className="mb-6 text-3xl font-bold">{t("dashboard")}</h1>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard icon={CalendarCheck} label={t("todayReservations")} value={todayResvs.length} color="bg-primary" />
          <StatCard icon={DollarSign} label={t("todayRevenue")} value={`${todayRevenue.toFixed(0)} AZN`} color="bg-success" />
          <StatCard icon={TrendingUp} label={t("totalRevenue")} value={`${totalRevenue.toFixed(0)} AZN`} color="bg-warning" />
          <StatCard icon={Users} label={t("activeUsers")} value={users.length} color="bg-accent-foreground" />
          <StatCard icon={Wallet} label={t("availableBalance")} value={`${balance.toFixed(2)} AZN`} color="bg-destructive" />
        </div>

        <Tabs defaultValue="overview">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <TabsList className="flex-wrap">
              <TabsTrigger value="overview"><BarChart3 className="mr-1 h-4 w-4" />{t("overview")}</TabsTrigger>
              <TabsTrigger value="reservations">{t("reservations")}</TabsTrigger>
              <TabsTrigger value="users">{t("users")}</TabsTrigger>
              <TabsTrigger value="pitches">{t("pitches")}</TabsTrigger>
              <TabsTrigger value="balance"><Wallet className="mr-1 h-4 w-4" />{t("balance")}</TabsTrigger>
            </TabsList>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="max-w-xs" />
          </div>

          {/* OVERVIEW / REPORTS */}
          <TabsContent value="overview" className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold"><BarChart3 className="h-5 w-5" />{t("perPitch")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">{t("pitch")}</th>
                      <th className="p-2">{t("totalBookings")}</th>
                      <th className="p-2">{t("totalEarned")}</th>
                      <th className="p-2">{t("commission")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perPitch.map((p, i) => (
                      <tr key={p.name} className="border-t">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2">{p.count}</td>
                        <td className="p-2 font-semibold text-primary">{p.revenue.toFixed(2)} AZN</td>
                        <td className="p-2 text-success">{(p.revenue * 0.1).toFixed(2)} AZN</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs uppercase text-muted-foreground">{t("pendingPayments")}</div>
                <div className="text-2xl font-bold">{pendingPay.toFixed(0)} AZN</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs uppercase text-muted-foreground">{t("commission")} ({t("total")})</div>
                <div className="text-2xl font-bold text-success">{(totalRevenue * 0.1).toFixed(2)} AZN</div>
              </div>
            </div>
          </TabsContent>

          {/* RESERVATIONS */}
          <TabsContent value="reservations">
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">{t("user")}</th>
                    <th className="p-3">{t("pitch")}</th>
                    <th className="p-3">{t("date")}</th>
                    <th className="p-3">{t("timeSlot")}</th>
                    <th className="p-3">{t("paymentPercent")}</th>
                    <th className="p-3">{t("status")}</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResvs.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3 font-medium">{r.user_name}</td>
                      <td className="p-3">{r.pitches?.name}</td>
                      <td className="p-3">{r.reservation_date}</td>
                      <td className="p-3">{String(r.start_hour).padStart(2,"0")}:00–{String(r.end_hour).padStart(2,"0")}:00</td>
                      <td className="p-3">{r.amount_paid}/{r.total_cost} AZN ({r.payment_percentage}%)</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          r.status === "confirmed" ? "bg-success/15 text-success" :
                          r.status === "cancelled" ? "bg-destructive/15 text-destructive" :
                          "bg-warning/15 text-warning-foreground"
                        }`}>{r.status}</span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => setEditingResv(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteResv(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users">
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">{t("name")}</th>
                    <th className="p-3">{t("email")}</th>
                    <th className="p-3">{t("phone")}</th>
                    <th className="p-3">{t("bookingsCount")}</th>
                    <th className="p-3">{t("totalSpent")}</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const ur = resvs.filter(r => r.user_id === u.id && r.status !== "cancelled");
                    const sp = ur.reduce((s, r) => s + Number(r.amount_paid), 0);
                    return (
                      <tr key={u.id} className="border-t">
                        <td className="p-3 font-medium">{u.name} {u.surname}</td>
                        <td className="p-3">{u.email}</td>
                        <td className="p-3">{u.phone || "—"}</td>
                        <td className="p-3">{ur.length}</td>
                        <td className="p-3 font-semibold text-primary">{sp.toFixed(2)} AZN</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setViewUser(u)}><Eye className="mr-1 h-4 w-4" />{t("userDetails")}</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* PITCHES */}
          <TabsContent value="pitches">
            <div className="mb-3 flex justify-end">
              <Dialog open={!!editingPitch} onOpenChange={(o) => !o && setEditingPitch(null)}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingPitch({})}><Plus className="mr-1 h-4 w-4" />{t("addPitch")}</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                  <DialogHeader><DialogTitle>{editingPitch?.id ? t("edit") : t("addPitch")}</DialogTitle></DialogHeader>
                  {editingPitch && (
                    <div className="space-y-2">
                      <div><Label>{t("name")}</Label><Input value={editingPitch.name || ""} onChange={(e) => setEditingPitch({...editingPitch, name: e.target.value})} /></div>
                      <div><Label>{t("location")}</Label><Input value={editingPitch.location || ""} onChange={(e) => setEditingPitch({...editingPitch, location: e.target.value})} /></div>

                      <div>
                        <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {t("pickOnMap")}</Label>
                        <ClientOnly>
                          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
                            <PitchPickerMap
                              lat={editingPitch.latitude ?? null}
                              lng={editingPitch.longitude ?? null}
                              onPick={(lat, lng) => setEditingPitch({ ...editingPitch, latitude: lat, longitude: lng })}
                            />
                          </Suspense>
                        </ClientOnly>
                        <p className="mt-1 text-xs text-muted-foreground">{t("clickMapHint")}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>{t("latitude")}</Label><Input type="number" step="0.0001" value={editingPitch.latitude ?? ""} onChange={(e) => setEditingPitch({...editingPitch, latitude: Number(e.target.value)})} /></div>
                        <div><Label>{t("longitude")}</Label><Input type="number" step="0.0001" value={editingPitch.longitude ?? ""} onChange={(e) => setEditingPitch({...editingPitch, longitude: Number(e.target.value)})} /></div>
                      </div>
                      <div><Label>{t("pricePerHour")} (AZN)</Label><Input type="number" value={editingPitch.price_per_hour ?? ""} onChange={(e) => setEditingPitch({...editingPitch, price_per_hour: Number(e.target.value)})} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>{t("managerName")}</Label><Input value={editingPitch.manager_name || ""} onChange={(e) => setEditingPitch({...editingPitch, manager_name: e.target.value})} placeholder="Elvin Məmmədov" /></div>
                        <div><Label>{t("managerPhone")}</Label><Input value={editingPitch.manager_phone || ""} onChange={(e) => setEditingPitch({...editingPitch, manager_phone: e.target.value})} placeholder="+994 50 123 45 67" /></div>
                      </div>
                      <div><Label>{t("photoUrl")}</Label><Input value={editingPitch.photo_url || ""} onChange={(e) => setEditingPitch({...editingPitch, photo_url: e.target.value})} /></div>
                      <div><Label>{t("description")}</Label><Input value={editingPitch.description || ""} onChange={(e) => setEditingPitch({...editingPitch, description: e.target.value})} /></div>
                      <Button onClick={savePitch} className="w-full">{t("save")}</Button>
                    </div>
                  )}
                </DialogContent>

              </Dialog>
            </div>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">{t("name")}</th>
                    <th className="p-3">{t("location")}</th>
                    <th className="p-3">{t("pricePerHour")}</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pitches.filter(p => `${p.name} ${p.location}`.toLowerCase().includes(search.toLowerCase())).map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3">{p.location}</td>
                      <td className="p-3">{p.price_per_hour} AZN</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditingPitch(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePitch(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* BALANCE */}
          <TabsContent value="balance" className="space-y-4">
            <div className="rounded-xl border bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground shadow-lg">
              <div className="text-sm opacity-80">{t("availableBalance")}</div>
              <div className="mt-1 text-4xl font-bold">{balance.toFixed(2)} AZN</div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input type="number" placeholder={t("withdrawAmount")} value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} className="text-foreground" />
                <Input placeholder="Note" value={withdrawNote} onChange={(e) => setWithdrawNote(e.target.value)} className="text-foreground" />
                <Button variant="secondary" onClick={doWithdraw}><Wallet className="mr-2 h-4 w-4" />{t("withdraw")}</Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border bg-card">
              <div className="p-3 font-semibold border-b">{t("history")}</div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">{t("date")}</th>
                    <th className="p-3">Kind</th>
                    <th className="p-3">Note</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-3">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="p-3"><span className="rounded-full bg-accent px-2 py-0.5 text-xs">{e.kind}</span></td>
                      <td className="p-3 text-muted-foreground">{e.note}</td>
                      <td className={`p-3 text-right font-bold ${Number(e.amount) >= 0 ? "text-success" : "text-destructive"}`}>
                        {Number(e.amount) >= 0 ? "+" : ""}{Number(e.amount).toFixed(2)} AZN
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit reservation dialog */}
      <Dialog open={!!editingResv} onOpenChange={(o) => !o && setEditingResv(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("edit")} {t("reservation")}</DialogTitle></DialogHeader>
          {editingResv && (
            <div className="space-y-3">
              <div><Label>{t("user")}</Label><Input value={editingResv.user_name} disabled /></div>
              <div><Label>{t("pitch")}</Label><Input value={editingResv.pitches?.name || ""} disabled /></div>
              <div><Label>{t("date")}</Label>
                <Input type="date" value={editingResv.reservation_date} onChange={(e) => setEditingResv({...editingResv, reservation_date: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Start hour</Label>
                  <Input type="number" min={0} max={23} value={editingResv.start_hour}
                    onChange={(e) => setEditingResv({...editingResv, start_hour: Number(e.target.value), end_hour: Number(e.target.value) + 1})} />
                </div>
                <div><Label>End hour</Label>
                  <Input type="number" min={0} max={24} value={editingResv.end_hour}
                    onChange={(e) => setEditingResv({...editingResv, end_hour: Number(e.target.value)})} />
                </div>
              </div>
              <div><Label>{t("status")}</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={editingResv.status}
                  onChange={(e) => setEditingResv({...editingResv, status: e.target.value})}>
                  <option value="confirmed">confirmed</option>
                  <option value="pending">pending</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
              <Button onClick={saveResv} className="w-full">{t("save")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User detail dialog */}
      <Dialog open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("userDetails")}</DialogTitle></DialogHeader>
          {viewUser && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-accent/50 p-3 text-sm">
                <div><div className="text-xs text-muted-foreground">{t("name")}</div><div className="font-semibold">{viewUser.name} {viewUser.surname}</div></div>
                <div><div className="text-xs text-muted-foreground">{t("email")}</div><div className="font-semibold">{viewUser.email}</div></div>
                <div><div className="text-xs text-muted-foreground">{t("phone")}</div><div className="font-semibold">{viewUser.phone || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">{t("totalSpent")}</div><div className="font-bold text-primary">{userSpent.toFixed(2)} AZN</div></div>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left"><tr>
                    <th className="p-2">{t("pitch")}</th><th className="p-2">{t("date")}</th><th className="p-2">{t("timeSlot")}</th><th className="p-2">{t("status")}</th><th className="p-2">{t("total")}</th>
                  </tr></thead>
                  <tbody>
                    {userResvs.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">{r.pitches?.name}</td>
                        <td className="p-2">{r.reservation_date}</td>
                        <td className="p-2">{String(r.start_hour).padStart(2,"0")}:00</td>
                        <td className="p-2">{r.status}</td>
                        <td className="p-2">{r.amount_paid} AZN</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
