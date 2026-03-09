import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hours = Array.from({ length: 10 }, (_, i) => i + 9); // 9 AM to 6 PM

interface CalendarAppointment {
  id: string;
  patient: string;
  service: string;
  time: string;
  duration: number;
  day: number;
  hour: number;
  color: string;
}

const appointmentColors = [
  "bg-primary/15 border-primary/30 text-primary",
  "bg-info/15 border-info/30 text-info",
  "bg-success/15 border-success/30 text-success",
  "bg-warning/15 border-warning/30 text-warning",
];

const today = new Date();
const currentDay = today.getDay();

const mockAppointments: CalendarAppointment[] = [
  { id: "1", patient: "Sarah Johnson", service: "Chemical Peel", time: "9:00 AM", duration: 45, day: currentDay, hour: 9, color: appointmentColors[0] },
  { id: "2", patient: "Michael Chen", service: "Botox", time: "10:30 AM", duration: 30, day: currentDay, hour: 10, color: appointmentColors[1] },
  { id: "3", patient: "Emily Davis", service: "Laser Resurfacing", time: "11:00 AM", duration: 60, day: currentDay, hour: 11, color: appointmentColors[2] },
  { id: "4", patient: "James Wilson", service: "Dermal Fillers", time: "1:00 PM", duration: 45, day: currentDay, hour: 13, color: appointmentColors[3] },
  { id: "5", patient: "Lisa Park", service: "Microneedling", time: "2:30 PM", duration: 40, day: currentDay, hour: 14, color: appointmentColors[0] },
  { id: "6", patient: "Raj Patel", service: "PRP Therapy", time: "10:00 AM", duration: 60, day: (currentDay + 1) % 7, hour: 10, color: appointmentColors[1] },
  { id: "7", patient: "Anita Sharma", service: "Chemical Peel", time: "3:00 PM", duration: 45, day: (currentDay + 2) % 7, hour: 15, color: appointmentColors[2] },
];

const Appointments = () => {
  const [view, setView] = useState<"week" | "day">("week");
  const [currentDate] = useState(new Date());

  const getWeekDates = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDates();

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle">Calendar view of all scheduled appointments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant={view === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("day")}
              className="text-xs"
            >
              Day
            </Button>
            <Button
              variant={view === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("week")}
              className="text-xs"
            >
              Week
            </Button>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Appointment
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="data-table"
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-display font-semibold">
              {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="text-xs">
            Today
          </Button>
        </div>

        <div className="overflow-x-auto">
          {view === "week" ? (
            <div className="min-w-[800px]">
              {/* Week header */}
              <div className="grid grid-cols-8 border-b">
                <div className="p-3 text-xs text-muted-foreground" />
                {weekDates.map((date, i) => {
                  const isToday = date.toDateString() === today.toDateString();
                  return (
                    <div key={i} className={`p-3 text-center border-l ${isToday ? "bg-primary/5" : ""}`}>
                      <p className="text-xs text-muted-foreground">{daysOfWeek[i]}</p>
                      <p className={`text-lg font-display font-semibold mt-0.5 ${isToday ? "text-primary" : ""}`}>
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b last:border-0 min-h-[72px]">
                  <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">
                    {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`}
                  </div>
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const dayAppts = mockAppointments.filter(
                      (a) => a.day === dayIndex && a.hour === hour
                    );
                    const isToday = weekDates[dayIndex]?.toDateString() === today.toDateString();
                    return (
                      <div key={dayIndex} className={`border-l p-1 ${isToday ? "bg-primary/5" : ""}`}>
                        {dayAppts.map((apt) => (
                          <div
                            key={apt.id}
                            className={`rounded-md border p-2 text-xs cursor-pointer hover:opacity-80 transition-opacity ${apt.color}`}
                          >
                            <p className="font-medium truncate">{apt.patient}</p>
                            <p className="opacity-70 truncate">{apt.service}</p>
                            <div className="flex items-center gap-1 mt-1 opacity-70">
                              <Clock className="h-3 w-3" />
                              <span>{apt.duration}m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="min-w-[400px]">
              <div className="p-3 text-center border-b bg-primary/5">
                <p className="text-xs text-muted-foreground">{daysOfWeek[currentDay]}</p>
                <p className="text-2xl font-display font-bold text-primary">{today.getDate()}</p>
              </div>
              {hours.map((hour) => {
                const dayAppts = mockAppointments.filter(
                  (a) => a.day === currentDay && a.hour === hour
                );
                return (
                  <div key={hour} className="flex border-b last:border-0 min-h-[72px]">
                    <div className="w-24 p-3 text-sm text-muted-foreground text-right shrink-0">
                      {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`}
                    </div>
                    <div className="flex-1 border-l p-2 space-y-1">
                      {dayAppts.map((apt) => (
                        <div
                          key={apt.id}
                          className={`rounded-lg border p-3 cursor-pointer hover:opacity-80 transition-opacity ${apt.color}`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{apt.patient}</p>
                            <span className="text-xs opacity-70">{apt.time}</span>
                          </div>
                          <p className="text-xs opacity-70 mt-0.5">{apt.service} · {apt.duration} mins</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Appointments;
