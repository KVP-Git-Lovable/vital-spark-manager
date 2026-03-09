import { useState } from "react";
import { Search, Filter, Download, IndianRupee, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  Paid: "bg-success/10 text-success",
  Partial: "bg-warning/10 text-warning",
  Pending: "bg-destructive/10 text-destructive",
};

const Billing = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Form state
  const [patientId, setPatientId] = useState("");
  const [serviceInputs, setServiceInputs] = useState<string[]>([""]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentType, setPaymentType] = useState("One-time");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("id, first_name, last_name").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () => {
      const services = serviceInputs.filter((s) => s.trim());
      if (services.length === 0) throw new Error("Add at least one service");

      const patient = patients.find((p) => p.id === patientId);
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : null;
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

      let status = "Pending";
      if (paidAmount >= totalAmount && totalAmount > 0) status = "Paid";
      else if (paidAmount > 0) status = "Partial";

      const { error } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        patient_id: patientId || null,
        patient_name: patientName,
        services,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        status,
        payment_type: paymentType,
        payment_mode: paymentMode,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice created successfully");
      resetForm();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setPatientId("");
    setServiceInputs([""]);
    setTotalAmount(0);
    setPaidAmount(0);
    setPaymentType("One-time");
    setPaymentMode("Cash");
    setNotes("");
  };

  const addServiceInput = () => setServiceInputs([...serviceInputs, ""]);
  const updateServiceInput = (i: number, val: string) => {
    const updated = [...serviceInputs];
    updated[i] = val;
    setServiceInputs(updated);
  };
  const removeServiceInput = (i: number) => setServiceInputs(serviceInputs.filter((_, idx) => idx !== i));

  const totalRevenue = invoices.reduce((s: number, inv: any) => s + Number(inv.paid_amount), 0);
  const pendingAmount = invoices.filter((i: any) => i.status === "Pending").reduce((s: number, inv: any) => s + Number(inv.total_amount), 0);
  const partialAmount = invoices.filter((i: any) => i.status === "Partial").reduce((s: number, inv: any) => s + (Number(inv.total_amount) - Number(inv.paid_amount)), 0);

  const filtered = invoices.filter((inv: any) => {
    const q = search.toLowerCase();
    return inv.invoice_number?.toLowerCase().includes(q) || inv.patient_name?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">Manage invoices and payments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-fit">
              <IndianRupee className="h-4 w-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Create Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Patient</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Services</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={addServiceInput}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {serviceInputs.map((s, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input placeholder="Service name" value={s} onChange={(e) => updateServiceInput(i, e.target.value)} />
                    {serviceInputs.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive text-xs shrink-0" onClick={() => removeServiceInput(i)}>✕</Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Total Amount (₹) *</Label>
                  <Input type="number" className="mt-1.5" value={totalAmount} onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Paid Amount (₹)</Label>
                  <Input type="number" className="mt-1.5" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["One-time", "Staged", "Recurring"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Cash", "Card", "UPI", "Insurance", "Bank Transfer"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea className="mt-1.5" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>

              <Button className="w-full" onClick={() => createInvoice.mutate()} disabled={totalAmount <= 0 || createInvoice.isPending}>
                {createInvoice.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} change="All time" icon={IndianRupee} iconColor="bg-success/10 text-success" />
        <StatCard title="Pending" value={`₹${pendingAmount.toLocaleString()}`} change={`${invoices.filter((i: any) => i.status === "Pending").length} invoice(s)`} icon={IndianRupee} iconColor="bg-destructive/10 text-destructive" delay={0.05} />
        <StatCard title="Partial Payments" value={`₹${partialAmount.toLocaleString()}`} change={`${invoices.filter((i: any) => i.status === "Partial").length} invoice(s)`} icon={IndianRupee} iconColor="bg-warning/10 text-warning" delay={0.1} />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }} className="data-table">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." className="pl-9 bg-muted border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2"><Filter className="h-3.5 w-3.5" />Filter</Button>
            <Button variant="outline" size="sm" className="gap-2"><Download className="h-3.5 w-3.5" />Export</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Invoice</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Patient</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Services</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden sm:table-cell">Type</th>
                <th className="text-right text-xs font-medium text-muted-foreground p-4">Amount</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No invoices found</td></tr>
              ) : (
                filtered.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="p-4">
                      <p className="font-medium text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="p-4 text-sm">{inv.patient_name || "—"}</td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(inv.services || []).map((s: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">{inv.payment_type}</Badge>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-semibold text-sm">₹{Number(inv.total_amount).toLocaleString()}</p>
                      {inv.status === "Partial" && (
                        <p className="text-xs text-muted-foreground">Paid: ₹{Number(inv.paid_amount).toLocaleString()}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[inv.status] || ""}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Billing;
