import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/useModal";
import Appointments from "@/pages/Appointments";

export function AppointmentsModal() {
  const { openModal, closeModal } = useModal();

  if (openModal !== "appointments") return null;

  return (
    <div className="absolute inset-0 z-50 bg-background overflow-auto">
      {/* Close Button - Header */}
      <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-background border-b">
        <h2 className="text-lg font-semibold">Appointments</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeModal}
          className="h-8 w-8"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Modal Content */}
      <div className="w-full px-3 md:px-6 py-6">
        <Appointments />
      </div>
    </div>
  );
}
