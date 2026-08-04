import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentDetailSheet } from "@/components/appointments/AppointmentDetailSheet";

export default function AppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/appointments")}>
        <ArrowLeft className="h-4 w-4" /> Back to Appointments
      </Button>
      <AppointmentDetailSheet
        appointmentId={id ?? null}
        variant="page"
        onClose={() => navigate("/appointments")}
      />
    </div>
  );
}
