import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/register")({ component: OwnerRegister });

function OwnerRegister() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
    business_name: "",
    pitch_location: "",
    pitch_description: "",
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!/^[a-z0-9_]{3,30}$/i.test(form.username)) {
      toast.error("Username 3-30 hərf/rəqəm olmalıdır");
      return;
    }
    setBusy(true);
    // Check username uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", form.username)
      .neq("id", user.id)
      .maybeSingle();
    if (existing) {
      setBusy(false);
      toast.error("Bu username artıq mövcuddur");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        name: form.name,
        phone: form.phone,
        username: form.username.toLowerCase(),
        business_name: form.business_name,
        pitch_location: form.pitch_location,
        pitch_description: form.pitch_description,
        role: "owner",
        status: "pending",
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setSubmitted(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-accent/30 to-background p-4">
        {submitted ? (
          <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-success/20 text-3xl">✓</div>
            <h2 className="text-xl font-bold">Müraciətiniz göndərildi</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your application has been submitted. Please wait for admin approval.
            </p>
            <Button className="mt-4" onClick={() => navigate({ to: "/" })}>OK</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full max-w-lg space-y-3 rounded-2xl border bg-card p-6 shadow-xl">
            <h1 className="text-2xl font-bold">Stadion sahibi olun</h1>
            <p className="text-sm text-muted-foreground">Müraciətiniz admin tərəfindən baxılacaq.</p>
            <div className="space-y-1"><Label>Tam ad</Label><Input value={form.name} onChange={upd("name")} required /></div>
            <div className="space-y-1"><Label>Username</Label><Input value={form.username} onChange={upd("username")} placeholder="ornek_username" required /></div>
            <div className="space-y-1"><Label>Telefon</Label><Input value={form.phone} onChange={upd("phone")} required /></div>
            <div className="space-y-1"><Label>Biznes / Stadion adı</Label><Input value={form.business_name} onChange={upd("business_name")} required /></div>
            <div className="space-y-1"><Label>Stadion ünvanı</Label><Input value={form.pitch_location} onChange={upd("pitch_location")} required /></div>
            <div className="space-y-1"><Label>Qısa təsvir</Label><Textarea value={form.pitch_description} onChange={upd("pitch_description")} rows={3} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "..." : "Müraciət et"}</Button>
          </form>
        )}
      </main>
    </div>
  );
}
