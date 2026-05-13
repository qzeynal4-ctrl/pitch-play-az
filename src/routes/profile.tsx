import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({ component: Profile });

function Profile() {
  const { user, profile, loading } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", surname: "", phone: "" });
  const [pwd, setPwd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({ name: profile.name || "", surname: profile.surname || "", phone: profile.phone || "" });
  }, [profile]);

  if (!loading && !user) {
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

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("success"));
  };

  const changePassword = async () => {
    if (pwd.length < 8) return toast.error("Min 8");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) return toast.error(error.message);
    setPwd("");
    toast.success(t("success"));
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 md:p-8">
        <h1 className="text-3xl font-bold">{t("profile")}</h1>

        <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t("profile")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>{t("surname")}</Label><Input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} /></div>
          </div>
          <div><Label>{t("email")}</Label><Input value={user?.email || ""} disabled /></div>
          <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <Button onClick={saveProfile} disabled={saving}>{t("save")}</Button>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t("profileSettings")}</h2>
          <div><Label>{t("password")}</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" /></div>
          <Button onClick={changePassword} variant="outline">{t("save")}</Button>
        </section>
      </main>
    </div>
  );
}
