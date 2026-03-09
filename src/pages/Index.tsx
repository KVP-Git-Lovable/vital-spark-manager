import { Users, Calendar, DollarSign, TrendingUp, Clock, UserPlus } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";

const recentAppointments = [
  { id: 1, patient: "Sarah Johnson", service: "Chemical Peel", time: "9:00 AM", status: "Completed" },
  { id: 2, patient: "Michael Chen", service: "Botox Treatment", time: "10:30 AM", status: "In Progress" },
  { id: 3, patient: "Emily Davis", service: "Laser Resurfacing", time: "11:45 AM", status: "Upcoming" },
  { id: 4, patient: "James Wilson", service: "Dermal Fillers", time: "1:00 PM", status: "Upcoming" },
  { id: 5, patient: "Lisa Park", service: "Microneedling", time: "2:30 PM", status: "Upcoming" },
];

const statusColors: Record<string, string> = {
  Completed: "bg-success/10 text-success",
  "In Progress": "bg-warning/10 text-warning",
  Upcoming: "bg-info/10 text-info",
};

const Index = () => {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back! Here's your clinic overview for today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Today's Patients"
          value={12}
          change="+3 from yesterday"
          changeType="positive"
          icon={Users}
          delay={0}
        />
        <StatCard
          title="Appointments"
          value={8}
          change="2 remaining"
          changeType="neutral"
          icon={Calendar}
          iconColor="bg-info/10 text-info"
          delay={0.05}
        />
        <StatCard
          title="Revenue Today"
          value="₹45,200"
          change="+12% vs avg"
          changeType="positive"
          icon={DollarSign}
          iconColor="bg-success/10 text-success"
          delay={0.1}
        />
        <StatCard
          title="New Patients"
          value={3}
          change="This week: 14"
          changeType="positive"
          icon={UserPlus}
          iconColor="bg-warning/10 text-warning"
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="lg:col-span-2 data-table"
        >
          <div className="p-5 border-b">
            <h2 className="font-display font-semibold text-lg">Today's Appointments</h2>
          </div>
          <div className="divide-y">
            {recentAppointments.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-semibold text-sm">
                    {apt.patient.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{apt.patient}</p>
                    <p className="text-xs text-muted-foreground">{apt.service}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-sm">{apt.time}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[apt.status]}`}>
                    {apt.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="data-table"
        >
          <div className="p-5 border-b">
            <h2 className="font-display font-semibold text-lg">Quick Stats</h2>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Appointment Capacity</span>
                <span className="font-medium">75%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-primary transition-all" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Patient Satisfaction</span>
                <span className="font-medium">92%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: "92%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Revenue Target</span>
                <span className="font-medium">68%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-warning transition-all" style={{ width: "68%" }} />
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-display font-semibold text-sm mb-3">Top Services Today</h3>
              <div className="space-y-2">
                {["Chemical Peel", "Botox", "Laser Treatment"].map((service, i) => (
                  <div key={service} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{service}</span>
                    <span className="font-medium">{[4, 3, 2][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
