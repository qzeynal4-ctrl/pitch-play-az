import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/login")({ component: OwnerLogin });

function OwnerLogin() {
  const { user, profile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    // Only owners or admins may visit
    supabase
      .from("profiles")
      .select("role,username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const role = (data as { role?: string } | null)?.role;
        if (role !== "owner" && !isAdmin) {
          navigate({ to: "/" });
        } else if (role === "owner" && (data as { username?: string }).username) {
          setUsername((data as { username: string }).username);
        }
      });
  }, [loading, user, isAdmin, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    const { data } = await supabase
      .from("profiles")
      .select("username,role")
      .ilike("username", username.trim())
      .maybeSingle();
    setBusy(false);
    const row = data as { username?: string; role?: string } | null;
    if (!row || (row.role !== "owner" && row.role !== "admin")) {
      toast.error("Bu username tapılmadı");
      return;
    }
    navigate({ to: "/owner/dashboard/$username", params: { username: row.username! } });
  };

  if (loading || !user) return null;
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-accent/30 to-background p-4">
        <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl border bg-card p-6 shadow-xl">
          <h1 className="text-2xl font-bold">Owner Login</h1>
          <p className="text-sm text-muted-foreground">Username daxil edin.</p>
          <div className="space-y-1">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>Davam et</Button>
        </form>
      </main>
    </div>
  );
}
