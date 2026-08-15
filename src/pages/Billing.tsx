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
import { fetchAll } from "@/lib/supabasePaginate";
import { PatientCombobox } from "@/components/patients/PatientCombobox";
import { StaffCombobox } from "@/components/shared/StaffCombobox";

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
    <div class="logo">The Skin Clinic<span>Clinic Manager</span></div>
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
      <p>Payment: ${
        Array.isArray(inv.payment_splits) && inv.payment_splits.length > 0
          ? inv.payment_splits.map((p: any) => `${p.mode}: ₹${Number(p.amount).toLocaleString("en-IN")}`).join(" | ")
          : (inv.payment_mode || "Cash")
      }</p>
      <p>Type: ${inv.payment_type || "One-time"}</p>
      <p style="margin-top:6px;"><span class="status-badge status-${inv.status}">${inv.status}</span></p>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Service</th><th class="amount-col">Amount</th></tr></thead>
    <tbody>
      ${(() => {
        const items: any[] = Array.isArray(inv.line_items) && inv.line_items.length > 0
          ? inv.line_items
          : (inv.services || []).map((s: string) => ({ name: s, qty: 1, price: null }));
        return items.map((it: any, i: number) => {
          const qty = Number(it.qty) || 1;
          const price = it.price == null ? null : Number(it.price) || 0;
          const amount = price == null ? null : qty * price;
          const amtCell = amount == null ? "—" : `₹${amount.toLocaleString("en-IN")}`;
          const label = qty > 1 ? `${it.name} × ${qty}` : it.name;
          const hsn = it.hsn ? ` <span style=\"color:#999;font-size:11px;\">HSN ${it.hsn}</span>` : "";
          return `<tr><td>${i + 1}</td><td>${label}${hsn}</td><td class=\"amount-col\">${amtCell}</td></tr>`;
        }).join("");
      })()}
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
    <p>Thank you for choosing The Skin Clinic</p>
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
  const d = inv.appointments?.doctors;
  if (d) {
    const full = [d.first_name, d.last_name].filter(Boolean).join(" ").trim();
    if (full) return `Dr. ${full}`;
  }
  return "";
};

const Billing = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Open the public invoice PDF (generates on-demand if not yet cached).
  const openInvoicePDF = async (inv: any) => {
    // Open a tab synchronously to avoid popup blockers; we'll set its URL later.
    const win = window.open("", "_blank");
    try {
      if (inv?.pdf_url) {
        if (win) win.location.href = inv.pdf_url;
        else window.location.href = inv.pdf_url;
        return;
      }
      if (!inv?.id) {
        toast.error("Invoice id missing");
        if (win) win.close();
        return;
      }
      const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
        body: { invoiceId: inv.id },
      });
      if (error || !(data as any)?.url) {
        console.error("PDF generate failed:", error, data);
        toast.error("Failed to generate invoice PDF");
        if (win) win.close();
        return;
      }
      const url = (data as any).url as string;
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to open invoice PDF");
      if (win) win.close();
    }
  };

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
  const [doctorId, setDoctorId] = useState("");
  const [serviceInputs, setServiceInputs] = useState<{ name: string; price: number; hsn: string; gst: number; service_id?: string; doctor_fee?: boolean }[]>([{ name: "", price: 0, hsn: "", gst: 0 }]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentType, setPaymentType] = useState("One-time");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");
  // Split payment (Create Invoice — One-time only). Empty array = single mode flow.
  const [splits, setSplits] = useState<{ mode: string; amount: number }[]>([]);
  // Tax is now resolved per-line from Tax Master mappings (no manual selector)
  const [pharmaItems, setPharmaItems] = useState<PharmaLineItem[]>([]);

  const [stages, setStages] = useState<StageRow[]>([{ label: "Stage 1", amount: 0, paid: 0 }]);
  const [recurringCount, setRecurringCount] = useState(1);
  const [recurringAmount, setRecurringAmount] = useState(0);
  const [recurringCollected, setRecurringCollected] = useState<number[]>([0]);
  const [recurringTotalAmount, setRecurringTotalAmount] = useState(0);
  const [recurringDueDates, setRecurringDueDates] = useState<Date[]>([new Date()]);
  const [recurringStatuses, setRecurringStatuses] = useState<string[]>(["Pending"]);
  // Appointment this invoice originated from (installment #1 links to it)
  const [sourceAppointmentId, setSourceAppointmentId] = useState<string | null>(null);
  const [serviceSearchOpen, setServiceSearchOpen] = useState<number | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [invoiceSeq, setInvoiceSeq] = useState<string>(() => Date.now().toString().slice(-6));

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
        .select("*, appointments(id, service, start_time, staff_id, doctors:staff_id(first_name, last_name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list"],
    queryFn: async () => {
      return await fetchAll<any>((from, to) =>
        supabase
          .from("patients")
          .select("id, first_name, last_name")
          .order("first_name")
          .range(from, to)
      );
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

  const { data: hsnTaxes = [] } = useQuery({
    queryKey: ["hsn-tax-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hsn_tax_master")
        .select("id, hsn_code, igst, cgst")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: taxProductLinks = [] } = useQuery({
    queryKey: ["tax-master-products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_master_products")
        .select("product_id, tax_id, is_active, tax_master!inner(is_active)")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []).filter((r: any) => r.tax_master?.is_active);
    },
  });

  const productTaxMap = useMemo(() => {
    const m = new Map<string, string>();
    (taxProductLinks as any[]).forEach((r) => m.set(r.product_id, r.tax_id));
    return m;
  }, [taxProductLinks]);

  const { data: taxServiceLinks = [] } = useQuery({
    queryKey: ["tax-master-services-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_master_services" as any)
        .select("service_id, tax_id, is_active, tax_master!inner(is_active)")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []).filter((r: any) => r.tax_master?.is_active);
    },
  });

  const serviceTaxMap = useMemo(() => {
    const m = new Map<string, string>();
    (taxServiceLinks as any[]).forEach((r) => m.set(r.service_id, r.tax_id));
    return m;
  }, [taxServiceLinks]);

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
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, hsn_code, gst_percent" as any)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Doctors list for the new "Doctor" dropdown
  const { data: doctorsList = [] } = useQuery({
    queryKey: ["staff-doctors-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, first_name, last_name, role, specialization, consultation_fee, is_active" as any)
        .eq("role", "Doctor")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
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
        const svc = (serviceMaster as any[]).find((s: any) => s?.name === prefillService);
        setServiceInputs([{ name: prefillService, price: Number(svc?.price) || 0, hsn: svc?.hsn_code || "", gst: Number(svc?.gst_percent) || 0, service_id: svc?.id }]);
      }
      setPaymentType("Recurring");
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, serviceMaster]);

  // Open a specific invoice via ?viewInvoice=<id> (e.g. from Patient detail)
  useEffect(() => {
    const viewId = searchParams.get("viewInvoice");
    if (viewId === "__new__") return;
    if (!viewId || !invoices?.length) return;
    const inv = (invoices as any[]).find((i: any) => i.id === viewId);
    if (inv) {
      setViewInvoice(inv);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("viewInvoice");
        return next;
      }, { replace: true });
    }
  }, [searchParams, invoices]);

  // Pre-fill the Create Invoice form from an appointment ("New Bill" flow).
  // Payload is stashed in sessionStorage to avoid huge URLs.
  const [pendingPrefill, setPendingPrefill] = useState<any | null>(null);
  useEffect(() => {
    if (searchParams.get("newInvoice") !== "1") return;
    const raw = sessionStorage.getItem("billing_prefill");
    let payload: any = null;
    if (raw) { try { payload = JSON.parse(raw); } catch { payload = null; } }
    sessionStorage.removeItem("billing_prefill");

    if (payload?.patientId) setPatientId(payload.patientId);
    if (payload?.doctorId) setDoctorId(payload.doctorId);
    if (payload?.appointmentId) setSourceAppointmentId(payload.appointmentId);

    setPendingPrefill(payload || {});
    setInvoiceDate(new Date());
    setInvoiceSeq(Date.now().toString().slice(-6));
    setOpen(true);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Resolve prefilled service / product lines once the master lists have loaded,
  // so price + HSN are auto-filled from Service Master.
  useEffect(() => {
    const payload = pendingPrefill;
    if (!payload) return;
    if ((serviceMaster as any[]).length === 0) return; // masters still loading

    const norm = (v: any) =>
      String(v || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const names: string[] = Array.isArray(payload?.services) ? payload.services.filter(Boolean) : [];
    if (names.length) {
      setServiceInputs(
        names.map((n: string) => {
          const key = norm(n);
          const list = serviceMaster as any[];
          const svc =
            list.find((s: any) => norm(s?.name) === key) ||
            list.find((s: any) => norm(s?.name).startsWith(key) || key.startsWith(norm(s?.name))) ||
            list.find((s: any) => norm(s?.name).includes(key) || key.includes(norm(s?.name)));
          return {
            name: svc?.name || n,
            price: Number(svc?.price) || 0,
            hsn: svc?.hsn_code || "",
            gst: Number(svc?.gst_percent) || 0,
            service_id: svc?.id,
          };
        }),
      );
    }

    const products: any[] = Array.isArray(payload?.products) ? payload.products : [];
    if (products.length) {
      const lines: PharmaLineItem[] = [];
      for (const p of products) {
        const pname = String(p?.name || "").toLowerCase();
        if (!pname) continue;
        const master = (pharmaProducts as any[]).find(
          (m: any) => String(m?.name || "").toLowerCase() === pname || m?.id === p?.product_id,
        );
        const batch = (pharmaInventory as any[])
          .filter(
            (inv: any) =>
              inv.quantity > 0 &&
              new Date(inv.expiry_date) > new Date() &&
              String(inv.pharma_products?.name || "").toLowerCase() === pname,
          )
          .sort((a: any, b: any) => String(a.expiry_date).localeCompare(String(b.expiry_date)))[0];
        if (!batch && !master) continue;
        lines.push({
          inventory_id: batch?.id || "",
          product_id: batch?.product_id || master?.id || "",
          product_name: batch?.pharma_products?.name || master?.name || p.name,
          batch_number: batch?.batch_number || "",
          quantity: Math.max(1, Number(p.quantity) || 1),
          unit_price:
            Number(batch?.selling_price) ||
            Number(batch?.mrp) ||
            Number(master?.selling_price) ||
            Number(master?.mrp) ||
            0,
          available: batch?.quantity || 0,
        });
      }
      if (lines.length) setPharmaItems(lines);
    }

    setPendingPrefill(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrefill, serviceMaster, pharmaInventory, pharmaProducts]);

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

  const getTaxComponents = (tax: any) => {
    if (!tax) return { cgst: 0, sgst: 0, igst: 0, total: 0 };
    const cgst = Number(tax.cgst) || 0;
    const sgst = Number(tax.sgst) || 0;
    const igst = Number(tax.igst) || 0;
    const total = cgst + sgst + igst || Number(tax.rate) || 0;
    return { cgst, sgst, igst, total };
  };

  // Per-line tax resolver: looks up the tax mapping for a service/product id and returns its components
  const taxById = useMemo(() => {
    const m = new Map<string, any>();
    (taxes as any[]).forEach((t) => m.set(t.id, t));
    return m;
  }, [taxes]);

  const getLineTax = (taxId: string | undefined, amount: number) => {
    if (!taxId) return { rate: 0, cgst: 0, sgst: 0, igst: 0, taxAmount: 0 };
    const tax = taxById.get(taxId);
    const { cgst, sgst, igst, total } = getTaxComponents(tax);
    const cgstAmt = (amount * cgst) / 100;
    const sgstAmt = (amount * sgst) / 100;
    const igstAmt = (amount * igst) / 100;
    return { rate: total, cgst: cgstAmt, sgst: sgstAmt, igst: igstAmt, taxAmount: cgstAmt + sgstAmt + igstAmt };
  };

  // Resolve tax id for a service line (by name → service master → mapping)
  const getServiceTaxId = (serviceName: string): string | undefined => {
    const svc = (serviceMaster as any[]).find((s) => s.name === serviceName);
    return svc ? serviceTaxMap.get(svc.id) : undefined;
  };

  // HSN-based tax (Tax Master): service → HSN code → IGST + CGST
  const hsnTaxMap = useMemo(() => {
    const m = new Map<string, any>();
    (hsnTaxes as any[]).forEach((h) => m.set(String(h.hsn_code), h));
    return m;
  }, [hsnTaxes]);

  const getServiceLineTax = (serviceName: string, amount: number, lineHsn?: string) => {
    const svc = (serviceMaster as any[]).find((s) => s.name === serviceName);
    const hsn = (lineHsn && lineHsn.trim()) || svc?.hsn_code || "";
    const hsnTax = hsn ? hsnTaxMap.get(String(hsn)) : undefined;
    if (hsnTax) {
      const igst = Number(hsnTax.igst) || 0;
      const cgst = Number(hsnTax.cgst) || 0;
      const igstAmt = (amount * igst) / 100;
      const cgstAmt = (amount * cgst) / 100;
      return { rate: igst + cgst, cgst: cgstAmt, sgst: 0, igst: igstAmt, taxAmount: igstAmt + cgstAmt };
    }
    return getLineTax(getServiceTaxId(serviceName), amount);
  };

  const getProductTaxId = (productId: string): string | undefined => productTaxMap.get(productId);

  // Resolve the HSN code that applies to a pharma line: inward batch → product master.
  const getProductHsn = (productId: string, inventoryId?: string): string => {
    const batch = inventoryId ? (pharmaInventory as any[]).find((i) => i.id === inventoryId) : undefined;
    if (batch?.hsn_code) return String(batch.hsn_code);
    const prod = (pharmaProducts as any[]).find((p) => p.id === productId);
    return prod?.hsn_code ? String(prod.hsn_code) : "";
  };

  // Product line tax priority:
  // 1. Inward stock batch GST/HSN (captured at Inward Stock)
  // 2. HSN Tax Master entry for that HSN
  // 3. Tax Master product mapping
  // 4. Product master GST %
  const getProductLineTax = (productId: string, amount: number, inventoryId?: string) => {
    const batch = inventoryId ? (pharmaInventory as any[]).find((i) => i.id === inventoryId) : undefined;
    const hsn = getProductHsn(productId, inventoryId);
    const hsnTax = hsn ? hsnTaxMap.get(String(hsn)) : undefined;

    const batchRate = Number(batch?.gst_percent) || 0;
    if (batchRate > 0 && amount) {
      if (hsnTax) {
        const igst = Number(hsnTax.igst) || 0;
        const cgst = Number(hsnTax.cgst) || 0;
        if (igst + cgst > 0) {
          return { rate: igst + cgst, cgst: (amount * cgst) / 100, sgst: 0, igst: (amount * igst) / 100, taxAmount: (amount * (igst + cgst)) / 100 };
        }
      }
      const half = (amount * batchRate) / 200;
      return { rate: batchRate, cgst: half, sgst: half, igst: 0, taxAmount: half * 2 };
    }

    if (hsnTax && amount) {
      const igst = Number(hsnTax.igst) || 0;
      const cgst = Number(hsnTax.cgst) || 0;
      if (igst + cgst > 0) {
        return { rate: igst + cgst, cgst: (amount * cgst) / 100, sgst: 0, igst: (amount * igst) / 100, taxAmount: (amount * (igst + cgst)) / 100 };
      }
    }

    const mapped = getLineTax(getProductTaxId(productId), amount);
    if (mapped.rate > 0) return mapped;
    const prod = (pharmaProducts as any[]).find((p) => p.id === productId);
    const rate = Number(prod?.gst_percent) || 0;
    if (!rate || !amount) return { rate: 0, cgst: 0, sgst: 0, igst: 0, taxAmount: 0 };
    const half = (amount * rate) / 200;
    return { rate, cgst: half, sgst: half, igst: 0, taxAmount: half * 2 };
  };

  // Unified per-line rows used by the invoice summary (tax by line item).
  const lineTaxRows = useMemo(() => {
    const rows: { key: string; kind: "Service" | "Product"; name: string; hsn: string; qty: number; amount: number; rate: number; cgst: number; sgst: number; igst: number; tax: number }[] = [];
    serviceInputs.forEach((s: any, i) => {
      const amount = Number(s.price) || 0;
      if (!String(s.name || "").trim() || !amount) return;
      const t = getServiceLineTax(s.name, amount, s.hsn);
      rows.push({ key: `s-${i}`, kind: "Service", name: s.name, hsn: s.hsn || "", qty: 1, amount, rate: t.rate, cgst: t.cgst, sgst: t.sgst, igst: t.igst, tax: t.taxAmount });
    });
    pharmaItems.forEach((p, i) => {
      const amount = p.quantity * p.unit_price;
      if (!p.product_id || !amount) return;
      const t = getProductLineTax(p.product_id, amount, p.inventory_id);
      rows.push({ key: `p-${i}`, kind: "Product", name: p.product_name, hsn: getProductHsn(p.product_id, p.inventory_id), qty: p.quantity, amount, rate: t.rate, cgst: t.cgst, sgst: t.sgst, igst: t.igst, tax: t.taxAmount });
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceInputs, pharmaItems, serviceMaster, pharmaProducts, pharmaInventory, hsnTaxes, taxProductLinks, taxServiceLinks, taxes]);

  const pharmaSubtotal = pharmaItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const servicesSubtotal = useMemo(() => serviceInputs.reduce((sum, s) => sum + (Number(s.price) || 0), 0), [serviceInputs]);

  // Tax for a share of the bill (used by installments): each line taxed at its own rate, scaled.
  const scaledLineTax = (scale: number) => {
    let cgst = 0, sgst = 0, igst = 0;
    serviceInputs.forEach((s: any) => {
      if (!String(s.name || "").trim() || !s.price) return;
      const t = getServiceLineTax(s.name, Number(s.price) * scale, s.hsn);
      cgst += t.cgst; sgst += t.sgst; igst += t.igst;
    });
    pharmaItems.forEach((p) => {
      const amt = p.quantity * p.unit_price;
      if (!p.product_id || !amt) return;
      const t = getProductLineTax(p.product_id, amt * scale, p.inventory_id);
      cgst += t.cgst; sgst += t.sgst; igst += t.igst;
    });
    return { cgst, sgst, igst, tax: cgst + sgst + igst };
  };

  // Per-installment tax + total (recurring plans)
  const installmentTax = useMemo(() => {
    const base = servicesSubtotal + pharmaSubtotal;
    const scale = base > 0 ? recurringAmount / base : 0;
    return scaledLineTax(scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicesSubtotal, pharmaSubtotal, recurringAmount, serviceInputs, pharmaItems, serviceTaxMap, productTaxMap]);
  const installmentTotal = recurringAmount + installmentTax.tax;

  // Auto-fill Recurring Total Amount from services + products subtotal, and recompute per-installment amount
  useEffect(() => {
    if (paymentType !== "Recurring") return;
    const subtotal = servicesSubtotal + pharmaSubtotal;
    if (subtotal <= 0) return;
    setRecurringTotalAmount(subtotal);
    const c = Math.max(1, recurringCount);
    setRecurringAmount(Math.round((subtotal / c) * 100) / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentType, servicesSubtotal, pharmaSubtotal, recurringCount]);

  // Keep "Paid" installments' collected amount in sync with the per-installment amount
  useEffect(() => {
    if (paymentType !== "Recurring") return;
    setRecurringCollected((prev) => {
      const next = [...prev];
      let changed = false;
      for (let i = 0; i < recurringCount; i++) {
        if (recurringStatuses[i] === "Paid" && next[i] !== recurringAmount) {
          next[i] = recurringAmount;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurringAmount, recurringStatuses, recurringCount, paymentType]);

  const addPharmaItem = () => {
    setPharmaItems([...pharmaItems, { inventory_id: "", product_id: "", product_name: "", batch_number: "", quantity: 1, unit_price: 0, available: 0 }]);
  };

  // All pharma products are selectable (batch is optional — clinics may bill
  // products that have no inventory batch recorded yet).
  const pharmaProductOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pharmaProducts as any[]) {
      if (p?.id && p?.name) map.set(p.id, p.name);
    }
    for (const i of pharmaInventory as any[]) {
      if (i?.product_id && i.pharma_products?.name) map.set(i.product_id, i.pharma_products.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [pharmaProducts, pharmaInventory]);

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
      updated[idx].available = 0;
      // Default price: newest usable batch → product selling price → MRP
      const batches = (pharmaInventory as any[])
        .filter((i: any) => i.product_id === value && i.quantity > 0 && new Date(i.expiry_date) > new Date())
        .sort((a: any, b: any) => String(a.expiry_date).localeCompare(String(b.expiry_date)));
      const master = (pharmaProducts as any[]).find((p: any) => p.id === value);
      if (batches[0]) {
        const b = batches[0];
        updated[idx].inventory_id = b.id;
        updated[idx].batch_number = b.batch_number;
        updated[idx].available = b.quantity;
        updated[idx].unit_price = Number(b.selling_price) || Number(b.mrp) || Number(master?.selling_price) || Number(master?.mrp) || 0;
      } else {
        updated[idx].unit_price = Number(master?.selling_price) || Number(master?.mrp) || 0;
      }
    }
    if (field === "inventory_id") {
      const inv = pharmaInventory.find((i: any) => i.id === value) as any;
      if (inv) {
        updated[idx].batch_number = inv.batch_number;
        // Per-batch pricing: prefer batch selling_price → batch mrp → legacy product price
        updated[idx].unit_price = Number(inv.selling_price) || Number(inv.mrp) || Number(inv.pharma_products?.selling_price) || 0;
        updated[idx].available = inv.quantity;
      } else {
        updated[idx].batch_number = "";
        updated[idx].available = 0;
      }
    }
    setPharmaItems(updated);
  };

  const removePharmaItem = (idx: number) => setPharmaItems(pharmaItems.filter((_, i) => i !== idx));

  const createInvoice = useMutation({
    mutationFn: async () => {
      const services = serviceInputs.filter((s) => s.name.trim()).map((s) => s.name);
      const pharmaServiceNames = pharmaItems.filter(i => i.product_name).map(i => `${i.product_name} x${i.quantity}`);
      const allServices = [...services, ...pharmaServiceNames];
      if (allServices.length === 0) throw new Error("Add at least one service or product");

      // Persist a structured snapshot of every line so the PDF doesn't have to guess prices/HSN later.
      const lineItemsSnapshot: any[] = [
        ...serviceInputs
          .filter((s) => s.name.trim())
          .map((s) => ({
            kind: "service",
            name: s.name,
            qty: 1,
            price: Number(s.price) || 0,
            hsn: s.hsn || "",
            gst: Number(s.gst) || 0,
            doctor_fee: !!s.doctor_fee,
            service_id: s.service_id || null,
          })),
        ...pharmaItems
          .filter((i) => i.product_name)
          .map((i) => ({
            kind: "product",
            name: i.product_name,
            qty: i.quantity,
            price: Number(i.unit_price) || 0,
            hsn: getProductHsn(i.product_id, i.inventory_id),
            gst: getProductLineTax(i.product_id, 100, i.inventory_id).rate,
            product_id: i.product_id || null,
            batch_number: i.batch_number || null,
          })),
      ];

      const patient = patients.find((p) => p.id === patientId);
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : null;
      const baseNum = invoiceSeq;
      const createdAt = invoiceDate ? invoiceDate.toISOString() : new Date().toISOString();
      // Per-line tax aggregation: sum cgst/sgst/igst from each service & pharma line by its own mapped rate
      const aggregateLineTax = (svcAmounts: { name: string; price: number }[], pharma: PharmaLineItem[], scale: number) => {
        let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
        svcAmounts.forEach((s) => {
          if (!s.name.trim() || !s.price) return;
          const t = getServiceLineTax(s.name, s.price * scale, (s as any).hsn);
          cgstAmount += t.cgst; sgstAmount += t.sgst; igstAmount += t.igst;
        });
        pharma.forEach((p) => {
          const amt = p.quantity * p.unit_price;
          if (!p.product_id || !amt) return;
          const t = getProductLineTax(p.product_id, amt * scale, p.inventory_id);
          cgstAmount += t.cgst; sgstAmount += t.sgst; igstAmount += t.igst;
        });
        return { cgst_amount: cgstAmount, sgst_amount: sgstAmount, igst_amount: igstAmount, tax_amount: cgstAmount + sgstAmount + igstAmount };
      };
      // For staged/recurring (which split a single user-typed amount), allocate proportionally to subtotal
      const baseSubtotal = servicesSubtotal + pharmaSubtotal;
      const splitTax = (base: number) => {
        const scale = baseSubtotal > 0 ? base / baseSubtotal : 0;
        return aggregateLineTax(serviceInputs, pharmaItems, scale);
      };

      if (paymentType === "Staged") {
        const rows = stages.map((stage, i) => {
          const t = splitTax(stage.amount);
          const stageTotal = stage.amount + t.tax_amount;
          let status = "Pending";
          if (stage.paid >= stageTotal && stageTotal > 0) status = "Paid";
          else if (stage.paid > 0) status = "Partial";
          return {
            invoice_number: `INV-${baseNum}-S${i + 1}`,
            created_at: createdAt,
            patient_id: patientId || null,
            patient_name: patientName,
            services: allServices,
            line_items: lineItemsSnapshot,
            doctor_id: doctorId || null,
            total_amount: stageTotal,
            paid_amount: stage.paid,
            status,
            payment_type: "Staged",
            payment_mode: paymentMode,
            notes: `${stage.label}${notes ? ` — ${notes}` : ""}`,
            tax_id: null,
            tax_rate: null,
            ...t,
          };
        });
        const { error } = await supabase.from("invoices").insert(rows as any);
        if (error) throw error;
        // Return a summary for downstream WhatsApp notification
        var summary: any = {
          invoiceNumber: `INV-${baseNum} (${stages.length} stages)`,
          totalAmount: rows.reduce((s, r: any) => s + Number(r.total_amount), 0),
          paidAmount: rows.reduce((s, r: any) => s + Number(r.paid_amount), 0),
          status: "Staged plan",
          invoiceId: undefined as string | undefined,
        };
      } else if (paymentType === "Recurring") {
        const t = splitTax(recurringAmount);
        const totalPerInst = recurringAmount + t.tax_amount;
        const groupId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) as string;

        // Recurring installments are tied to appointments: #1 to the current
        // appointment, the rest to auto-created "Recurring appointment" visits
        // on each installment's due date, all pointing at the parent.
        const appointmentIds: (string | null)[] = Array.from({ length: recurringCount }, () => null);
        let parentAppt: any = null;
        if (sourceAppointmentId) {
          const { data: pa } = await supabase.from("appointments").select("*").eq("id", sourceAppointmentId).maybeSingle();
          parentAppt = pa || null;
          appointmentIds[0] = sourceAppointmentId;
        }

        if (patientId) {
          const durationMs = parentAppt?.start_time && parentAppt?.end_time
            ? new Date(parentAppt.end_time).getTime() - new Date(parentAppt.start_time).getTime()
            : 30 * 60 * 1000;
          const startFrom = appointmentIds[0] ? 1 : 0;
          let parentId = appointmentIds[0];

          for (let i = startFrom; i < recurringCount; i++) {
            const due = recurringDueDates[i] || addMonths(new Date(), i);
            const start = new Date(due);
            if (parentAppt?.start_time) {
              const src = new Date(parentAppt.start_time);
              start.setHours(src.getHours(), src.getMinutes(), 0, 0);
            } else {
              start.setHours(10, 0, 0, 0);
            }
            const end = new Date(start.getTime() + durationMs);
            const basePayload: any = {
              patient_id: patientId,
              patient_name: patientName,
              service: parentAppt?.service || allServices[0] || "Installment payment",
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              status: "Recurring appointment",
              staff_id: doctorId || parentAppt?.staff_id || null,
              is_recurring: true,
              parent_appointment_id: parentId,
              reason_for_consultation: `Installment ${i + 1} of ${recurringCount}`,
              appointment_type: parentAppt?.appointment_type || "Walk-in",
            };
            let inserted: any = null;
            let res = await supabase.from("appointments").insert(basePayload).select("id").single();
            if (res.error) {
              // Slot clash with the assigned doctor — book without a doctor rather than fail the plan
              res = await supabase.from("appointments").insert({ ...basePayload, staff_id: null }).select("id").single();
            }
            if (!res.error) inserted = res.data;
            appointmentIds[i] = inserted?.id || null;
            if (!parentId && inserted?.id) {
              parentId = inserted.id;
              appointmentIds[i] = inserted.id;
            }
          }
        }

        const rows = Array.from({ length: recurringCount }, (_, i) => {
          const collected = recurringCollected[i] || 0;
          const instStatus = recurringStatuses[i] || "Pending";
          const dueDate = recurringDueDates[i] || addMonths(new Date(), i);
          // Only installment #1 is invoiced today (tax charged now). Installments
          // 2..N are *scheduled amounts* — no tax is levied until they are collected
          // on/after their due date. The effective tax rate is stored so tax can be
          // applied at collection time.
          const isFirst = i === 0;
          const effRate = recurringAmount > 0 ? (t.tax_amount / recurringAmount) * 100 : 0;
          const lineTotal = isFirst ? totalPerInst : recurringAmount;
          let status = instStatus;
          if (collected >= lineTotal && lineTotal > 0) status = "Paid";
          else if (collected > 0 && instStatus === "Pending") status = "Partial";
          else if (!isFirst && collected <= 0) status = "Scheduled";
          return {
            invoice_number: `INV-${baseNum}-R${i + 1}`,
            created_at: createdAt,
            patient_id: patientId || null,
            patient_name: patientName,
            services: allServices,
            line_items: lineItemsSnapshot,
            doctor_id: doctorId || null,
            appointment_id: appointmentIds[i],
            recurring_group_id: groupId,
            installment_number: i + 1,
            installment_count: recurringCount,
            due_date: format(dueDate, "yyyy-MM-dd"),
            total_amount: lineTotal,
            paid_amount: collected,
            status,
            payment_type: "Recurring",
            payment_mode: paymentMode,
            notes: `${isFirst ? "Installment" : "Scheduled amount"} ${i + 1} of ${recurringCount} | Due: ${format(dueDate, "dd MMM yyyy")}${notes ? ` — ${notes}` : ""}`,
            tax_id: null,
            tax_rate: isFirst ? null : Math.round(effRate * 100) / 100,
            ...(isFirst ? t : { tax_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0 }),
          };
        });
        const { error } = await supabase.from("invoices").insert(rows as any);
        if (error) throw error;
        var summary: any = {
          invoiceNumber: `INV-${baseNum} (${recurringCount} installments)`,
          totalAmount: rows.reduce((s, r: any) => s + Number(r.total_amount), 0),
          paidAmount: rows.reduce((s, r: any) => s + Number(r.paid_amount), 0),
          status: "Recurring plan",
          invoiceId: undefined as string | undefined,
          isRecurring: true,
          installmentCount: recurringCount,
          installmentAmount: recurringAmount,
          firstDueDate: recurringDueDates[0] || new Date(),
          serviceName: allServices[0] || "Treatment plan",
        };
      } else {
        const combinedSubtotal = servicesSubtotal + pharmaSubtotal;
        const t = splitTax(combinedSubtotal);
        const grandTotal = combinedSubtotal + t.tax_amount;
        let status = "Pending";
        if (paidAmount >= grandTotal && grandTotal > 0) status = "Paid";
        else if (paidAmount > 0) status = "Partial";

        const splitsActive = splits.length > 0;
        const splitTotal = splits.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        if (splitsActive) {
          if (splits.some((r) => !r.mode || !(Number(r.amount) > 0))) {
            throw new Error("Each split row needs a payment mode and amount");
          }
          if (Math.round(splitTotal * 100) !== Math.round(paidAmount * 100)) {
            throw new Error("Split amounts must equal paid amount");
          }
        }
        const effectivePaymentMode = splitsActive
          ? (splits.length === 1 ? splits[0].mode : "Split")
          : paymentMode;

        const { data: insertedInv, error } = await supabase.from("invoices").insert({
          invoice_number: `INV-${baseNum}`,
          created_at: createdAt,
          patient_id: patientId || null,
          patient_name: patientName,
          services: allServices,
          line_items: lineItemsSnapshot,
          doctor_id: doctorId || null,
          total_amount: grandTotal,
          paid_amount: paidAmount,
          status,
          payment_type: "One-time",
          payment_mode: effectivePaymentMode,
          payment_splits: splitsActive ? splits : null,
          notes: notes || null,
          tax_id: null,
          tax_rate: null,
          ...t,
        } as any).select("id").single();
        if (error) throw error;
        var summary: any = {
          invoiceNumber: `INV-${baseNum}`,
          totalAmount: grandTotal,
          paidAmount: paidAmount,
          status,
          invoiceId: insertedInv?.id as string | undefined,
        };
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

      // Lookup patient phone for WhatsApp notification
      let patientPhone: string | null = null;
      if (patientId) {
        const { data: pdata } = await supabase
          .from("patients")
          .select("phone")
          .eq("id", patientId)
          .maybeSingle();
        patientPhone = (pdata as any)?.phone ?? null;
      }

      return { summary, patientPhone, patientName };
    },
    onSuccess: async (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["pharma-inventory-billing"] });
      const msg = paymentType === "Staged" ? `${stages.length} staged invoices created` : paymentType === "Recurring" ? `${recurringCount} recurring invoices created` : "Invoice created";
      toast.success(msg);

      // Close dialog immediately; run PDF + WhatsApp in background.
      void dispatchInvoiceWhatsApp(result);
      resetForm();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Background: generate PDF and send WhatsApp without blocking the UI.
  const dispatchInvoiceWhatsApp = async (result: any) => {
    try {
      if (!result?.patientPhone || !result?.patientName || !result?.summary) return;
      const balance = Math.max(0, Number(result.summary.totalAmount) - Number(result.summary.paidAmount));

      // Recurring plan — single dedicated template, no PDF needed
      if (result.summary.isRecurring) {
        const due = result.summary.firstDueDate
          ? format(new Date(result.summary.firstDueDate), "dd MMM yyyy")
          : "";
        const { error: rWaErr } = await supabase.functions.invoke(
          "send-recurring-invoice-whatsapp",
          {
            body: {
              phone: result.patientPhone,
              patientName: result.patientName,
              serviceName: result.summary.serviceName,
              totalAmount: Number(result.summary.totalAmount).toLocaleString("en-IN"),
              installmentCount: String(result.summary.installmentCount),
              installmentAmount: Number(result.summary.installmentAmount).toLocaleString("en-IN"),
              firstDueDate: due,
            },
          },
        );
        if (rWaErr) console.error("Recurring WhatsApp send failed:", rWaErr);
        else toast.success("WhatsApp recurring plan sent to patient");
        return;
      }

      // Fire PDF generation and WhatsApp delivery in parallel.
      // The Twilio template builds the PDF link from the invoice number,
      // so the WhatsApp send does not need to wait for the PDF URL.
      const pdfPromise = result.summary.invoiceId
        ? supabase.functions.invoke("generate-invoice-pdf", {
            body: { invoiceId: result.summary.invoiceId },
          })
        : Promise.resolve({ error: null });

      const waPromise = supabase.functions.invoke("send-invoice-whatsapp", {
        body: {
          phone: result.patientPhone,
          patientName: result.patientName,
          invoiceNumber: result.summary.invoiceNumber,
          totalAmount: Number(result.summary.totalAmount).toLocaleString("en-IN"),
          paidAmount: Number(result.summary.paidAmount).toLocaleString("en-IN"),
          balanceAmount: balance.toLocaleString("en-IN"),
          status: result.summary.status,
        },
      });

      const [pdfRes, waRes] = await Promise.allSettled([pdfPromise, waPromise]);
      if (pdfRes.status === "rejected") console.error("Invoice PDF generation error:", pdfRes.reason);
      else if ((pdfRes.value as any)?.error) console.error("Invoice PDF generation failed:", (pdfRes.value as any).error);

      if (waRes.status === "rejected") {
        console.error("WhatsApp invoice send error:", waRes.reason);
      } else if ((waRes.value as any)?.error) {
        console.error("WhatsApp invoice send failed:", (waRes.value as any).error);
      } else {
        toast.success("WhatsApp invoice sent to patient");
      }
    } catch (e) {
      console.error("dispatchInvoiceWhatsApp error:", e);
    }
  };

  // Helper: when a recurring installment invoice flips to Paid,
  // generate a PDF for that specific installment and send it via WhatsApp
  // using the existing invoice template. Plain numbers are sent (₹ lives
  // in the Twilio template).
  const notifyInstallmentPaid = async (invoiceId: string) => {
    try {
      const { data: inv } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();
      if (!inv) return;
      // Only fire for recurring installments
      if ((inv as any).payment_type !== "Recurring") return;

      let phone: string | null = null;
      if ((inv as any).patient_id) {
        const { data: p } = await supabase
          .from("patients")
          .select("phone")
          .eq("id", (inv as any).patient_id)
          .maybeSingle();
        phone = (p as any)?.phone ?? null;
      }
      if (!phone) return;

      const total = Number((inv as any).total_amount) || 0;
      const paid = Number((inv as any).paid_amount) || 0;
      const balance = Math.max(0, total - paid);

      // PDF and WhatsApp run in parallel; the Twilio template builds the
      // PDF link from the invoice number, so WhatsApp does not need the URL.
      const [pdfRes, waRes] = await Promise.allSettled([
        supabase.functions.invoke("generate-invoice-pdf", { body: { invoiceId } }),
        supabase.functions.invoke("send-invoice-whatsapp", {
          body: {
            phone,
            patientName: (inv as any).patient_name,
            invoiceNumber: (inv as any).invoice_number,
            totalAmount: total.toLocaleString("en-IN"),
            paidAmount: paid.toLocaleString("en-IN"),
            balanceAmount: balance.toLocaleString("en-IN"),
            status: (inv as any).status,
          },
        }),
      ]);
      if (pdfRes.status === "rejected") console.error("Installment PDF generation error:", pdfRes.reason);
      if (waRes.status === "rejected") console.error("Installment WhatsApp send failed:", waRes.reason);
      else if ((waRes.value as any)?.error) console.error("Installment WhatsApp send failed:", (waRes.value as any).error);
      else toast.success("Installment invoice sent to patient");
    } catch (e) {
      console.error("notifyInstallmentPaid error:", e);
    }
  };

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
      return { invoiceId: paymentInv.id, becamePaid: status === "Paid" && paymentInv.status !== "Paid" };
    },
    onSuccess: async (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Payment updated");
      if (res?.becamePaid && res.invoiceId) {
        void notifyInstallmentPaid(res.invoiceId);
      }
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
      return { invoiceId: inv.id, becamePaid: inv.status !== "Paid" };
    },
    onSuccess: async (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice marked as paid");
      if (res?.becamePaid && res.invoiceId) {
        await notifyInstallmentPaid(res.invoiceId);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status, prevStatus }: { id: string; status: string; prevStatus?: string }) => {
      const updates: any = { status };
      // If marking Paid, also set paid_amount to total so totals stay consistent
      if (status === "Paid") {
        const { data: invRow } = await supabase.from("invoices").select("total_amount").eq("id", id).maybeSingle();
        if (invRow) updates.paid_amount = Number((invRow as any).total_amount) || 0;
      }
      const { error } = await supabase.from("invoices").update(updates).eq("id", id);
      if (error) throw error;
      return { invoiceId: id, becamePaid: status === "Paid" && prevStatus !== "Paid" };
    },
    onSuccess: async (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Status updated");
      if (res?.becamePaid && res.invoiceId) {
        await notifyInstallmentPaid(res.invoiceId);
      }
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
      return {
        invoiceId: viewInvoice.id,
        becamePaid: status === "Paid" && viewInvoice.status !== "Paid",
      };
    },
    onSuccess: async (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice updated");
      if (res?.becamePaid && res.invoiceId) {
        await notifyInstallmentPaid(res.invoiceId);
      }
      setIsEditing(false);
      setViewInvoice(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setPatientId("");
    setDoctorId("");
    setInvoiceDate(new Date());
    setInvoiceSeq(Date.now().toString().slice(-6));
    setServiceInputs([{ name: "", price: 0, hsn: "", gst: 0 }]);
    setPaidAmount(0);
    setPaymentType("One-time");
    setPaymentMode("Cash");
    setSplits([]);
    setNotes("");
    // tax is per-line, nothing to reset
    setPharmaItems([]);
    setStages([{ label: "Stage 1", amount: 0, paid: 0 }]);
    setRecurringCount(1);
    setRecurringAmount(0);
    setRecurringCollected([0]);
    setRecurringTotalAmount(0);
    setRecurringDueDates([new Date()]);
    setRecurringStatuses(["Pending"]);
    setSourceAppointmentId(null);
    setServiceSearchOpen(null);
  };

  const addServiceInput = () => setServiceInputs([...serviceInputs, { name: "", price: 0, hsn: "", gst: 0 }]);
  const updateServiceInput = (i: number, patch: Partial<{ name: string; price: number; hsn: string; gst: number; service_id?: string; doctor_fee?: boolean }>) => {
    setServiceInputs((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  const removeServiceInput = (i: number) => setServiceInputs(serviceInputs.filter((_, idx) => idx !== i));

  // Doctor selection: maintain a single auto "Consultation - Dr. X" line item
  // marked with `doctor_fee: true`. Replacing the doctor replaces that row.
  const handleDoctorChange = (newDoctorId: string) => {
    setDoctorId(newDoctorId);
    setServiceInputs((prev) => {
      // Strip any existing doctor-fee row first
      const stripped = prev.filter((r) => !r.doctor_fee);
      if (!newDoctorId) {
        return stripped.length > 0 ? stripped : [{ name: "", price: 0, hsn: "", gst: 0 }];
      }
      const doc: any = (doctorsList as any[]).find((d: any) => d.id === newDoctorId);
      const fee = Number(doc?.consultation_fee) || 0;
      const docName = doc ? `Dr. ${doc.first_name || ""} ${doc.last_name || ""}`.trim() : "Doctor";
      const feeRow = {
        name: `Consultation - ${docName}`,
        price: fee,
        hsn: "9993",
        gst: 0,
        doctor_fee: true as const,
      };
      // If user only had the empty initial blank row, drop it.
      const cleaned = stripped.filter((r) => r.name.trim() || r.price > 0);
      return [feeRow, ...cleaned];
    });
  };

  const addStage = () => setStages([...stages, { label: `Stage ${stages.length + 1}`, amount: 0, paid: 0 }]);
  const updateStage = (i: number, field: keyof StageRow, value: string | number) => {
    const updated = [...stages];
    (updated[i] as any)[field] = value;
    setStages(updated);
  };
  const removeStage = (i: number) => setStages(stages.filter((_, idx) => idx !== i));

  const canCreateInvoice = () => {
    const hasServices = serviceInputs.some(s => s.name.trim());
    const hasPharma = pharmaItems.some(i => i.product_id && i.quantity > 0 && i.unit_price > 0);
    const hasLineItems = hasServices || hasPharma;
    if (!hasLineItems) return false;
    if (paymentType === "Staged") return stages.some((s) => s.amount > 0);
    if (paymentType === "Recurring") return recurringCount > 0 && recurringAmount > 0;
    return (servicesSubtotal + pharmaSubtotal) > 0;
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
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setInvoiceSeq(Date.now().toString().slice(-6)); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-fit">
              <IndianRupee className="h-4 w-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] lg:max-w-[1100px] xl:max-w-[1200px] max-h-[92vh] p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-3 border-b">
              <DialogTitle className="font-display">Create Invoice</DialogTitle>
            </DialogHeader>
            <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-0 max-h-[calc(92vh-5rem)] overflow-x-auto">
            <div className="space-y-4 px-6 py-4 overflow-y-auto overflow-x-auto lg:max-h-[calc(92vh-5rem)] min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Invoice #</Label>
                  <Input value={`INV-${invoiceSeq}`} readOnly className="mt-1.5 bg-muted/50 font-mono" />
                </div>
                <div>
                  <Label>Invoice Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("mt-1.5 w-full justify-start text-left font-normal", !invoiceDate && "text-muted-foreground")}>
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {invoiceDate ? format(invoiceDate, "dd MMM yyyy") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={invoiceDate} onSelect={(d) => d && setInvoiceDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Patient</Label>
                  <PatientCombobox
                    value={patientId}
                    onValueChange={setPatientId}
                    placeholder="Select patient"
                    className="mt-1.5"
                  />
                </div>
                <div>
                <Label>Doctor</Label>
                <StaffCombobox
                  value={doctorId}
                  onValueChange={handleDoctorChange}
                  allowNone
                  noneLabel="No doctor"
                  placeholder="Select doctor"
                  className="mt-1.5"
                  roleFilter={["Doctor"]}
                />
                {doctorId && (() => {
                  const d: any = (doctorsList as any[]).find((x: any) => x.id === doctorId);
                  const fee = Number(d?.consultation_fee) || 0;
                  return (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {fee > 0
                        ? `Consultation fee ₹${fee.toLocaleString()} added as a line item.`
                        : "This doctor has no consultation fee set in Staff Master."}
                    </p>
                  );
                })()}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Services</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={addServiceInput}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {serviceInputs.map((s, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex gap-2 items-center">
                      <Popover open={serviceSearchOpen === i} onOpenChange={(open) => setServiceSearchOpen(open ? i : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10">
                            {s.name || <span className="text-muted-foreground">Select service...</span>}
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
                                  <CommandItem key={svc.id} value={svc.name} onSelect={() => {
                                    updateServiceInput(i, {
                                      name: svc.name,
                                      price: Number(svc.price) || 0,
                                      hsn: svc.hsn_code || "",
                                      gst: Number(svc.gst_percent) || 0,
                                      service_id: svc.id,
                                    });
                                    setServiceSearchOpen(null);
                                  }}>
                                    <Check className={cn("mr-2 h-4 w-4", s.name === svc.name ? "opacity-100" : "opacity-0")} />
                                    <span>{svc.name}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">₹{svc.price}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="number"
                        className="h-10 w-24 shrink-0 text-right"
                        placeholder="₹ Price"
                        value={s.price || ""}
                        onChange={(e) => updateServiceInput(i, { price: parseFloat(e.target.value) || 0 })}
                      />
                      <Input
                        className="h-10 w-24 shrink-0"
                        placeholder="HSN"
                        value={s.hsn || ""}
                        onChange={(e) => updateServiceInput(i, { hsn: e.target.value })}
                      />
                      {serviceInputs.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive text-xs shrink-0" disabled={!!s.doctor_fee} onClick={() => removeServiceInput(i)}>✕</Button>
                      )}
                    </div>
                    {s.price > 0 && (() => {
                      const lineTax = getServiceLineTax(s.name, s.price, (s as any).hsn);
                      return (
                        <div className="text-xs text-muted-foreground text-right pr-7 mt-0.5">
                          {lineTax.rate > 0
                            ? `IGST ${((lineTax.igst / (s.price || 1)) * 100).toFixed(0)}% + CGST ${((lineTax.cgst / (s.price || 1)) * 100).toFixed(0)}% = Tax (${lineTax.rate}%): ₹${lineTax.taxAmount.toFixed(2)}`
                            : "No tax"}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>

              {/* Pharma Products */}
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Pill className="h-4 w-4" />
                    </span>
                    <div>
                      <Label className="text-sm font-semibold">Pharmacy</Label>
                      <p className="text-[11px] text-muted-foreground">Medicines & products billed with this invoice</p>
                    </div>
                    {pharmaItems.length > 0 && (
                      <Badge variant="secondary" className="ml-1">{pharmaItems.length}</Badge>
                    )}
                  </div>
                  <Button type="button" size="sm" className="h-8 text-xs shadow-sm" onClick={addPharmaItem}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Product
                  </Button>
                </div>
                {pharmaItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-primary/40 bg-background/60 px-3 py-4 text-center">
                    <p className="text-xs text-muted-foreground">No pharmacy products added yet — use <span className="font-medium text-foreground">Add Product</span> to bill medicines.</p>
                  </div>
                )}
                {pharmaItems.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-3 mb-2 space-y-2 bg-background">
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
                          <SelectTrigger className="mt-1"><SelectValue placeholder={item.product_id ? "No batch" : "Select product first"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="placeholder">No batch</SelectItem>
                            {(pharmaInventory as any[])
                              .filter((i: any) => i.product_id === item.product_id && i.quantity > 0 && new Date(i.expiry_date) > new Date())
                              .map((i: any) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.batch_number} · {i.quantity} left
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" className="mt-1 h-8" min={1} max={item.inventory_id ? item.available : undefined} value={item.quantity} onChange={(e) => updatePharmaItem(idx, "quantity", parseInt(e.target.value) || 1)} />
                      </div>
                      <div>
                        <Label className="text-xs">Price (₹)</Label>
                        <Input type="number" className="mt-1 h-8" value={item.unit_price} onChange={(e) => updatePharmaItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="flex items-end justify-end">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">₹{(item.quantity * item.unit_price).toFixed(2)}</span>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePharmaItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {(() => {
                            const lineTax = getProductLineTax(item.product_id, item.quantity * item.unit_price, item.inventory_id);
                            const hsn = getProductHsn(item.product_id, item.inventory_id);
                            return (
                              <span className="text-xs text-muted-foreground mt-0.5 pr-9">
                                {hsn ? `HSN ${hsn} · ` : ""}
                                {lineTax.rate > 0
                                  ? `Tax (${lineTax.rate}%): ₹${lineTax.taxAmount.toFixed(2)}`
                                  : "No tax"}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {pharmaItems.length > 0 && (
                  <div className="text-right text-sm font-semibold text-foreground">
                    Products subtotal: ₹{pharmaSubtotal.toLocaleString()}
                  </div>
                )}
              </div>

              {/* Commercial */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Commercial</h3>
                  <p className="text-[11px] text-muted-foreground">Payment terms, mode and collection details</p>
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
                  <div className="flex items-center justify-between">
                    <Label>Payment Mode</Label>
                    {paymentType === "One-time" && (
                      splits.length === 0 ? (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setSplits([{ mode: "Cash", amount: paidAmount || 0 }, { mode: "UPI", amount: 0 }])}
                        >
                          + Split Payment
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => setSplits([])}
                        >
                          Use single mode
                        </button>
                      )
                    )}
                  </div>
                  {splits.length === 0 ? (
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Cash", "Card", "UPI", "Insurance", "Bank Transfer"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1.5 space-y-2">
                      {splits.map((row, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Select
                            value={row.mode}
                            onValueChange={(v) => setSplits(splits.map((r, i) => i === idx ? { ...r, mode: v } : r))}
                          >
                            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["Cash", "Card", "UPI", "Insurance", "Bank Transfer"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="Amount"
                            className="w-28"
                            value={row.amount || ""}
                            onChange={(e) => setSplits(splits.map((r, i) => i === idx ? { ...r, amount: parseFloat(e.target.value) || 0 } : r))}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {splits.length < 3 && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setSplits([...splits, { mode: "Cash", amount: 0 }])}
                        >
                          + Add row
                        </button>
                      )}
                      {(() => {
                        const total = splits.reduce((s, r) => s + (Number(r.amount) || 0), 0);
                        const matches = Math.round(total * 100) === Math.round((paidAmount || 0) * 100);
                        return (
                          <div className={`text-xs ${matches ? "text-muted-foreground" : "text-destructive"}`}>
                            Split total ₹{total.toLocaleString("en-IN")} / Paid ₹{Number(paidAmount || 0).toLocaleString("en-IN")}
                            {!matches && <div>Split amounts must equal paid amount</div>}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Tax is auto-applied per item from Tax Master mappings — no manual selector */}
              </div>

              {paymentType === "One-time" && (
                <div className="space-y-3 lg:hidden">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Services Subtotal (₹)</Label>
                      <Input type="number" className="mt-1.5 bg-muted" value={servicesSubtotal} readOnly />
                    </div>
                    <div>
                      <Label>Paid Amount (₹)</Label>
                      <Input type="number" className="mt-1.5" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  {((servicesSubtotal + pharmaSubtotal) > 0) && (() => {
                    const subtotal = servicesSubtotal + pharmaSubtotal;
                    // Sum per-line tax across services and pharma
                    const totalCgst = lineTaxRows.reduce((s, r) => s + r.cgst, 0);
                    const totalSgst = lineTaxRows.reduce((s, r) => s + r.sgst, 0);
                    const totalIgst = lineTaxRows.reduce((s, r) => s + r.igst, 0);
                    const totalTax = totalCgst + totalSgst + totalIgst;
                    return (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                        {lineTaxRows.length > 0 && (
                          <div className="rounded-md border bg-background/70 overflow-hidden mb-2">
                            {lineTaxRows.map((r) => (
                              <div key={r.key} className="flex justify-between gap-2 px-2 py-1.5 text-[11px] border-b last:border-b-0">
                                <span className="min-w-0 truncate">
                                  {r.name}
                                  <span className="text-muted-foreground"> · {r.rate > 0 ? `GST ${r.rate}%` : "No tax"}</span>
                                </span>
                                <span className="tabular-nums whitespace-nowrap">₹{r.amount.toFixed(0)} + ₹{r.tax.toFixed(2)} = <strong>₹{(r.amount + r.tax).toFixed(2)}</strong></span>
                              </div>
                            ))}
                          </div>
                        )}
                        {servicesSubtotal > 0 && (
                          <div className="flex justify-between"><span className="text-muted-foreground">Services Subtotal</span><span>₹{servicesSubtotal.toLocaleString()}</span></div>
                        )}
                        {pharmaSubtotal > 0 && (
                          <div className="flex justify-between"><span className="text-muted-foreground">Products Subtotal</span><span>₹{pharmaSubtotal.toLocaleString()}</span></div>
                        )}
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                        {totalCgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>₹{totalCgst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                        {totalSgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>₹{totalSgst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                        {totalIgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>₹{totalIgst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                        <div className="flex justify-between font-semibold text-primary border-t pt-1 mt-1"><span>Grand Total</span><span>₹{(subtotal + totalTax).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
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
                              const updatedCollected = [...recurringCollected];
                              if (v === "Paid") {
                                updatedCollected[i] = recurringAmount;
                              } else if (instStatus === "Paid") {
                                updatedCollected[i] = 0;
                              }
                              setRecurringCollected(updatedCollected);
                            }}>
                              <SelectTrigger className="h-7 text-xs px-1.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["Pending", "Paid", "Partial", "Overdue"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input type="number" className="h-7 text-xs" placeholder="0" disabled={instStatus === "Paid"} value={instStatus === "Paid" ? recurringAmount : (recurringCollected[i] || 0)} onChange={(e) => {
                              const updated = [...recurringCollected];
                              updated[i] = parseFloat(e.target.value) || 0;
                              setRecurringCollected(updated);
                            }} />
                            <div className="col-span-5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span>Tax ₹{installmentTax.tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              <span className="font-medium text-foreground">Total ₹{installmentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              <span className="flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" />
                                {i === 0 && sourceAppointmentId
                                  ? "Linked to current appointment"
                                  : `Recurring appointment will be created on ${format(dueDate, "dd MMM yyyy")}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Installment 1 of {recurringCount}</span><span>₹{recurringAmount.toLocaleString()}</span></div>
                    {installmentTax.cgst > 0 && (
                      <>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">CGST</span><span>₹{installmentTax.cgst.toFixed(2)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">SGST</span><span>₹{installmentTax.sgst.toFixed(2)}</span></div>
                      </>
                    )}
                    {installmentTax.igst > 0 && (
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">IGST</span><span>₹{installmentTax.igst.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between text-primary font-semibold border-t pt-1"><span>Payable now (incl. tax)</span><span>₹{installmentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between pt-1"><span className="text-muted-foreground">Scheduled later ({recurringCount - 1} × ₹{recurringAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}, tax at collection)</span><span>₹{(recurringAmount * Math.max(0, recurringCount - 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plan total</span><span className="font-semibold">₹{(installmentTotal + recurringAmount * Math.max(0, recurringCount - 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total collected</span><span>₹{recurringPaidTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between font-semibold"><span>Balance</span><span>₹{(installmentTotal + recurringAmount * Math.max(0, recurringCount - 1) - recurringPaidTotal).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    <p className="text-xs text-muted-foreground mt-1">1 invoice (taxed now) + {Math.max(0, recurringCount - 1)} scheduled amount(s), and {sourceAppointmentId ? recurringCount - 1 : recurringCount} recurring appointment(s) will be created</p>
                  </div>
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea className="mt-1.5" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              {/* Mobile-only inline create button (sticky panel handles desktop) */}
              <Button className="w-full lg:hidden" onClick={() => createInvoice.mutate()} disabled={!canCreateInvoice() || createInvoice.isPending}>
                {createInvoice.isPending ? "Creating..." : paymentType === "Staged" ? `Create ${stages.length} Staged Invoice(s)` : paymentType === "Recurring" ? `Create ${recurringCount} Recurring Invoice(s)` : "Create Invoice"}
              </Button>
            </div>

            {/* Right sticky summary panel (desktop) */}
            <aside className="hidden lg:flex flex-col border-l bg-muted/20 max-h-[calc(92vh-5rem)]">
              <div className="px-5 py-4 border-b">
                <h3 className="font-display font-semibold text-sm">Invoice Summary</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Totals update as you edit</p>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm">
                {(() => {
                  if (paymentType === "Staged") {
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Total across stages</span><span className="font-semibold">₹{stagedTotal.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Total collected</span><span>₹{stagedPaid.toLocaleString()}</span></div>
                        <div className="flex justify-between text-primary font-semibold border-t pt-2 mt-2"><span>Balance</span><span>₹{(stagedTotal - stagedPaid).toLocaleString()}</span></div>
                        <p className="text-xs text-muted-foreground mt-1">{stages.length} invoice(s) will be created</p>
                      </div>
                    );
                  }
                  if (paymentType === "Recurring") {
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Installment 1 of {recurringCount}</span><span>₹{recurringAmount.toLocaleString()}</span></div>
                        {installmentTax.cgst > 0 && (
                          <>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">CGST</span><span>₹{installmentTax.cgst.toFixed(2)}</span></div>
                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">SGST</span><span>₹{installmentTax.sgst.toFixed(2)}</span></div>
                          </>
                        )}
                        {installmentTax.igst > 0 && (
                          <div className="flex justify-between text-xs"><span className="text-muted-foreground">IGST</span><span>₹{installmentTax.igst.toFixed(2)}</span></div>
                        )}
                        <div className="flex justify-between text-primary font-semibold border-t pt-2 mt-2"><span>Payable now (incl. tax)</span><span>₹{installmentTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between pt-1"><span className="text-muted-foreground">Scheduled later ({Math.max(0, recurringCount - 1)} × ₹{recurringAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}, tax at collection)</span><span>₹{(recurringAmount * Math.max(0, recurringCount - 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Plan total</span><span className="font-semibold">₹{(installmentTotal + recurringAmount * Math.max(0, recurringCount - 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Total collected</span><span>₹{recurringPaidTotal.toLocaleString()}</span></div>
                        <div className="flex justify-between font-semibold"><span>Balance</span><span>₹{(installmentTotal + recurringAmount * Math.max(0, recurringCount - 1) - recurringPaidTotal).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                        <p className="text-xs text-muted-foreground mt-1">1 invoice (taxed now) + {Math.max(0, recurringCount - 1)} scheduled amount(s), and {sourceAppointmentId ? recurringCount - 1 : recurringCount} recurring appointment(s) will be created</p>
                      </div>
                    );
                  }
                  // One-time
                  const subtotal = servicesSubtotal + pharmaSubtotal;
                  const totalCgst = lineTaxRows.reduce((s, r) => s + r.cgst, 0);
                  const totalSgst = lineTaxRows.reduce((s, r) => s + r.sgst, 0);
                  const totalIgst = lineTaxRows.reduce((s, r) => s + r.igst, 0);
                  const totalTax = totalCgst + totalSgst + totalIgst;
                  const grand = subtotal + totalTax;
                  const balance = grand - (Number(paidAmount) || 0);
                  return (
                    <div className="space-y-1">
                      {lineTaxRows.length > 0 && (
                        <div className="rounded-lg border bg-background/70 overflow-hidden mb-3">
                          <div className="grid grid-cols-[1fr_46px_58px_62px] gap-1 px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/60">
                            <span>Line item</span>
                            <span className="text-right">Amt</span>
                            <span className="text-right">Tax</span>
                            <span className="text-right">Total</span>
                          </div>
                          {lineTaxRows.map((r) => (
                            <div key={r.key} className="grid grid-cols-[1fr_46px_58px_62px] gap-1 px-2 py-1.5 text-[11px] border-t items-start">
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{r.name}</span>
                                <span className="block text-[10px] text-muted-foreground">
                                  {r.kind}{r.qty > 1 ? ` · x${r.qty}` : ""}{r.hsn ? ` · HSN ${r.hsn}` : ""} · {r.rate > 0 ? `GST ${r.rate}%` : "No tax"}
                                </span>
                              </span>
                              <span className="text-right tabular-nums">₹{r.amount.toFixed(0)}</span>
                              <span className="text-right tabular-nums">₹{r.tax.toFixed(2)}</span>
                              <span className="text-right tabular-nums font-medium">₹{(r.amount + r.tax).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {servicesSubtotal > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Services</span><span>₹{servicesSubtotal.toLocaleString()}</span></div>
                      )}
                      {pharmaSubtotal > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Products</span><span>₹{pharmaSubtotal.toLocaleString()}</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                      {totalCgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>₹{totalCgst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                      {totalSgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>₹{totalSgst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                      {totalIgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>₹{totalIgst.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                      <div className="flex justify-between font-semibold text-primary border-t pt-2 mt-2"><span>Grand Total</span><span>₹{grand.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                      <div className="pt-2 mt-2 border-t space-y-2">
                        <div>
                          <Label className="text-xs">Paid Amount (₹)</Label>
                          <Input type="number" className="mt-1 h-9" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Balance Due</span>
                          <span className={balance > 0 ? "text-destructive font-medium" : "text-primary font-medium"}>
                            ₹{balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="border-t px-5 py-4 bg-background/60">
                <Button className="w-full" onClick={() => createInvoice.mutate()} disabled={!canCreateInvoice() || createInvoice.isPending}>
                  {createInvoice.isPending ? "Creating..." : paymentType === "Staged" ? `Create ${stages.length} Staged Invoice(s)` : paymentType === "Recurring" ? `Create ${recurringCount} Recurring Invoice(s)` : "Create Invoice"}
                </Button>
              </div>
            </aside>
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
                      <Select value={inv.status} onValueChange={(v) => updateInvoiceStatus.mutate({ id: inv.id, status: v, prevStatus: inv.status })}>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Open Invoice PDF" onClick={() => openInvoicePDF(inv)}>
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
                <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => openInvoicePDF(viewInvoice)}>
                  <FileText className="h-3.5 w-3.5" /> PDF
                </Button>
              </div>

              {/* Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground text-xs block">Patient</span><span className="font-medium">{viewInvoice.patient_name || "Walk-in"}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Date</span><span className="font-medium">{format(new Date(viewInvoice.created_at), "PPP")}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Doctor</span><span className="font-medium">{getDrName(viewInvoice) || "—"}</span></div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Payment Mode</span>
                    {Array.isArray(viewInvoice.payment_splits) && viewInvoice.payment_splits.length > 1 ? (
                      <span className="font-medium">
                        {viewInvoice.payment_splits.map((p: any) => `${p.mode}: ₹${Number(p.amount).toLocaleString("en-IN")}`).join("  ·  ")}
                      </span>
                    ) : (
                      <span className="font-medium">{viewInvoice.payment_mode || "Cash"}</span>
                    )}
                  </div>
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
