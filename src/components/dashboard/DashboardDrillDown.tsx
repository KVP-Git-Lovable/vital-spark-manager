import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  records: any[];
  type: string;
}

export function DashboardDrillDown({ open, onOpenChange, title, records, type }: Props) {
  const navigate = useNavigate();

  const handleRecordClick = (record: any) => {
    onOpenChange(false);
    if (type === "revenue_by_date" || type === "billing_by_dr") {
      navigate("/billing");
    } else {
      navigate("/appointments");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No records found</p>
        ) : type === "revenue_by_date" || type === "billing_by_dr" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Invoice #</TableHead>
                <TableHead className="text-xs">Patient</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Paid</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r: any) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRecordClick(r)}>
                  <TableCell className="text-xs text-primary underline font-medium">{r.invoice_number}</TableCell>
                  <TableCell className="text-xs">{r.patient_name || "Walk-in"}</TableCell>
                  <TableCell className="text-xs">₹{Number(r.total_amount).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">₹{Number(r.paid_amount).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{format(new Date(r.created_at), "dd MMM yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Patient</TableHead>
                <TableHead className="text-xs">Service</TableHead>
                <TableHead className="text-xs">Staff</TableHead>
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r: any) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRecordClick(r)}>
                  <TableCell className="text-xs text-primary underline font-medium">
                    {r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : r.patient_name || "Walk-in"}
                  </TableCell>
                  <TableCell className="text-xs">{r.service}</TableCell>
                  <TableCell className="text-xs">{r.staff ? `Dr. ${r.staff.first_name}` : "—"}</TableCell>
                  <TableCell className="text-xs">{format(new Date(r.start_time), "dd MMM h:mm a")}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
