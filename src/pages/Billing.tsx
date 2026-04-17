import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, addMonths } from "date-fns";
import { Search, Filter, Download, IndianRupee, Plus, FileText, CreditCard, Pill, Trash2, CalendarClock, Eye, Pencil, X, ChevronDown, Check, ChevronsUpDown } from "lucide-react";
import { AppointmentDetailSheet } from "@/components/appointments/AppointmentDetailSheet";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const statusStyles: Record<string, string> = {
  Paid: "bg-success/10 text-success",
  Partial: "bg-warning/10 text-warning",
  Pending: "bg-destructive/10 text-destructive",
  Overdue: "bg-destructive/10 text-destructive",
};

// ─── PDF Generation ───────────────────────────────
const generateInvoicePDF = (inv: any) => {
  const date = new Date(inv.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  const balance = Number(inv.total_amount) - Number(inv.paid_amount);
  const drName = inv.appointments?.staff ? `Dr. ${inv.appointments.staff.first_name} ${inv.appointments.staff.last_name}` : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #0d9488; padding-bottom: 20px; }
  .logo { font-size: 24px; font-weight: 700; color: #0d9488; }
  .logo span { font-size: 12px; display: block; color: #666; font-weight: 400; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 28px; color: #0d9488; text-transform: uppercase; letter-spacing: 2px; }
  .invoice-title p { font-size: 13px; color: #666; margin-top: 4px; }
  .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .details-block h3 { font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 1px; margin-bottom: 6px; }
  .details-block p { font-size: 14px; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #f0fdfa; color: #0d9488; text-align: left; padding: 12px 16px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #0d9488; }
  td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #eee; }
  .amount-col { text-align: right; }
  .summary { display: flex; justify-content: flex-end; }
  .summary-table { width: 280px; }
  .summary-table tr td { padding: 8px 16px; font-size: 14px; border: none; }
  .summary-table tr:last-child td { font-weight: 700; font-size: 16px; border-top: 2px solid #0d9488; color: #0d9488; padding-top: 12px; }
  .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .status-Paid { background: #dcfce7; color: #16a34a; }
  .status-Partial { background: #fef3c7; color: #d97706; }
  .status-Pending { background: #fee2e2; color: #dc2626; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">DermaCare<span>Clinic Manager</span></div>
    <div class="invoice-title">
      <h1>Invoice</h1>
      <p>${inv.invoice_number}</p>
    </div>
  </div>
  <div class="details">
    <div class="details-block">
      <h3>Bill To</h3>
      <p><strong>${inv.patient_name || "Walk-in Patient"}</strong></p>
      ${drName ? `<p style="margin-top:4px;">Doctor: ${drName}</p>` : ""}
    </div>
    <div class="details-block" style="text-align:right;">
      <h3>Invoice Details</h3>
      <p>Date: ${date}</p>
      <p>Payment: ${inv.payment_mode || "Cash"}</p>
      <p>Type: ${inv.payment_type || "One-time"}</p>
      <p style="margin-top:6px;"><span class="status-badge status-${inv.status}">${inv.status}</span></p>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Service</th><th class="amount-col">Amount</th></tr></thead>
    <tbody>
      ${(inv.services || []).map((s: string, i: number) => `<tr><td>${i + 1}</td><td>${s}</td><td class="amount-col">—</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="summary">
    <table class="summary-table">
      <tr><td>Total Amount</td><td class="amount-col">₹${Number(inv.total_amount).toLocaleString("en-IN")}</td></tr>
      <tr><td>Paid Amount</td><td class="amount-col">₹${Number(inv.paid_amount).toLocaleString("en-IN")}</td></tr>
      <tr><td>Balance Due</td><td class="amount-col">₹${balance.toLocaleString("en-IN")}</td></tr>
    </table>
  </div>
  ${inv.notes ? `<div style="margin-top:20px;padding:12px 16px;background:#f9fafb;border-radius:8px;font-size:13px;"><strong>Notes:</strong> ${inv.notes}</div>` : ""}
  <div class="footer">
    <p>Thank you for choosing DermaCare Clinic</p>
    <p style="margin-top:4px;">This is a computer-generated invoice.</p>
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  }
};

// ─── Types ────────────────────────────────────────
interface StageRow { label: string; amount: number; paid: number; }
interface PharmaLineItem {
  inventory_id: string;
  product_id: string;
  product_name: string;
  batch_number: string;
  quantity: number;
  unit_price: number;
  available: number;
}

const getDrName = (inv: any) => {
  if (inv.appointments?.doctors) {
    return `Dr. ${inv.appointments.doctors.name}`;
  }
  return "";
};

const Billing = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentInv, setPaymentInv] = useState<any>(null);
  const [addPaymentAmount, setAddPaymentAmount] = useState(0);
  const [addPaymentMode, setAddPaymentMode] = useState("Cash");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  // View/Edit Sheet
  const [viewInvoice, setViewInvoice] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Form state
  const [patientId, setPatientId] = useState("");
  const [serviceInputs, setServiceInputs] = useState<{ name: string; price: number }[]>([{ name: "", price: 0 }]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentType, setPaymentType] = useState("One-time");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [selectedTaxId, setSelectedTaxId] = useState("");
  const [pharmaItems, setPharmaItems] = useState<PharmaLineItem[]>([]);

  const [stages, setStages] = useState<StageRow[]>([{ label: "Stage 1", amount: 0, paid: 0 }]);
  const [recurringCount, setRecurringCount] = useState(1);
  const [recurringAmount, setRecurringAmount] = useState(0);
  const [recurringCollected, setRecurringCollected] = useState<number[]>([0]);
  const [recurringTotalAmount, setRecurringTotalAmount] = useState(0);
  const [recurringDueDates, setRecurringDueDates] = useState<Date[]>([new Date()]);
  const [recurringStatuses, setRecurringStatuses] = useState<string[]>(["Pending"]);
  const [serviceSearchOpen, setServiceSearchOpen] = useState<number | null>(null);

  const handleRecurringCountChange = (count: number) => {
    const c = Math.max(1, count);
    setRecurringCount(c);
    setRecurringCollected((prev) => {
      const arr = [...prev];
      while (arr.length < c) arr.push(0);
      return arr.slice(0, c);
    });
    setRecurringDueDates((prev) => {
      const arr = [...prev];
      const baseDate = arr[0] || new Date();
      while (arr.length < c) arr.push(addMonths(baseDate, arr.length));
      return arr.slice(0, c);
    });
    setRecurringStatuses((prev) => {
      const arr = [...prev];
      while (arr.length < c) arr.push("Pending");
      return arr.slice(0, c);
    });
    if (recurringTotalAmount > 0) {
      setRecurringAmount(Math.round((recurringTotalAmount / c) * 100) / 100);
    }
  };

  const handleRecurringTotalChange = (total: number) => {
    setRecurringTotalAmount(total);
    if (recurringCount > 0) {
      setRecurringAmount(Math.round((total / recurringCount) * 100) / 100);
    }
  };

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, appointments(id, service, start_time, staff_id, doctors:staff_id(name))")
        .order("created_at", { ascending: false });
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

  const { data: taxes = [] } = useQuery({
    queryKey: ["tax-master-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tax_master").select("*").eq("is_active", true).order("rate");
      if (error) throw error;
      return data;
    },
  });

  const { data: pharmaProducts = [] } = useQuery({
    queryKey: ["pharma-products-billing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharma_products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: serviceMaster = [] } = useQuery({
    queryKey: ["services-master-billing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name, price").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: pharmaInventory = [] } = useQuery({
    queryKey: ["pharma-inventory-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharma_inventory")
        .select("*, pharma_products(name, selling_price)")
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Pre-fill from Appointments flow
  useEffect(() => {
    const prefillPatient = searchParams.get("prefillPatient");
    const prefillService = searchParams.get("prefillService");
    if (prefillPatient || prefillService) {
      if (prefillPatient) setPatientId(prefillPatient);
      if (prefillService) {
        setServiceInputs([prefillService]);
        // Auto-fill price from service master
        const svc = serviceMaster.find((s: any) => s.name === prefillService);
        if (svc) setTotalAmount(svc.price || 0);
      }
      setPaymentType("Recurring");
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, serviceMaster]);

  // Unique doctors and services for filter dropdowns
  const uniqueDoctors = useMemo(() => {
    const docs = new Map<string, string>();
    invoices.forEach((inv: any) => {
      const name = getDrName(inv);
      if (name) docs.set(inv.appointments?.staff_id, name);
    });
    return Array.from(docs.entries());
  }, [invoices]);

  const uniqueServices = useMemo(() => {
    const svcs = new Set<string>();
    invoices.forEach((inv: any) => (inv.services || []).forEach((s: string) => svcs.add(s)));
    return Array.from(svcs).sort();
  }, [invoices]);

  const getSelectedTax = () => taxes.find((t: any) => t.id === selectedTaxId);
  const getTaxComponents = (tax: any) => {
    if (!tax) return { cgst: 0, sgst: 0, igst: 0, total: 0 };
    const cgst = Number(tax.cgst) || 0;
    const sgst = Number(tax.sgst) || 0;
    const igst = Number(tax.igst) || 0;
    const total = cgst + sgst + igst || Number(tax.rate) || 0;
    return { cgst, sgst, igst, total };
  };
  const calcTaxAmount = (amount: number) => {
    const { total } = getTaxComponents(getSelectedTax());
    return (amount * total) / 100;
  };

  const pharmaSubtotal = pharmaItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const servicesSubtotal = useMemo(() => serviceInputs.reduce((sum, s) => sum + (Number(s.price) || 0), 0), [serviceInputs]);

  const addPharmaItem = () => {
    setPharmaItems([...pharmaItems, { inventory_id: "", product_id: "", product_name: "", batch_number: "", quantity: 1, unit_price: 0, available: 0 }]);
  };

  // Get unique products from inventory
  const pharmaProductOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of pharmaInventory as any[]) {
      if (i.quantity > 0 && new Date(i.expiry_date) > new Date() && i.pharma_products?.name) {
        map.set(i.product_id, i.pharma_products.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [pharmaInventory]);

  const updatePharmaItem = (idx: number, field: string, value: any) => {
    const updated = [...pharmaItems];
    (updated[idx] as any)[field] = value;
    if (field === "product_id") {
      // Reset batch when product changes
      updated[idx].product_id = value;
      const prod = pharmaProductOptions.find(p => p.id === value);
      updated[idx].product_name = prod?.name || "";
      updated[idx].inventory_id = "";
      updated[idx].batch_number = "";
      updated[idx].unit_price = 0;
      updated[idx].available = 0;
    }
    if (field === "inventory_id") {
      const inv = pharmaInventory.find((i: any) => i.id === value) as any;
      if (inv) {
        updated[idx].batch_number = inv.batch_number;
        updated[idx].unit_price = inv.pharma_products?.selling_price || 0;
        updated[idx].available = inv.quantity;
      }
    }
    setPharmaItems(updated);
  };

  const removePharmaItem = (idx: number) => setPharmaItems(pharmaItems.filter((_, i) => i !== idx));

  const createInvoice = useMutation({
    mutationFn: async () => {
      const services = serviceInputs.filter((s) => s.trim());
      const pharmaServiceNames = pharmaItems.filter(i => i.product_name).map(i => `${i.product_name} x${i.quantity}`);
      const allServices = [...services, ...pharmaServiceNames];
      if (allServices.length === 0) throw new Error("Add at least one service or product");

      const patient = patients.find((p) => p.id === patientId);
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : null;
      const baseNum = Date.now().toString().slice(-6);
      const tax = getSelectedTax();
      const { cgst: cgstPct, sgst: sgstPct, igst: igstPct, total: taxRate } = getTaxComponents(tax);
      const splitTax = (base: number) => ({
        cgst_amount: (base * cgstPct) / 100,
        sgst_amount: (base * sgstPct) / 100,
        igst_amount: (base * igstPct) / 100,
        tax_amount: (base * taxRate) / 100,
      });

      if (paymentType === "Staged") {
        const rows = stages.map((stage, i) => {
          const t = splitTax(stage.amount);
          const stageTotal = stage.amount + t.tax_amount;
          let status = "Pending";
          if (stage.paid >= stageTotal && stageTotal > 0) status = "Paid";
          else if (stage.paid > 0) status = "Partial";
          return {
            invoice_number: `INV-${baseNum}-S${i + 1}`,
            patient_id: patientId || null,
            patient_name: patientName,
            services: allServices,
            total_amount: stageTotal,
            paid_amount: stage.paid,
            status,
            payment_type: "Staged",
            payment_mode: paymentMode,
            notes: `${stage.label}${notes ? ` — ${notes}` : ""}`,
            tax_id: selectedTaxId || null,
            tax_rate: taxRate,
            ...t,
          };
        });
        const { error } = await supabase.from("invoices").insert(rows);
        if (error) throw error;
      } else if (paymentType === "Recurring") {
        const t = splitTax(recurringAmount);
        const totalPerInst = recurringAmount + t.tax_amount;
        const rows = Array.from({ length: recurringCount }, (_, i) => {
          const collected = recurringCollected[i] || 0;
          const instStatus = recurringStatuses[i] || "Pending";
          let status = instStatus;
          if (collected >= totalPerInst && totalPerInst > 0) status = "Paid";
          else if (collected > 0 && instStatus === "Pending") status = "Partial";
          const dueDate = recurringDueDates[i] || addMonths(new Date(), i);
          return {
            invoice_number: `INV-${baseNum}-R${i + 1}`,
            patient_id: patientId || null,
            patient_name: patientName,
            services: allServices,
            total_amount: totalPerInst,
            paid_amount: collected,
            status,
            payment_type: "Recurring",
            payment_mode: paymentMode,
            notes: `Installment ${i + 1} of ${recurringCount} | Due: ${format(dueDate, "dd MMM yyyy")}${notes ? ` — ${notes}` : ""}`,
            tax_id: selectedTaxId || null,
            tax_rate: taxRate,
            ...t,
          };
        });
        const { error } = await supabase.from("invoices").insert(rows);
        if (error) throw error;
      } else {
        const combinedSubtotal = totalAmount + pharmaSubtotal;
        const t = splitTax(combinedSubtotal);
        const grandTotal = combinedSubtotal + t.tax_amount;
        let status = "Pending";
        if (paidAmount >= grandTotal && grandTotal > 0) status = "Paid";
        else if (paidAmount > 0) status = "Partial";

        const { error } = await supabase.from("invoices").insert({
          invoice_number: `INV-${baseNum}`,
          patient_id: patientId || null,
          patient_name: patientName,
          services: allServices,
          total_amount: grandTotal,
          paid_amount: paidAmount,
          status,
          payment_type: "One-time",
          payment_mode: paymentMode,
          notes: notes || null,
          tax_id: selectedTaxId || null,
          tax_rate: taxRate,
          ...t,
        });
        if (error) throw error;
      }

      for (const item of pharmaItems) {
        if (item.inventory_id && item.quantity > 0) {
          const invRecord = pharmaInventory.find((inv: any) => inv.id === item.inventory_id) as any;
          if (invRecord) {
            await supabase.from("pharma_inventory").update({
              quantity: Math.max(0, invRecord.quantity - item.quantity)
            }).eq("id", item.inventory_id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["pharma-inventory-billing"] });
      const msg = paymentType === "Staged" ? `${stages.length} staged invoices created` : paymentType === "Recurring" ? `${recurringCount} recurring invoices created` : "Invoice created";
      toast.success(msg);
      resetForm();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePayment = useMutation({
    mutationFn: async () => {
      if (!paymentInv) return;
      const newPaid = Number(paymentInv.paid_amount) + addPaymentAmount;
      const total = Number(paymentInv.total_amount);
      let status = "Partial";
      if (newPaid >= total) status = "Paid";
      else if (newPaid <= 0) status = "Pending";

      const { error } = await supabase.from("invoices").update({
        paid_amount: Math.min(newPaid, total),
        status,
        payment_mode: addPaymentMode,
      }).eq("id", paymentInv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Payment updated");
      setPaymentInv(null);
      setAddPaymentAmount(0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAsPaid = useMutation({
    mutationFn: async (inv: any) => {
      const { error } = await supabase.from("invoices").update({
        paid_amount: inv.total_amount,
        status: "Paid",
      }).eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice marked as paid");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
      setViewInvoice(null);
      setIsEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateInvoice = useMutation({
    mutationFn: async () => {
      if (!viewInvoice) return;
      const newPaid = Number(editData.paid_amount);
      const newTotal = Number(editData.total_amount);
      let status = "Pending";
      if (newPaid >= newTotal && newTotal > 0) status = "Paid";
      else if (newPaid > 0) status = "Partial";

      const { error } = await supabase.from("invoices").update({
        patient_name: editData.patient_name,
        total_amount: newTotal,
        paid_amount: newPaid,
        payment_mode: editData.payment_mode,
        payment_type: editData.payment_type,
        notes: editData.notes || null,
        status,
      }).eq("id", viewInvoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice updated");
      setIsEditing(false);
      setViewInvoice(null);
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
    setSelectedTaxId("");
    setPharmaItems([]);
    setStages([{ label: "Stage 1", amount: 0, paid: 0 }]);
    setRecurringCount(1);
    setRecurringAmount(0);
    setRecurringCollected([0]);
    setRecurringTotalAmount(0);
    setRecurringDueDates([new Date()]);
    setRecurringStatuses(["Pending"]);
    setServiceSearchOpen(null);
  };

  const addServiceInput = () => setServiceInputs([...serviceInputs, ""]);
  const updateServiceInput = (i: number, val: string) => {
    const updated = [...serviceInputs];
    updated[i] = val;
    setServiceInputs(updated);
  };
  const removeServiceInput = (i: number) => setServiceInputs(serviceInputs.filter((_, idx) => idx !== i));

  const addStage = () => setStages([...stages, { label: `Stage ${stages.length + 1}`, amount: 0, paid: 0 }]);
  const updateStage = (i: number, field: keyof StageRow, value: string | number) => {
    const updated = [...stages];
    (updated[i] as any)[field] = value;
    setStages(updated);
  };
  const removeStage = (i: number) => setStages(stages.filter((_, idx) => idx !== i));

  const canCreateInvoice = () => {
    const hasServices = serviceInputs.some(s => s.trim());
    const hasPharma = pharmaItems.some(i => i.inventory_id && i.quantity > 0);
    const hasLineItems = hasServices || hasPharma;
    if (!hasLineItems) return false;
    if (paymentType === "Staged") return stages.some((s) => s.amount > 0);
    if (paymentType === "Recurring") return recurringCount > 0 && recurringAmount > 0;
    return (totalAmount + pharmaSubtotal) > 0;
  };

  const totalRevenue = invoices.reduce((s: number, inv: any) => s + Number(inv.paid_amount), 0);
  const pendingAmount = invoices.filter((i: any) => i.status === "Pending").reduce((s: number, inv: any) => s + Number(inv.total_amount), 0);
  const partialAmount = invoices.filter((i: any) => i.status === "Partial").reduce((s: number, inv: any) => s + (Number(inv.total_amount) - Number(inv.paid_amount)), 0);

  // Full-text search + filters
  const filtered = useMemo(() => {
    return invoices.filter((inv: any) => {
      const q = search.toLowerCase();
      if (q) {
        const drName = getDrName(inv).toLowerCase();
        const servicesStr = (inv.services || []).join(" ").toLowerCase();
        const searchFields = [
          inv.invoice_number,
          inv.patient_name,
          servicesStr,
          inv.payment_type,
          inv.payment_mode,
          drName,
        ].join(" ").toLowerCase();
        if (!searchFields.includes(q)) return false;
      }

      // Date filter
      if (filterDateFrom || filterDateTo) {
        const invDate = new Date(inv.created_at);
        if (filterDateFrom && invDate < startOfDay(filterDateFrom)) return false;
        if (filterDateTo && invDate > endOfDay(filterDateTo)) return false;
      }

      // Doctor filter
      if (filterDoctor) {
        const staffId = inv.appointments?.staff_id;
        if (staffId !== filterDoctor) return false;
      }

      // Service filter
      if (filterService) {
        if (!(inv.services || []).some((s: string) => s === filterService)) return false;
      }

      // Type filter
      if (filterType && inv.payment_type !== filterType) return false;

      // Status filter
      if (filterStatus && inv.status !== filterStatus) return false;

      return true;
    });
  }, [invoices, search, filterDateFrom, filterDateTo, filterDoctor, filterService, filterType, filterStatus]);

  const hasActiveFilters = filterDateFrom || filterDateTo || filterDoctor || filterService || filterType || filterStatus;

  const clearFilters = () => {
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterDoctor("");
    setFilterService("");
    setFilterType("");
    setFilterStatus("");
  };

  // CSV Export
  const exportCSV = () => {
    const headers = ["Invoice", "Date", "Patient", "Doctor", "Services", "Type", "Mode", "Total", "Paid", "Balance", "Status"];
    const rows = filtered.map((inv: any) => [
      inv.invoice_number,
      format(new Date(inv.created_at), "yyyy-MM-dd"),
      inv.patient_name || "",
      getDrName(inv),
      (inv.services || []).join("; "),
      inv.payment_type,
      inv.payment_mode || "",
      Number(inv.total_amount),
      Number(inv.paid_amount),
      Number(inv.total_amount) - Number(inv.paid_amount),
      inv.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} invoices`);
  };

  const stagedTotal = stages.reduce((s, st) => s + st.amount, 0);
  const stagedPaid = stages.reduce((s, st) => s + st.paid, 0);
  const recurringTotal = recurringCount * recurringAmount;
  const recurringPaidTotal = recurringCollected.reduce((s, c) => s + c, 0);

  const openViewSheet = (inv: any) => {
    setViewInvoice(inv);
    setIsEditing(false);
    setEditData({
      patient_name: inv.patient_name || "",
      total_amount: inv.total_amount,
      paid_amount: inv.paid_amount,
      payment_mode: inv.payment_mode || "Cash",
      payment_type: inv.payment_type || "One-time",
      notes: inv.notes || "",
    });
  };

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
                    <Popover open={serviceSearchOpen === i} onOpenChange={(open) => setServiceSearchOpen(open ? i : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10">
                          {s || <span className="text-muted-foreground">Select service...</span>}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search services..." />
                          <CommandList>
                            <CommandEmpty>No service found.</CommandEmpty>
                            <CommandGroup>
                              {serviceMaster.map((svc: any) => (
                                <CommandItem key={svc.id} value={svc.name} onSelect={() => { updateServiceInput(i, svc.name); setServiceSearchOpen(null); }}>
                                  <Check className={cn("mr-2 h-4 w-4", s === svc.name ? "opacity-100" : "opacity-0")} />
                                  <span>{svc.name}</span>
                                  <span className="ml-auto text-xs text-muted-foreground">₹{svc.price}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {serviceInputs.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive text-xs shrink-0" onClick={() => removeServiceInput(i)}>✕</Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Pharma Products */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="flex items-center gap-1.5"><Pill className="h-3.5 w-3.5" /> Pharma Products</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={addPharmaItem}>
                    <Plus className="h-3 w-3 mr-1" /> Add Product
                  </Button>
                </div>
                {pharmaItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">No pharma products added. Click "Add Product" to include medicines in this invoice.</p>
                )}
                {pharmaItems.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-3 mb-2 space-y-2 bg-muted/30">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Product</Label>
                        <Select value={item.product_id || "placeholder"} onValueChange={(v) => updatePharmaItem(idx, "product_id", v === "placeholder" ? "" : v)}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {pharmaProductOptions.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Batch</Label>
                        <Select
                          value={item.inventory_id || "placeholder"}
                          onValueChange={(v) => updatePharmaItem(idx, "inventory_id", v === "placeholder" ? "" : v)}
                          disabled={!item.product_id}
                        >
                          <SelectTrigger className="mt-1"><SelectValue placeholder={item.product_id ? "Select batch" : "Select product first"} /></SelectTrigger>
                          <SelectContent>
                            {(pharmaInventory as any[])
                              .filter((i: any) => i.product_id === item.product_id && i.quantity > 0 && new Date(i.expiry_date) > new Date())
                              .map((i: any) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.batch_number}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" className="mt-1 h-8" min={1} max={item.available} value={item.quantity} onChange={(e) => updatePharmaItem(idx, "quantity", parseInt(e.target.value) || 1)} />
                      </div>
                      <div>
                        <Label className="text-xs">Price (₹)</Label>
                        <Input type="number" className="mt-1 h-8" value={item.unit_price} onChange={(e) => updatePharmaItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="flex items-end">
                        <div className="flex items-center gap-2 h-8">
                          <span className="text-sm font-medium">₹{(item.quantity * item.unit_price).toFixed(2)}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePharmaItem(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {pharmaItems.length > 0 && (
                  <div className="text-right text-sm font-medium text-muted-foreground">
                    Products subtotal: ₹{pharmaSubtotal.toLocaleString()}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["One-time", "Recurring"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                <Label>Tax Configuration</Label>
                <Select value={selectedTaxId || "none"} onValueChange={(v) => setSelectedTaxId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="No tax" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Tax</SelectItem>
                    {taxes.map((t: any) => {
                      const { total } = getTaxComponents(t);
                      return (
                        <SelectItem key={t.id} value={t.id}>{t.name} ({total}%)</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {paymentType === "One-time" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Services Subtotal (₹) {pharmaItems.length === 0 ? "*" : ""}</Label>
                      <Input type="number" className="mt-1.5" value={totalAmount} onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label>Paid Amount (₹)</Label>
                      <Input type="number" className="mt-1.5" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  {((totalAmount + pharmaSubtotal) > 0) && (() => {
                    const subtotal = totalAmount + pharmaSubtotal;
                    const { cgst, sgst, igst } = getTaxComponents(getSelectedTax());
                    const cgstAmt = (subtotal * cgst) / 100;
                    const sgstAmt = (subtotal * sgst) / 100;
                    const igstAmt = (subtotal * igst) / 100;
                    const taxApplied = selectedTaxId && selectedTaxId !== "none";
                    return (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                        {totalAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Services</span><span>₹{totalAmount.toLocaleString()}</span></div>}
                        {pharmaSubtotal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Products</span><span>₹{pharmaSubtotal.toLocaleString()}</span></div>}
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                        {taxApplied && cgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST ({cgst}%)</span><span>₹{cgstAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                        {taxApplied && sgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST ({sgst}%)</span><span>₹{sgstAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                        {taxApplied && igst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST ({igst}%)</span><span>₹{igstAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                        <div className="flex justify-between font-semibold text-primary"><span>Grand Total</span><span>₹{(subtotal + cgstAmt + sgstAmt + igstAmt).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {paymentType === "Staged" && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-display font-semibold">Payment Stages</Label>
                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={addStage}>
                      <Plus className="h-3 w-3 mr-1" /> Add Stage
                    </Button>
                  </div>
                  {stages.map((stage, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <Input className="h-7 text-xs font-medium w-32 border-0 bg-transparent p-0" value={stage.label} onChange={(e) => updateStage(i, "label", e.target.value)} />
                        {stages.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => removeStage(i)}>Remove</Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Amount (₹)</Label>
                          <Input type="number" className="mt-1 h-8" value={stage.amount} onChange={(e) => updateStage(i, "amount", parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Collected (₹)</Label>
                          <Input type="number" className="mt-1 h-8" value={stage.paid} onChange={(e) => updateStage(i, "paid", parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total across stages</span><span className="font-semibold">₹{stagedTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total collected</span><span>₹{stagedPaid.toLocaleString()}</span></div>
                    <div className="flex justify-between text-primary font-semibold"><span>Balance</span><span>₹{(stagedTotal - stagedPaid).toLocaleString()}</span></div>
                    <p className="text-xs text-muted-foreground mt-1">{stages.length} invoice(s) will be created</p>
                  </div>
                </div>
              )}

              {paymentType === "Recurring" && (
                <div className="border-t pt-4 space-y-3">
                  <Label className="font-display font-semibold">Recurring Installments</Label>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Amount (₹) *</Label>
                    <Input type="number" className="mt-1" value={recurringTotalAmount} onChange={(e) => handleRecurringTotalChange(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground"># of Installments *</Label>
                      <Input type="number" className="mt-1" min={1} value={recurringCount} onChange={(e) => handleRecurringCountChange(parseInt(e.target.value) || 1)} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Amount per Installment (₹) *</Label>
                      <Input type="number" className="mt-1" value={recurringAmount} onChange={(e) => setRecurringAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  {recurringCount > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 text-xs font-medium text-muted-foreground px-2">
                        <span>Inst.</span>
                        <span>Due Date</span>
                        <span className="text-right">Amount</span>
                        <span>Status</span>
                        <span className="text-right">Paid</span>
                      </div>
                      {Array.from({ length: recurringCount }, (_, i) => {
                        const dueDate = recurringDueDates[i] || addMonths(new Date(), i);
                        const instStatus = recurringStatuses[i] || "Pending";
                        return (
                          <div key={i} className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 items-center border rounded-lg p-2 bg-muted/30">
                            <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs justify-start font-normal w-full">
                                  {format(dueDate, "dd MMM yyyy")}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={dueDate} onSelect={(d) => {
                                  if (d) {
                                    const updated = [...recurringDueDates];
                                    updated[i] = d;
                                    setRecurringDueDates(updated);
                                  }
                                }} className="p-3 pointer-events-auto" />
                              </PopoverContent>
                            </Popover>
                            <span className="text-xs text-right">₹{recurringAmount.toLocaleString()}</span>
                            <Select value={instStatus} onValueChange={(v) => {
                              const updated = [...recurringStatuses];
                              updated[i] = v;
                              setRecurringStatuses(updated);
                            }}>
                              <SelectTrigger className="h-7 text-xs px-1.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["Pending", "Paid", "Partial", "Overdue"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input type="number" className="h-7 text-xs" placeholder="0" value={recurringCollected[i] || 0} onChange={(e) => {
                              const updated = [...recurringCollected];
                              updated[i] = parseFloat(e.target.value) || 0;
                              setRecurringCollected(updated);
                            }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total ({recurringCount} × ₹{recurringAmount.toLocaleString()})</span><span className="font-semibold">₹{recurringTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total collected</span><span>₹{recurringPaidTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-primary font-semibold"><span>Balance</span><span>₹{(recurringTotal - recurringPaidTotal).toLocaleString()}</span></div>
                    <p className="text-xs text-muted-foreground mt-1">{recurringCount} invoice(s) will be created</p>
                  </div>
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea className="mt-1.5" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>

              <Button className="w-full" onClick={() => createInvoice.mutate()} disabled={!canCreateInvoice() || createInvoice.isPending}>
                {createInvoice.isPending ? "Creating..." : paymentType === "Staged" ? `Create ${stages.length} Staged Invoice(s)` : paymentType === "Recurring" ? `Create ${recurringCount} Recurring Invoice(s)` : "Create Invoice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment Update Dialog */}
      <Dialog open={!!paymentInv} onOpenChange={(o) => { if (!o) setPaymentInv(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Add Payment</DialogTitle>
          </DialogHeader>
          {paymentInv && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-medium">{paymentInv.invoice_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span>{paymentInv.patient_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-semibold">₹{Number(paymentInv.total_amount).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Already Paid</span><span>₹{Number(paymentInv.paid_amount).toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold text-primary"><span>Balance Due</span><span>₹{(Number(paymentInv.total_amount) - Number(paymentInv.paid_amount)).toLocaleString()}</span></div>
              </div>
              <div>
                <Label>Payment Amount (₹) *</Label>
                <Input type="number" className="mt-1.5" placeholder={`Max: ₹${(Number(paymentInv.total_amount) - Number(paymentInv.paid_amount)).toLocaleString()}`} value={addPaymentAmount} onChange={(e) => setAddPaymentAmount(parseFloat(e.target.value) || 0)} max={Number(paymentInv.total_amount) - Number(paymentInv.paid_amount)} />
              </div>
              <div>
                <Label>Payment Mode</Label>
                <Select value={addPaymentMode} onValueChange={setAddPaymentMode}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Cash", "Card", "UPI", "Insurance", "Bank Transfer"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => updatePayment.mutate()} disabled={addPaymentAmount <= 0 || updatePayment.isPending}>
                  {updatePayment.isPending ? "Updating..." : "Add Payment"}
                </Button>
                <Button variant="outline" className="shrink-0" onClick={() => markAsPaid.mutate(paymentInv)} disabled={paymentInv.status === "Paid" || markAsPaid.isPending}>
                  Mark Fully Paid
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} change="All time" icon={IndianRupee} iconColor="bg-success/10 text-success" />
        <StatCard title="Pending" value={`₹${pendingAmount.toLocaleString()}`} change={`${invoices.filter((i: any) => i.status === "Pending").length} invoice(s)`} icon={IndianRupee} iconColor="bg-destructive/10 text-destructive" delay={0.05} />
        <StatCard title="Partial Payments" value={`₹${partialAmount.toLocaleString()}`} change={`${invoices.filter((i: any) => i.status === "Partial").length} invoice(s)`} icon={IndianRupee} iconColor="bg-warning/10 text-warning" delay={0.1} />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }} className="data-table">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices, services, doctor, type..." className="pl-9 bg-muted border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-2", hasActiveFilters && "border-primary text-primary")}>
                  <Filter className="h-3.5 w-3.5" />Filter
                  {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-3" align="end">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Filters</h4>
                  {hasActiveFilters && <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearFilters}>Clear all</Button>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Date From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                        {filterDateFrom ? format(filterDateFrom, "PPP") : "Any"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filterDateFrom} onSelect={setFilterDateFrom} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Date To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                        {filterDateTo ? format(filterDateTo, "PPP") : "Any"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filterDateTo} onSelect={setFilterDateTo} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Doctor</Label>
                  <Select value={filterDoctor || "all"} onValueChange={(v) => setFilterDoctor(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Doctors</SelectItem>
                      {uniqueDoctors.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Service</Label>
                  <Select value={filterService || "all"} onValueChange={(v) => setFilterService(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {uniqueServices.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Type</Label>
                    <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {["One-time", "Staged", "Recurring"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Status</Label>
                    <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {["Paid", "Partial", "Pending"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" className="w-full" onClick={() => setShowFilters(false)}>Apply</Button>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" />Export
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Invoice</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Patient</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Doctor</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Services</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden sm:table-cell">Type</th>
                <th className="text-right text-xs font-medium text-muted-foreground p-4">Amount</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                <th className="text-right text-xs font-medium text-muted-foreground p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No invoices found</td></tr>
              ) : (
                filtered.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openViewSheet(inv)}>
                    <td className="p-4">
                      <p className="font-medium text-sm text-primary hover:underline">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="p-4 text-sm">{inv.patient_name || "—"}</td>
                    <td className="p-4 hidden lg:table-cell">
                      {getDrName(inv) ? (
                        <span className="text-sm">{getDrName(inv)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
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
                      {inv.status !== "Pending" && (
                        <p className="text-xs text-muted-foreground">Paid: ₹{Number(inv.paid_amount).toLocaleString()}</p>
                      )}
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Select value={inv.status} onValueChange={(v) => updateInvoiceStatus.mutate({ id: inv.id, status: v })}>
                        <SelectTrigger className={`h-auto border-0 p-0 shadow-none w-auto gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[inv.status] || ""}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Pending", "Paid", "Partial", "Overdue"].map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {inv.status !== "Paid" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Add Payment" onClick={() => { setPaymentInv(inv); setAddPaymentAmount(0); setAddPaymentMode("Cash"); }}>
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Download PDF" onClick={() => generateInvoicePDF(inv)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Invoice View/Edit Sheet */}
      <Sheet open={!!viewInvoice} onOpenChange={(o) => { if (!o) { setViewInvoice(null); setIsEditing(false); } }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">{isEditing ? "Edit Invoice" : "Invoice Details"}</SheetTitle>
            <SheetDescription>{viewInvoice?.invoice_number}</SheetDescription>
          </SheetHeader>

          {viewInvoice && !isEditing && (
            <div className="space-y-6 mt-6">
              {/* Action buttons */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => {
                  if (confirm("Are you sure you want to delete this invoice?")) deleteInvoice.mutate(viewInvoice.id);
                }}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => generateInvoicePDF(viewInvoice)}>
                  <FileText className="h-3.5 w-3.5" /> PDF
                </Button>
              </div>

              {/* Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground text-xs block">Patient</span><span className="font-medium">{viewInvoice.patient_name || "Walk-in"}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Date</span><span className="font-medium">{format(new Date(viewInvoice.created_at), "PPP")}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Doctor</span><span className="font-medium">{getDrName(viewInvoice) || "—"}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Payment Mode</span><span className="font-medium">{viewInvoice.payment_mode || "Cash"}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Type</span><Badge variant="outline" className="text-xs mt-0.5">{viewInvoice.payment_type}</Badge></div>
                  <div><span className="text-muted-foreground text-xs block">Status</span><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[viewInvoice.status] || ""}`}>{viewInvoice.status}</span></div>
                </div>
              </div>

              {/* Services */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Services</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(viewInvoice.services || []).map((s: string, i: number) => (
                    <Badge key={i} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>

              {/* Financials */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Amount</span><span className="font-semibold">₹{Number(viewInvoice.total_amount).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid Amount</span><span>₹{Number(viewInvoice.paid_amount).toLocaleString()}</span></div>
                {Number(viewInvoice.cgst_amount) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>₹{Number(viewInvoice.cgst_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                )}
                {Number(viewInvoice.sgst_amount) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>₹{Number(viewInvoice.sgst_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                )}
                {Number(viewInvoice.igst_amount) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>₹{Number(viewInvoice.igst_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                )}
                {!Number(viewInvoice.cgst_amount) && !Number(viewInvoice.sgst_amount) && !Number(viewInvoice.igst_amount) && viewInvoice.tax_rate > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax ({viewInvoice.tax_rate}%)</span><span>₹{Number(viewInvoice.tax_amount || 0).toLocaleString()}</span></div>
                )}
                <div className="flex justify-between font-semibold text-primary border-t pt-2"><span>Balance Due</span><span>₹{(Number(viewInvoice.total_amount) - Number(viewInvoice.paid_amount)).toLocaleString()}</span></div>
              </div>

              {viewInvoice.notes && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  <span className="text-muted-foreground text-xs block mb-1">Notes</span>
                  {viewInvoice.notes}
                </div>
              )}

              {/* Linked appointment */}
              {viewInvoice.appointments && (
                <button
                  onClick={() => { setSelectedAppointmentId(viewInvoice.appointments.id); setViewInvoice(null); }}
                  className="w-full flex items-center gap-2 text-sm text-primary bg-primary/5 hover:bg-primary/10 rounded-lg px-3 py-2 transition-colors"
                >
                  <CalendarClock className="h-4 w-4" />
                  <span>{viewInvoice.appointments.service} · {format(new Date(viewInvoice.appointments.start_time), "MMM d, h:mm a")}</span>
                </button>
              )}
            </div>
          )}

          {/* Edit Mode */}
          {viewInvoice && isEditing && (
            <div className="space-y-4 mt-6">
              <div>
                <Label>Patient Name</Label>
                <Input className="mt-1.5" value={editData.patient_name} onChange={(e) => setEditData({ ...editData, patient_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Total Amount (₹)</Label>
                  <Input type="number" className="mt-1.5" value={editData.total_amount} onChange={(e) => setEditData({ ...editData, total_amount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Paid Amount (₹)</Label>
                  <Input type="number" className="mt-1.5" value={editData.paid_amount} onChange={(e) => setEditData({ ...editData, paid_amount: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Type</Label>
                  <Select value={editData.payment_type} onValueChange={(v) => setEditData({ ...editData, payment_type: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["One-time", "Staged", "Recurring"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={editData.payment_mode} onValueChange={(v) => setEditData({ ...editData, payment_mode: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Cash", "Card", "UPI", "Insurance", "Bank Transfer"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea className="mt-1.5" value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => updateInvoice.mutate()} disabled={updateInvoice.isPending}>
                  {updateInvoice.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AppointmentDetailSheet
        appointmentId={selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
      />
    </div>
  );
};

export default Billing;
