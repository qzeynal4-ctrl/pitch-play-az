import { Link, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, MapPin, Calendar, Shield, Menu, User, Settings } from "lucide-react";

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
          <button
            onClick={() => setLang(lang === "az" ? "en" : "az")}
            className="rounded-md border px-2 py-1 text-xs font-semibold hover:bg-accent"
            title="Language"
          >
            {lang === "az" ? "AZ" : "EN"} / {lang === "az" ? "EN" : "AZ"}
          </button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title={t("profile")}>
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[1100] w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{profile?.name || user.email?.split("@")[0]}</div>
                  <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                  <User className="mr-2 h-4 w-4" /> {t("profile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/profile", search: { tab: "settings" } as never })}>
                  <Settings className="mr-2 h-4 w-4" /> {t("profileSettings")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/my-reservations" })}>
                  <Calendar className="mr-2 h-4 w-4" /> {t("myReservations")}
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                    <Shield className="mr-2 h-4 w-4" /> {t("admin")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
