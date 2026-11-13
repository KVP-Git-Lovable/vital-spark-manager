import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { numVal } from "@/lib/numberInput";
import { SettingRow } from "@/components/attendance/SettingRow";
import {
  ACCRUAL_OPTIONS, accrualLabel, accrualOf, entitlementToDate, needsTopUp,
  toppedUpBalance, type LeaveAccrual,
} from "@/lib/leaveAccrual";

/**
 * Leave configuration, beside the attendance policy it belongs with.
 *
 * These two cards were the Leave Types and Balances tabs of /leave, at the
 * far right of a six-tab strip on a page a therapist opens to apply for a
 * day off. Asked where leave is configured, the answer was "a different page
 * from where attendance is configured", which is why they moved.
 *
 * /leave keeps what it is for: asking for leave, and answering those asks.
 *
 * One deliberate gain from the move. Default days per year could only ever be
 * set at the moment a type was created and was uneditable afterwards - the
 * clinic's four types were stuck with whatever March chose. Here it is an
 * ordinary field with a Save button, like every other setting on this tab.
 */

interface LeaveTypeRow {
  id: string;
  name: string;
  description: string | null;
  default_days_per_year: number | string | null;
  accrual: string | null;
  is_active: boolean | null;
}

interface BalanceRow {
  id: string;
  staff_id: string;
  leave_type_id: string;
  year: number;
  opening_balance: number | string;
  used: number | string;
  staff?: { first_name?: string | null; last_name?: string | null } | null;
  leave_types?: { name?: string | null } | null;
}

interface StaffRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean | null;
}

function useLeaveTypes() {
  return useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_types").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as LeaveTypeRow[];
    },
  });
}

/* ────────────────────────────── Leave types ───────────────────────────── */

export function LeaveTypesCard() {
  const queryClient = useQueryClient();
  const { data: leaveTypes = [], isLoading } = useLeaveTypes();

  /**
   * Edits in hand, keyed by row id.
   *
   * Only what somebody actually touched goes in here, so Save writes only
   * those rows. An admin fixing one type's day count does not rewrite the
   * other three and does not stamp updated_at across the table.
   */
  const [draft, setDraft] = useState<Record<string, { days?: number; accrual?: LeaveAccrual }>>({});
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [days, setDays] = useState(0);
  const [accrual, setAccrual] = useState<LeaveAccrual>("yearly");

  const valueOf = (t: LeaveTypeRow) => ({
    days: draft[t.id]?.days ?? Number(t.default_days_per_year ?? 0),
    accrual: draft[t.id]?.accrual ?? accrualOf(t),
  });

  const edit = (id: string, patch: { days?: number; accrual?: LeaveAccrual }) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const dirty = Object.keys(draft).filter((id) => {
    const row = leaveTypes.find((t) => t.id === id);
    if (!row) return false;
    const v = valueOf(row);
    return v.days !== Number(row.default_days_per_year ?? 0) || v.accrual !== accrualOf(row);
  });

  const save = async () => {
    setSaving(true);
    try {
      for (const id of dirty) {
        const row = leaveTypes.find((t) => t.id === id)!;
        const v = valueOf(row);
        // .select() matters. A row-level-security refusal on an UPDATE is
        // not an error - Postgres simply matches no rows - so without asking
        // for the changed row back, a non-admin would be told "saved" while
        // nothing was.
        const { data, error } = await supabase
          .from("leave_types")
          .update({ default_days_per_year: v.days, accrual: v.accrual } as never)
          .eq("id", id)
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Nothing was saved. Changing leave types needs an Admin role.");
        }
      }
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      toast.success(dirty.length === 1 ? "Leave type saved" : `${dirty.length} leave types saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save leave types");
    } finally {
      setSaving(false);
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Give the leave type a name");
      const { error } = await supabase.from("leave_types").insert({
        name: name.trim(),
        description: desc.trim() || null,
        default_days_per_year: days,
        accrual,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      toast.success("Leave type created");
      setName(""); setDesc(""); setDays(0); setAccrual("yearly"); setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="max-w-2xl" data-testid="leave-types-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg">Leave types</CardTitle>
          <CardDescription>
            What each kind of leave is worth, and whether it arrives all at once or month by month.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 shrink-0" data-testid="add-leave-type">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="font-display">New leave type</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Name *</Label>
                <Input className="mt-1.5" placeholder="e.g. Casual Leave" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea className="mt-1.5" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>
              <div>
                <Label>Days per year</Label>
                <Input
                  type="number" min={0} className="mt-1.5"
                  value={numVal(days)}
                  onChange={(e) => setDays(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>How it is given</Label>
                <Select value={accrual} onValueChange={(v) => setAccrual(v as LeaveAccrual)}>
                  <SelectTrigger className="mt-1.5" data-testid="lt-accrual"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCRUAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {accrualLabel({ default_days_per_year: days, accrual })}
                </p>
              </div>
              <Button className="w-full" onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
                {create.isPending ? "Creating..." : "Create leave type"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading leave types…</p>
        ) : leaveTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No leave types yet. Add one and it becomes available on the Leave page.
          </p>
        ) : leaveTypes.map((t) => {
          const v = valueOf(t);
          return (
            <SettingRow
              key={t.id}
              label={t.name}
              hint={t.description || accrualLabel({ default_days_per_year: v.days, accrual: v.accrual })}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} className="w-20"
                  aria-label={`${t.name} days per year`}
                  data-testid={`days-${t.id}`}
                  value={numVal(v.days)}
                  onChange={(e) => edit(t.id, { days: parseFloat(e.target.value) || 0 })}
                />
                <Select
                  value={v.accrual}
                  onValueChange={(val) => edit(t.id, { accrual: val as LeaveAccrual })}
                >
                  <SelectTrigger className="w-56" data-testid={`accrual-${t.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCRUAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SettingRow>
          );
        })}

        <Button onClick={save} disabled={saving || dirty.length === 0} data-testid="save-leave-types">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save leave types
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────── Allowances ───────────────────────────── */

export function LeaveAllowancesCard() {
  const queryClient = useQueryClient();
  const { data: leaveTypes = [] } = useLeaveTypes();

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, first_name, last_name, is_active")
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as unknown as StaffRow[];
    },
  });

  const { data: balances = [] } = useQuery({
    queryKey: ["leave-balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_leave_balances")
        .select("*, staff(first_name, last_name), leave_types(name)")
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BalanceRow[];
    },
  });

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [balStaffId, setBalStaffId] = useState("");
  const [balLeaveTypeId, setBalLeaveTypeId] = useState("");
  const [balYear, setBalYear] = useState(new Date().getFullYear());
  const [balOpening, setBalOpening] = useState(0);

  /**
   * What Update allowances would do, before it does it.
   *
   * This writes a row per active person per leave type - 72 of them on
   * today's data - so the figures are shown first. The clinic's Maternity
   * Leave is 180 days a year and active: seeing "180 days each, to 18
   * people" is how somebody catches that before it is a balance everybody
   * can apply against, rather than after.
   */
  const allowancePreview = useMemo(() => {
    const year = new Date().getFullYear();
    const people = staffList.filter((p) => p.is_active !== false).length;
    const rows = leaveTypes
      .filter((t) => t.is_active !== false)
      .map((t) => ({ id: t.id, name: t.name, days: entitlementToDate(t, year) }));
    return {
      year, people,
      grants: rows.filter((r) => r.days > 0),
      skipped: rows.filter((r) => r.days <= 0),
    };
  }, [staffList, leaveTypes]);

  /**
   * Give everybody what their leave types say they are owed.
   *
   * default_days_per_year has been on leave_types since March with nothing
   * acting on it: 0 of 18 active staff had a balance while Casual Leave
   * said 12 a year. This is the thing that makes that number mean something.
   *
   * Safe to press repeatedly, and that is the point for a monthly type - it
   * is how the accrual arrives. toppedUpBalance never lowers a figure, so
   * running it in March cannot take back days an admin granted by hand in
   * February.
   */
  const topUpAllowances = useMutation({
    mutationFn: async () => {
      const year = new Date().getFullYear();
      const people = staffList.filter((p) => p.is_active !== false);
      const types = leaveTypes.filter((t) => t.is_active !== false);
      if (people.length === 0 || types.length === 0) {
        throw new Error("There is nobody, or no leave type, to grant.");
      }

      // Read afresh rather than trust the cached card. There is a UNIQUE
      // (staff_id, leave_type_id, year) on this table, so a row the cache had
      // not seen would fail the whole insert; and an upsert is not the answer
      // either, because it would carry `used: 0` over somebody's taken leave.
      const { data: current, error: readError } = await supabase
        .from("staff_leave_balances")
        .select("id, staff_id, leave_type_id, year, opening_balance")
        .eq("year", year);
      if (readError) throw readError;
      const existing = new Map(
        (current ?? []).map((b) => [`${b.staff_id}:${b.leave_type_id}`, b]),
      );

      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; opening_balance: number }[] = [];

      for (const person of people) {
        for (const type of types) {
          const entitled = entitlementToDate(type, year);
          if (entitled <= 0) continue;
          const row = existing.get(`${person.id}:${type.id}`);
          if (!row) {
            toInsert.push({
              staff_id: person.id, leave_type_id: type.id, year,
              opening_balance: entitled, used: 0,
            });
          } else if (needsTopUp(row.opening_balance, entitled)) {
            toUpdate.push({ id: row.id, opening_balance: toppedUpBalance(row.opening_balance, entitled) });
          }
        }
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("staff_leave_balances").insert(toInsert as never);
        if (error) throw error;
      }
      // One at a time, and `used` is never sent: an upsert would carry a
      // stale used figure back over somebody's approved leave.
      for (const row of toUpdate) {
        const { error } = await supabase
          .from("staff_leave_balances")
          .update({ opening_balance: row.opening_balance })
          .eq("id", row.id);
        if (error) throw error;
      }
      return { granted: toInsert.length, toppedUp: toUpdate.length };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      setTopUpOpen(false);
      toast.success(
        r.granted === 0 && r.toppedUp === 0
          ? "Everybody is already up to date"
          : `${r.granted} granted, ${r.toppedUp} topped up`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createBalance = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff_leave_balances").insert({
        staff_id: balStaffId,
        leave_type_id: balLeaveTypeId,
        year: balYear,
        opening_balance: balOpening,
        used: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      toast.success("Leave balance granted");
      setBalStaffId(""); setBalLeaveTypeId(""); setBalOpening(0); setGrantOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="max-w-2xl" data-testid="leave-allowances-card">
      <CardHeader>
        <CardTitle className="text-lg">Leave allowances</CardTitle>
        <CardDescription>
          What each person has been given for the year, and what they have taken of it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="top-up-allowances">
                <RefreshCw className="h-4 w-4" /> Update allowances
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Update allowances for {allowancePreview.year}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2" data-testid="top-up-preview">
                <p className="text-sm text-muted-foreground">
                  Every active person gets at least what each leave type says
                  they are owed so far this year. An existing balance is only
                  ever raised, never lowered, and days already taken are left
                  alone - so this is safe to run again next month.
                </p>
                <div className="rounded-lg border divide-y">
                  {allowancePreview.grants.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      No leave type grants anything yet. Set Days per year above first.
                    </p>
                  ) : allowancePreview.grants.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <span>{g.name}</span>
                      <span className="font-medium whitespace-nowrap">
                        {g.days} day{g.days === 1 ? "" : "s"} each
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  To {allowancePreview.people} active staff.
                  {allowancePreview.skipped.length > 0 && (
                    <> Skipped, because they are granted by hand: {allowancePreview.skipped.map((t) => t.name).join(", ")}.</>
                  )}
                </p>
                <Button
                  className="w-full"
                  data-testid="confirm-top-up"
                  disabled={topUpAllowances.isPending || allowancePreview.grants.length === 0}
                  onClick={() => topUpAllowances.mutate()}
                >
                  {topUpAllowances.isPending ? "Updating..." : "Update allowances"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="grant-balance">
                <Plus className="h-4 w-4" /> Grant to one person
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle className="font-display">Grant leave balance</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Staff *</Label>
                  <Select value={balStaffId} onValueChange={setBalStaffId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {staffList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Leave type *</Label>
                  <Select value={balLeaveTypeId} onValueChange={setBalLeaveTypeId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((lt) => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Year</Label>
                    <Input type="number" className="mt-1.5" value={numVal(balYear)} onChange={(e) => setBalYear(parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label>Opening days *</Label>
                    <Input type="number" className="mt-1.5" value={numVal(balOpening)} onChange={(e) => setBalOpening(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createBalance.mutate()}
                  disabled={!balStaffId || !balLeaveTypeId || balOpening <= 0 || createBalance.isPending}
                >
                  {createBalance.isPending ? "Saving..." : "Grant balance"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="data-table max-h-[26rem] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Leave type</TableHead>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nobody has an allowance yet. Update allowances grants everyone theirs at once.
                  </TableCell>
                </TableRow>
              ) : balances.map((bal) => (
                <TableRow key={bal.id}>
                  <TableCell className="font-medium">{bal.staff?.first_name} {bal.staff?.last_name}</TableCell>
                  <TableCell>{bal.leave_types?.name}</TableCell>
                  <TableCell>{bal.year}</TableCell>
                  <TableCell className="text-right font-medium">{bal.opening_balance}</TableCell>
                  <TableCell className="text-right text-destructive">{bal.used}</TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    {Number(bal.opening_balance) - Number(bal.used)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
