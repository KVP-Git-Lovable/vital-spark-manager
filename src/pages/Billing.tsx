import { Search, Filter, Download, IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { StatCard } from "@/components/dashboard/StatCard";

const mockInvoices = [
  { id: "INV-001", patient: "Sarah Johnson", services: ["Chemical Peel", "Consultation"], total: 4500, paid: 4500, status: "Paid", date: "2026-03-09", type: "One-time" },
  { id: "INV-002", patient: "Michael Chen", services: ["Botox Treatment"], total: 8000, paid: 4000, status: "Partial", date: "2026-03-08", type: "Staged" },
  { id: "INV-003", patient: "Emily Davis", services: ["Laser Resurfacing"], total: 12000, paid: 0, status: "Pending", date: "2026-03-07", type: "One-time" },
  { id: "INV-004", patient: "Lisa Park", services: ["Microneedling", "PRP Therapy"], total: 12000, paid: 12000, status: "Paid", date: "2026-03-06", type: "One-time" },
  { id: "INV-005", patient: "Raj Patel", services: ["Monthly Skin Care Package"], total: 5000, paid: 5000, status: "Paid", date: "2026-03-05", type: "Recurring" },
];

const statusStyles: Record<string, string> = {
  Paid: "bg-success/10 text-success",
  Partial: "bg-warning/10 text-warning",
  Pending: "bg-destructive/10 text-destructive",
};

const Billing = () => {
  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">Manage invoices and payments</p>
        </div>
        <Button className="gap-2 w-fit">
          <IndianRupee className="h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Revenue" value="₹41,500" change="This month" icon={IndianRupee} iconColor="bg-success/10 text-success" />
        <StatCard title="Pending" value="₹12,000" change="1 invoice" icon={IndianRupee} iconColor="bg-destructive/10 text-destructive" delay={0.05} />
        <StatCard title="Partial Payments" value="₹4,000" change="1 invoice" icon={IndianRupee} iconColor="bg-warning/10 text-warning" delay={0.1} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="data-table"
      >
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." className="pl-9 bg-muted border-0" />
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
              {mockInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="p-4">
                    <p className="font-medium text-sm">{inv.id}</p>
                    <p className="text-xs text-muted-foreground">{inv.date}</p>
                  </td>
                  <td className="p-4 text-sm">{inv.patient}</td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {inv.services.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">{inv.type}</Badge>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-semibold text-sm">₹{inv.total.toLocaleString()}</p>
                    {inv.status === "Partial" && (
                      <p className="text-xs text-muted-foreground">Paid: ₹{inv.paid.toLocaleString()}</p>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Billing;
