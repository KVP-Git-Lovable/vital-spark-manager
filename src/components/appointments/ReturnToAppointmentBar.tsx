import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  forgetOpenAppointment,
  readOpenAppointment,
  returnLabel,
  shouldOfferReturn,
  type OpenAppointment,
} from "@/lib/openAppointment";

/**
 * One tap back to the appointment someone left to do something else.
 *
 * Same shape as BackToReportBar, deliberately: a second pattern for the same
 * job would be the churn the clinic has already objected to.
 */
export function ReturnToAppointmentBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [remembered, setRemembered] = useState<OpenAppointment | null>(null);

  useEffect(() => {
    const open = readOpenAppointment();
    setRemembered(shouldOfferReturn(location.pathname, open) ? open : null);
  }, [location.pathname]);

  if (!remembered) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => {
          forgetOpenAppointment();
          navigate(`/appointments/${remembered.id}`);
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {returnLabel(remembered)}
      </button>
    </div>
  );
}
