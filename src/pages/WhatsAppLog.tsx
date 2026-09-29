import { WhatsAppDeliveryLog } from "@/components/shared/WhatsAppDeliveryLog";

export default function WhatsAppLog() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Delivery</h1>
        <p className="text-sm text-muted-foreground">Appointment confirmations sent to patients and whether they arrived.</p>
      </div>
      <WhatsAppDeliveryLog />
    </div>
  );
}
