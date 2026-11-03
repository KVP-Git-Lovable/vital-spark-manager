import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hoursWorked, type AttendanceRecord } from "@/lib/attendance";
import { FaceBadge } from "@/pages/Attendance";

/**
 * Everyone's attendance, with the photos.
 *
 * A SECTION of the attendance page, not a page. It used to be its own screen
 * at /admin/attendance, and the clinic kept opening it looking for check-in
 * and finding only a date filter and an empty list. One page called
 * Attendance now carries your own day at the top and this underneath, for
 * admins only.
 *
 * The timestamp is burned into each picture at capture, so a photo that
 * leaves this screen still carries when it was taken. It is also printed
 * beside it, because reading it off the image is fine for checking one and
 * useless for scanning fifty.
 *
 * Phase 2 will add regularisation, attendance configuration and the
 * employee-facing leave requests as tabs here. Leave itself already lives at
 * /leave and is untouched.
 */
export function TeamAttendance() {
  const [from, setFrom] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [photo, setPhoto] = useState<{ url: string; who: string; when: string } | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["attendance", "admin", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, staff(first_name, last_name, role)")
        .gte("date", from).lte("date", to)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as (AttendanceRecord & { staff: unknown })[];
    },
  });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold font-display flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />All staff
      </h2>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label htmlFor="from" className="text-xs">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label htmlFor="to" className="text-xs">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {error ? (
        <p className="text-destructive py-10 text-center">{error.message}</p>
      ) : isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Loading attendance…</p>
      ) : !rows.length ? (
        <div className="py-16 border-y text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-3" />
          <p>No attendance recorded in this period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const staff = r.staff as { first_name?: string; last_name?: string; role?: string } | null;
            const who = `${staff?.first_name ?? ""} ${staff?.last_name ?? ""}`.trim() || "Unknown";
            const hours = hoursWorked(r.check_in_time, r.check_out_time);
            return (
              <Card key={r.id}>
                <CardContent className="p-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">{who} <span className="text-muted-foreground font-normal text-sm">· {staff?.role}</span></p>
                    <p className="text-sm text-muted-foreground">{format(new Date(r.date), "EEE, d MMM yyyy")}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm pt-1">
                      <Stamp label="Started" time={r.check_in_time} status={r.check_in_face_status} confidence={r.check_in_face_confidence} />
                      <Stamp label="Ended" time={r.check_out_time} status={r.check_out_face_status} confidence={r.check_out_face_confidence} />
                      {hours !== null && <div><p className="text-xs text-muted-foreground">Hours</p><p className="font-medium">{hours}</p></div>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Thumb url={r.check_in_photo} label="In" who={who} when={r.check_in_time} onOpen={setPhoto} />
                    <Thumb url={r.check_out_photo} label="Out" who={who} when={r.check_out_time} onOpen={setPhoto} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!photo} onOpenChange={(open) => { if (!open) setPhoto(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{photo?.who} · {photo?.when}</DialogTitle></DialogHeader>
          {photo && <img src={photo.url} alt={`${photo.who} at ${photo.when}`} className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Stamp({ label, time, status, confidence }: { label: string; time: string | null; status: string | null; confidence: number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{time ? format(new Date(time), "h:mm:ss a") : "—"}</p>
      {status && (
        <div className="flex items-center gap-1">
          <FaceBadge status={status} />
          {/* The number matters when somebody disputes a check: a 74% refusal
              and a 12% refusal are very different conversations. */}
          {status !== "bypassed" && confidence != null && (
            <span className="text-[11px] text-muted-foreground">{confidence}%</span>
          )}
        </div>
      )}
    </div>
  );
}

function Thumb({ url, label, who, when, onOpen }: {
  url: string | null; label: string; who: string; when: string | null;
  onOpen: (p: { url: string; who: string; when: string }) => void;
}) {
  if (!url) {
    return <div className="h-20 w-20 rounded-md border border-dashed flex items-center justify-center text-[11px] text-muted-foreground">{label}</div>;
  }
  const whenText = when ? format(new Date(when), "d MMM yyyy, h:mm:ss a") : "—";
  return (
    <button
      type="button"
      className="h-20 w-20 overflow-hidden rounded-md border transition hover:ring-2 hover:ring-primary"
      title={`${label} · ${whenText}`}
      onClick={() => onOpen({ url, who, when: whenText })}
    >
      <img src={url} alt={`${who} ${label}`} loading="lazy" className="h-full w-full object-cover" />
    </button>
  );
}
