import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarCheck, Users, DollarSign, Clock, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({ component: Admin });

type Profile = { id: string; name: string; surname: string; email: string; phone: string; created_at: string; last_login: string | null };
type Pitch = { id: string; name: string; location: string; latitude: number; longitude: number; price_per_hour: number; photo_url: string | null; description: string | null };
type Resv = { id: string; reservation_date: string; start_hour: number; end_hour: number; total_cost: number; amount_paid: number; payment_percentage: number; status: string; user_name: string; pitches: { name: string } | null };

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
  const { isAdmin, loading } = useAuth();
  const { t } = useI18n();
  const [users, setUsers] = useState<Profile[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [resvs, setResvs] = useState<Resv[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Pitch> | null>(null);

  const load = async () => {
    const [{ data: u }, { data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("pitches").select("*").order("name"),
      supabase.from("reservations").select("*,pitches(name)").order("created_at", { ascending: false }),
    ]);
    setUsers((u as Profile[]) || []);
    setPitches((p as Pitch[]) || []);
    setResvs((r as unknown as Resv[]) || []);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <div className="p-8">…</div>;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-bold">Forbidden</h1>
            <Link to="/" className="mt-2 inline-block text-primary underline">Go home</Link>
          </div>
        </main>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayResvs = resvs.filter((r) => r.reservation_date === today && r.status !== "cancelled");
  const totalRevenue = resvs.filter(r => r.status !== "cancelled").reduce((s, r) => s + Number(r.amount_paid), 0);
  const pendingPay = resvs.filter(r => r.status !== "cancelled").reduce((s, r) => s + (Number(r.total_cost) - Number(r.amount_paid)), 0);

  const filteredUsers = users.filter(u => `${u.name} ${u.surname} ${u.email} ${u.phone}`.toLowerCase().includes(search.toLowerCase()));
  const filteredResvs = resvs.filter(r => `${r.user_name} ${r.pitches?.name}`.toLowerCase().includes(search.toLowerCase()));

  const savePitch = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name || "",
      location: editing.location || "",
      latitude: Number(editing.latitude) || 0,
      longitude: Number(editing.longitude) || 0,
      price_per_hour: Number(editing.price_per_hour) || 0,
      photo_url: editing.photo_url || null,
      description: editing.description || null,
    };
    const { error } = editing.id
      ? await supabase.from("pitches").update(payload).eq("id", editing.id)
      : await supabase.from("pitches").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("success"));
    setEditing(null);
    load();
  };

  const deletePitch = async (id: string) => {
    const { error } = await supabase.from("pitches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <h1 className="mb-6 text-3xl font-bold">{t("dashboard")}</h1>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={CalendarCheck} label={t("totalReservations")} value={todayResvs.length} color="bg-primary" />
          <StatCard icon={Users} label={t("activeUsers")} value={users.length} color="bg-success" />
          <StatCard icon={DollarSign} label={t("totalRevenue")} value={`${totalRevenue.toFixed(0)} AZN`} color="bg-warning" />
          <StatCard icon={Clock} label={t("pendingPayments")} value={`${pendingPay.toFixed(0)} AZN`} color="bg-destructive" />
        </div>

        <Tabs defaultValue="reservations">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="reservations">{t("reservations")}</TabsTrigger>
              <TabsTrigger value="users">{t("users")}</TabsTrigger>
              <TabsTrigger value="pitches">{t("pitches")}</TabsTrigger>
            </TabsList>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="max-w-xs" />
          </div>

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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">{t("name")}</th>
                    <th className="p-3">{t("email")}</th>
                    <th className="p-3">{t("phone")}</th>
                    <th className="p-3">Registered</th>
                    <th className="p-3">Last login</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="p-3 font-medium">{u.name} {u.surname}</td>
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.phone || "—"}</td>
                      <td className="p-3">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-3">{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="pitches">
            <div className="mb-3 flex justify-end">
              <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditing({})}><Plus className="mr-1 h-4 w-4" />{t("addPitch")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editing?.id ? t("edit") : t("addPitch")}</DialogTitle></DialogHeader>
                  {editing && (
                    <div className="space-y-2">
                      <div><Label>{t("name")}</Label><Input value={editing.name || ""} onChange={(e) => setEditing({...editing, name: e.target.value})} /></div>
                      <div><Label>{t("location")}</Label><Input value={editing.location || ""} onChange={(e) => setEditing({...editing, location: e.target.value})} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label>{t("latitude")}</Label><Input type="number" step="0.0001" value={editing.latitude ?? ""} onChange={(e) => setEditing({...editing, latitude: Number(e.target.value)})} /></div>
                        <div><Label>{t("longitude")}</Label><Input type="number" step="0.0001" value={editing.longitude ?? ""} onChange={(e) => setEditing({...editing, longitude: Number(e.target.value)})} /></div>
                      </div>
                      <div><Label>{t("pricePerHour")} (AZN)</Label><Input type="number" value={editing.price_per_hour ?? ""} onChange={(e) => setEditing({...editing, price_per_hour: Number(e.target.value)})} /></div>
                      <div><Label>{t("photoUrl")}</Label><Input value={editing.photo_url || ""} onChange={(e) => setEditing({...editing, photo_url: e.target.value})} /></div>
                      <div><Label>{t("description")}</Label><Input value={editing.description || ""} onChange={(e) => setEditing({...editing, description: e.target.value})} /></div>
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
                  {pitches.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3">{p.location}</td>
                      <td className="p-3">{p.price_per_hour} AZN</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePitch(p.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
