import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({ component: Register });

function Register() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", surname: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name: form.name, surname: form.surname, phone: form.phone },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("success"));
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-accent/30 to-background p-4">
        <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl border bg-card p-6 shadow-xl">
          <div className="text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-primary text-2xl text-primary-foreground">⚽</div>
            <h1 className="text-2xl font-bold">{t("register")}</h1>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>{t("name")}</Label>
              <Input value={form.name} onChange={upd("name")} required />
            </div>
            <div className="space-y-1">
              <Label>{t("surname")}</Label>
              <Input value={form.surname} onChange={upd("surname")} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("email")}</Label>
            <Input type="email" value={form.email} onChange={upd("email")} required />
          </div>
          <div className="space-y-1">
            <Label>{t("phone")}</Label>
            <Input value={form.phone} onChange={upd("phone")} required />
          </div>
          <div className="space-y-1">
            <Label>{t("password")}</Label>
            <Input type="password" minLength={8} value={form.password} onChange={upd("password")} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "…" : t("register")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("haveAccount")} <Link to="/login" className="font-medium text-primary hover:underline">{t("login")}</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
