import { Navigate } from "react-router-dom";

/**
 * /admin/attendance now lives on /attendance.
 *
 * Kept as a redirect rather than deleted: the address is in the clinic's
 * history and in the messages where I pointed them at it. Attendance is one
 * page now - your own day at the top, everybody else's underneath for
 * admins - because two screens both called Attendance is what sent people
 * looking for check-in on the wrong one.
 */
export default function AttendanceAdmin() {
  return <Navigate to="/attendance" replace />;
}
