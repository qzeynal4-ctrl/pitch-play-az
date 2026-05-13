import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, MapPin, Clock, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Pitch = {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  price_per_hour: number;
  photo_url: string | null;
  description: string | null;
};

type Reservation = {
  id: string;
  start_hour: number;
  user_name: string;
  user_id: string;
};

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8);

export function PitchSidebar({
  pitch,
  onClose,
  onChange,
}: {
  pitch: Pitch | null;
  onClose: () => void;
  onChange?: () => void;
}) {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [reserveSlot, setReserveSlot] = useState<number | null>(null);
  const [paymentPct, setPaymentPct] = useState(40);
  const [step, setStep] = useState<"summary" | "card" | "processing" | "done">("summary");
  const [card, setCard] = useState({ number: "", holder: "", expiry: "", cvc: "" });

  useEffect(() => {
    if (!pitch) return;
    setLoading(true);
    supabase
      .from("reservations")
      .select("id,start_hour,user_name,user_id")
      .eq("pitch_id", pitch.id)
      .eq("reservation_date", date)
      .neq("status", "cancelled")
      .then(({ data }) => {
        setReservations((data as Reservation[]) || []);
        setLoading(false);
      });
  }, [pitch, date]);

  if (!pitch) return null;

  const reservedMap = new Map(reservations.map((r) => [r.start_hour, r]));

  const handleReserve = (hour: number) => {
    if (!user) {
      toast(t("loginRequired"));
      navigate({ to: "/login" });
      return;
    }
    setReserveSlot(hour);
    setPaymentPct(40);
    setStep("summary");
    setCard({ number: "", holder: "", expiry: "", cvc: "" });
  };

  const total = pitch.price_per_hour;
  const amount = ((total * paymentPct) / 100).toFixed(2);

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const cardValid =
    card.number.replace(/\s/g, "").length >= 13 &&
    card.holder.trim().length >= 2 &&
    /^\d{2}\/\d{2}$/.test(card.expiry) &&
    /^\d{3,4}$/.test(card.cvc);

  const submitReservation = async () => {
    if (reserveSlot == null || !user) return;
    setStep("processing");
    // Simulate payment
    await new Promise((r) => setTimeout(r, 1400));
    const { error } = await supabase.from("reservations").insert({
      user_id: user.id,
      pitch_id: pitch.id,
      reservation_date: date,
      start_hour: reserveSlot,
      end_hour: reserveSlot + 1,
      total_cost: total,
      payment_percentage: paymentPct,
      amount_paid: Number(amount),
      status: "confirmed",
      user_name: profile?.name || user.email?.split("@")[0] || "User",
    });
    if (error) {
      toast.error(error.message);
      setStep("card");
      return;
    }
    setStep("done");
    toast.success(t("paymentSuccess"));
    const { data } = await supabase
      .from("reservations")
      .select("id,start_hour,user_name,user_id")
      .eq("pitch_id", pitch.id)
      .eq("reservation_date", date)
      .neq("status", "cancelled");
    setReservations((data as Reservation[]) || []);
    onChange?.();
  };

  return (
    <>
      <aside className="absolute right-0 top-0 z-[1100] flex h-full w-full max-w-md flex-col overflow-hidden border-l bg-card shadow-2xl sm:w-[420px]">
        <div className="relative h-44 shrink-0">
          {pitch.photo_url && (
            <img src={pitch.photo_url} alt={pitch.name} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h2 className="text-xl font-bold">{pitch.name}</h2>
            <p className="flex items-center gap-1 text-sm opacity-90">
              <MapPin className="h-3 w-3" /> {pitch.location}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between rounded-lg bg-accent/50 p-3">
            <div>
              <div className="text-xs text-muted-foreground">{t("pricePerHour")}</div>
              <div className="text-lg font-bold text-primary">{pitch.price_per_hour} AZN</div>
            </div>
            <div>
              <Label className="text-xs">{t("date")}</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="h-8 w-36 text-sm"
              />
            </div>
          </div>

          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
            <Clock className="h-4 w-4" /> {t("timeSlots")}
          </h3>

          <div className="mb-3 flex gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-success" /> {t("available")}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-destructive" /> {t("reserved")}</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">…</div>
            ) : (
              HOURS.map((h) => {
                const r = reservedMap.get(h);
                const isReserved = !!r;
                return (
                  <div
                    key={h}
                    className={`flex items-center justify-between rounded-md border-l-4 px-3 py-2 text-sm ${
                      isReserved
                        ? "border-destructive bg-destructive/5"
                        : "border-success bg-success/5"
                    }`}
                  >
                    <span className="font-medium">
                      {String(h).padStart(2, "0")}:00 – {String(h + 1).padStart(2, "0")}:00
                    </span>
                    {isReserved ? (
                      <span className="text-xs text-destructive">
                        {r.user_name} • {t("reserved")}
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => handleReserve(h)}>
                        {t("reserve")}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      <Dialog open={reserveSlot != null} onOpenChange={(o) => !o && setReserveSlot(null)}>
        <DialogContent className="z-[1200]">
          <DialogHeader>
            <DialogTitle>{t("reservation")} – {pitch.name}</DialogTitle>
            <DialogDescription>
              {date} • {reserveSlot != null && `${String(reserveSlot).padStart(2,"0")}:00 – ${String(reserveSlot+1).padStart(2,"0")}:00`}
            </DialogDescription>
          </DialogHeader>

          {step === "summary" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-accent p-3 text-sm">
                <div className="flex justify-between"><span>{t("user")}</span><span className="font-medium">{profile?.name} {profile?.surname}</span></div>
                <div className="flex justify-between"><span>{t("phone")}</span><span className="font-medium">{profile?.phone || "—"}</span></div>
                <div className="mt-2 flex justify-between border-t pt-2"><span>{t("total")}</span><span className="font-bold text-primary">{total} AZN</span></div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <Label>{t("paymentAmount")}</Label>
                  <span className="font-bold text-primary">{paymentPct}% • {amount} AZN</span>
                </div>
                <Slider value={[paymentPct]} onValueChange={(v) => setPaymentPct(v[0])} min={40} max={100} step={5} />
                <p className="mt-1 text-xs text-muted-foreground">{t("deposit")}: 40% min</p>
              </div>

              <Button onClick={() => setStep("card")} className="w-full">
                <CreditCard className="mr-2 h-4 w-4" /> {t("payNow")} {amount} AZN
              </Button>
            </div>
          )}

          {step === "card" && (
            <div className="space-y-3">
              <div className="rounded-lg bg-gradient-to-br from-primary to-primary/70 p-4 text-primary-foreground shadow">
                <div className="text-xs opacity-80">{t("cardDetails")}</div>
                <div className="mt-2 font-mono text-lg tracking-wider">
                  {card.number || "•••• •••• •••• ••••"}
                </div>
                <div className="mt-3 flex justify-between text-xs">
                  <span>{card.holder.toUpperCase() || "FULL NAME"}</span>
                  <span>{card.expiry || "MM/YY"}</span>
                </div>
              </div>

              <div>
                <Label>{t("cardNumber")}</Label>
                <Input
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                  value={card.number}
                  onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                />
              </div>
              <div>
                <Label>{t("cardHolder")}</Label>
                <Input value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} placeholder="Ad Soyad" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t("expiry")}</Label>
                  <Input value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} placeholder="12/28" />
                </div>
                <div>
                  <Label>{t("cvc")}</Label>
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    value={card.cvc}
                    onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "") })}
                    placeholder="123"
                  />
                </div>
              </div>

              <Button onClick={submitReservation} disabled={!cardValid} className="w-full">
                {t("payNow")} {amount} AZN
              </Button>
            </div>
          )}

          {step === "processing" && (
            <div className="py-10 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">{t("processing")}</p>
            </div>
          )}

          {step === "done" && (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
              <h3 className="mt-3 text-lg font-bold">{t("paymentSuccess")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("bookingConfirmed")}</p>
              <Button className="mt-5 w-full" onClick={() => setReserveSlot(null)}>OK</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
