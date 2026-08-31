import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, CalendarDays, Stethoscope, Receipt, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MicButton } from "@/components/shared/MicButton";
import { supabase } from "@/integrations/supabase/client";
import { buildOrFilter, fuzzyRank } from "@/lib/fuzzySearch";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Result = {
  id: string;
  kind: "patient" | "appointment" | "procedure" | "invoice";
  title: string;
  subtitle: string;
  route: string;
};

const KIND_META: Record<Result["kind"], { label: string; icon: any }> = {
  patient: { label: "Patients", icon: User },
  appointment: { label: "Appointments", icon: CalendarDays },
  procedure: { label: "Procedures", icon: Stethoscope },
  invoice: { label: "Invoices", icon: Receipt },
};

export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = debounced;
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const like = `%${q}%`;
      const patientFilter = buildOrFilter(q, ["first_name", "last_name", "phone", "email"]);

      const [patients, appts, procs, invs] = await Promise.all([
        supabase
          .from("patients")
          .select("id, first_name, last_name, phone")
          .or(patientFilter || `first_name.ilike.${like}`)
          .limit(20),
        supabase
          .from("appointments")
          .select("id, patient_name, service, start_time, status")
          .or(`patient_name.ilike.${like},service.ilike.${like}`)
          .order("start_time", { ascending: false })
          .limit(10),
        supabase
          .from("procedures")
          .select("id, service_name, procedure_date, patients(first_name, last_name)")
          .ilike("service_name", like)
          .order("procedure_date", { ascending: false })
          .limit(10),
        supabase
          .from("invoices")
          .select("id, invoice_number, patient_name, total_amount, created_at")
          .or(`invoice_number.ilike.${like},patient_name.ilike.${like}`)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (cancelled) return;

      const patientRows = (patients.data || []) as any[];
      const ranked = fuzzyRank(
        patientRows,
        q,
        (p: any) => `${p.first_name || ""} ${p.last_name || ""} ${p.phone || ""}`,
        0.45
      );
      const usePatients = (ranked.length ? ranked : patientRows).slice(0, 6);

      const out: Result[] = [
        ...usePatients.map((p: any) => ({
          id: p.id,
          kind: "patient" as const,
          title: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
          subtitle: p.phone || "Patient",
          route: `/patients/${p.id}`,
        })),
        ...((appts.data || []) as any[]).slice(0, 5).map((a: any) => ({
          id: a.id,
          kind: "appointment" as const,
          title: a.patient_name || "Appointment",
          subtitle: `${a.service || "Visit"} · ${a.start_time ? format(new Date(a.start_time), "dd MMM yyyy, h:mm a") : ""}`,
          route: `/appointments/${a.id}`,
        })),
        ...((procs.data || []) as any[]).slice(0, 5).map((p: any) => ({
          id: p.id,
          kind: "procedure" as const,
          title: `${p.patients?.first_name || ""} ${p.patients?.last_name || ""}`.trim() || "Procedure",
          subtitle: `${p.service_name || ""} · ${p.procedure_date ? format(new Date(p.procedure_date), "dd MMM yyyy") : ""}`,
          route: `/procedures?id=${p.id}`,
        })),
        ...((invs.data || []) as any[]).slice(0, 5).map((i: any) => ({
          id: i.id,
          kind: "invoice" as const,
          title: i.invoice_number || "Invoice",
          subtitle: `${i.patient_name || ""} · ₹${Number(i.total_amount || 0).toLocaleString("en-IN")}`,
          route: `/billing?viewInvoice=${i.id}`,
        })),
      ];

      setResults(out);
      setActiveIndex(0);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [debounced]);

  const grouped = useMemo(() => {
    const map = new Map<Result["kind"], Result[]>();
    results.forEach((r) => {
      if (!map.has(r.kind)) map.set(r.kind, []);
      map.get(r.kind)!.push(r);
    });
    return [...map.entries()];
  }, [results]);

  const go = (r: Result) => {
    setOpen(false);
    setTerm("");
    navigate(r.route);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[activeIndex]); }
    else if (e.key === "Escape") setOpen(false);
  };

  let flatIndex = -1;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search patients, appointments, bills…"
        className="pl-9 pr-10 w-72 bg-muted border-0"
        value={term}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2">
        <MicButton
          value={term}
          onChange={(v) => { setTerm(v); setOpen(true); }}
          mode="replace"
          title="Speak to search"
        />
      </div>

      {open && term.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-[26rem] max-h-[70vh] overflow-y-auto rounded-lg border bg-popover shadow-lg p-1">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">No matches for “{term}”</p>
          )}
          {grouped.map(([kind, items]) => {
            const Meta = KIND_META[kind];
            const Icon = Meta.icon;
            return (
              <div key={kind} className="py-1">
                <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{Meta.label}</p>
                {items.map((r) => {
                  flatIndex += 1;
                  const idx = flatIndex;
                  return (
                    <button
                      key={`${kind}-${r.id}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => go(r)}
                      className={cn(
                        "w-full flex items-start gap-2 px-3 py-2 rounded-md text-left transition-colors",
                        idx === activeIndex ? "bg-accent" : "hover:bg-accent/60"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm truncate">{r.title}</span>
                        <span className="block text-xs text-muted-foreground truncate">{r.subtitle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
