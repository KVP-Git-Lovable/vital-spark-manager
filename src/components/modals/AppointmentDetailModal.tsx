import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/useModal";
import AppointmentDetail from "@/pages/AppointmentDetail";

export function AppointmentDetailModal() {
  const { openModal, selectedAppointmentId, closeModal } = useModal();

  if (openModal !== "appointmentDetail" || !selectedAppointmentId) return null;

  return (
    <div className="absolute inset-0 z-50 bg-background overflow-auto">
      {/* Header with Close Button */}
      <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-background border-b">
        <h2 className="text-lg font-semibold">Appointment Details</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeModal}
          className="h-8 w-8"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Modal Content - Full Width with minimal padding */}
      <div className="w-full px-3 md:px-6 py-4">
        <AppointmentDetail appointmentId={selectedAppointmentId} />
      </div>
    </div>
  );
}
