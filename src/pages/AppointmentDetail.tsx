import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentDetailSheet } from "@/components/appointments/AppointmentDetailSheet";

interface AppointmentDetailProps {
  appointmentId?: string;
  /** Supplied when opened as the overlay; the route version goes back to the list. */
  onClose?: () => void;
}

export default function AppointmentDetail({ appointmentId: propAppointmentId, onClose }: AppointmentDetailProps) {
  const { id: paramsId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const appointmentId = propAppointmentId || paramsId;
  const close = onClose ?? (() => navigate("/appointments"));

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={close}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Appointments
      </Button>
      <AppointmentDetailSheet
        appointmentId={appointmentId ?? null}
        variant="page"
        onClose={close}
      />
    </div>
  );
}
