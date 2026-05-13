import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    // Update last_login
    if (data.user) {
      await supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", data.user.id);
    }
    // Check admin role
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user!.id);
    const isAdmin = !!roles?.some((r) => r.role === "admin");
    toast.success(t("welcome"));
    setLoading(false);
    navigate({ to: isAdmin ? "/admin" : "/" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-accent/30 to-background p-4">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-xl">
          <div className="text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-primary text-2xl text-primary-foreground">⚽</div>
            <h1 className="text-2xl font-bold">{t("login")}</h1>
          </div>
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t("password")}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "…" : t("login")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")} <Link to="/register" className="font-medium text-primary hover:underline">{t("register")}</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
