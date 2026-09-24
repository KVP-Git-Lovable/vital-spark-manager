/**
 * Is a Create Invoice form still holding something a person put there?
 *
 * Billing's create dialog now empties itself every time staff open it, because
 * its state is shared with Edit Invoice and with the appointment "New Bill"
 * prefill and used to survive an abandoned bill - which is how invoices ended
 * up carrying service lines nobody had chosen for that patient.
 *
 * Clearing on open makes an accidental Escape unrecoverable, so this decides
 * when an accidental dismissal is worth blocking. It is intentionally generous:
 * anything at all filled in counts, because the cost of blocking Escape is one
 * extra click and the cost of guessing wrong is losing a half-entered bill.
 */
export interface InvoiceFormSnapshot {
  patientId?: string | null;
  doctorId?: string | null;
  serviceInputs?: { name?: string | null; price?: number | null }[];
  pharmaItemCount?: number;
  paidAmount?: number | null;
  notes?: string | null;
}

export const invoiceFormHasContent = (form: InvoiceFormSnapshot): boolean => {
  if (form.patientId) return true;
  if (form.doctorId) return true;
  if ((form.serviceInputs ?? []).some((s) => (s?.name ?? "").trim() !== "" || Number(s?.price) > 0)) return true;
  if (Number(form.pharmaItemCount) > 0) return true;
  if (Number(form.paidAmount) > 0) return true;
  if ((form.notes ?? "").trim() !== "") return true;
  return false;
};
