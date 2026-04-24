import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/supabasePaginate";

const PHONE_LIKE_NAME = /^[+\d\s()\-]{7,}$/;

export interface PatientLite {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  source?: string | null;
  source_ad_details?: string | null;
  source_referral_doctor?: string | null;
}

interface PatientComboboxProps {
  value: string;
  onValueChange: (value: string, patient?: PatientLite) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Extra columns to fetch for the consumer */
  withSource?: boolean;
}

const PAGE = 50;

export function PatientCombobox({
  value,
  onValueChange,
  placeholder = "Select patient",
  allowNone = false,
  noneLabel = "No patient",
  className,
  disabled,
  withSource = false,
}: PatientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE);

  const columns = withSource
    ? "id, first_name, last_name, phone, source, source_ad_details, source_referral_doctor"
    : "id, first_name, last_name, phone";

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients-combobox", withSource],
    queryFn: async () =>
      await fetchAll<PatientLite>((from, to) =>
        supabase.from("patients").select(columns).order("first_name").range(from, to)
      ),
    staleTime: 60_000,
  });

  const getRawName = (p: PatientLite) =>
    `${p.first_name || ""} ${p.last_name || ""}`.replace(/\s+/g, " ").trim();

  const hasMeaningfulName = (p: PatientLite) => {
    const name = getRawName(p);
    return !!name && !PHONE_LIKE_NAME.test(name);
  };

  const displayName = (p: PatientLite) => {
    const name = getRawName(p);
    if (hasMeaningfulName(p)) return name;
    if (p.phone) return p.phone;
    if (name) return name;
    return "Unnamed";
  };

  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => {
      const an = hasMeaningfulName(a);
      const bn = hasMeaningfulName(b);
      if (an !== bn) return an ? -1 : 1;
      return displayName(a).localeCompare(displayName(b), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [patients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sortedPatients;
    return sortedPatients.filter(
      (p) =>
        displayName(p).toLowerCase().includes(q) ||
        (p.phone || "").toLowerCase().includes(q)
    );
  }, [sortedPatients, search]);

  const shown = filtered.slice(0, visible);
  const selected = patients.find((p) => p.id === value);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setSearch("");
          setVisible(PAGE);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">
            {selected ? displayName(selected) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisible(PAGE);
            }}
            className="h-8"
            autoFocus
          />
        </div>
        <div
          className="max-h-64 overflow-y-auto overscroll-contain space-y-0.5 pr-1"
          style={{ scrollbarGutter: "stable", WebkitOverflowScrolling: "touch" }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
              setVisible((v) => Math.min(v + PAGE, filtered.length));
            }
          }}
        >
          {allowNone && (
            <button
              type="button"
              className={cn(
                "w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2 hover:bg-accent",
                !value && "bg-accent"
              )}
              onClick={() => {
                onValueChange("");
                setOpen(false);
              }}
            >
              <Check className={cn("h-3.5 w-3.5", value ? "opacity-0" : "opacity-100")} />
              <span className="text-muted-foreground">{noneLabel}</span>
            </button>
          )}
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-3">Loading patients…</p>
          ) : shown.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No patients found</p>
          ) : (
            shown.map((p) => (
              <button
                type="button"
                key={p.id}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2 hover:bg-accent",
                  value === p.id && "bg-accent"
                )}
                onClick={() => {
                  onValueChange(p.id, p);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    value === p.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{displayName(p)}</p>
                  {p.phone && p.phone !== displayName(p) && (
                    <p className="text-[10px] text-muted-foreground truncate">{p.phone}</p>
                  )}
                </div>
              </button>
            ))
          )}
          {!isLoading && shown.length < filtered.length && (
            <p className="text-[10px] text-muted-foreground text-center py-1">
              Showing {shown.length} of {filtered.length} — scroll for more
            </p>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground text-center pt-1.5 border-t mt-1">
          {patients.length.toLocaleString()} patients loaded
        </p>
      </PopoverContent>
    </Popover>
  );
}