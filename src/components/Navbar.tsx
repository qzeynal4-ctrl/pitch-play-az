import { Link, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, MapPin, Calendar, Shield } from "lucide-react";

export function Navbar() {
  const { t, lang, setLang } = useI18n();
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-[1000] border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-primary">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">⚽</div>
          <span className="hidden sm:inline">{t("appName")}</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className="flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-accent"
            activeProps={{ className: "flex items-center gap-1 rounded-md px-3 py-1.5 bg-accent font-medium" }}
            activeOptions={{ exact: true }}
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden md:inline">{t("map")}</span>
          </Link>
          {user && (
            <Link
              to="/my-reservations"
              className="flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-accent"
              activeProps={{ className: "flex items-center gap-1 rounded-md px-3 py-1.5 bg-accent font-medium" }}
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden md:inline">{t("myReservations")}</span>
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-accent"
              activeProps={{ className: "flex items-center gap-1 rounded-md px-3 py-1.5 bg-accent font-medium" }}
            >
              <Shield className="h-4 w-4" />
              <span className="hidden md:inline">{t("admin")}</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border text-xs font-medium">
            <button
              onClick={() => setLang("az")}
              className={`px-2 py-1 ${lang === "az" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              🇦🇿 AZ
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-1 ${lang === "en" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              🇬🇧 EN
            </button>
          </div>

          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground md:inline">
                {profile?.name || user.email?.split("@")[0]}
              </span>
              <Button variant="ghost" size="icon" onClick={logout} title={t("logout")}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">{t("login")}</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">{t("register")}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
