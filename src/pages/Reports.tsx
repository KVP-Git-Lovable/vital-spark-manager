import { BarChart3, Users, TrendingUp, IndianRupee } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const revenueData = [
  { day: "Mon", revenue: 12000 },
  { day: "Tue", revenue: 18000 },
  { day: "Wed", revenue: 15000 },
  { day: "Thu", revenue: 22000 },
  { day: "Fri", revenue: 28000 },
  { day: "Sat", revenue: 32000 },
  { day: "Sun", revenue: 8000 },
];

const serviceDistribution = [
  { name: "Chemical Peel", value: 30 },
  { name: "Botox", value: 25 },
  { name: "Laser", value: 20 },
  { name: "Fillers", value: 15 },
  { name: "Other", value: 10 },
];

const patientTrend = [
  { week: "W1", patients: 42 },
  { week: "W2", patients: 55 },
  { week: "W3", patients: 48 },
  { week: "W4", patients: 63 },
];

const COLORS = [
  "hsl(174, 62%, 38%)",
  "hsl(210, 80%, 55%)",
  "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(210, 15%, 50%)",
];

const Reports = () => {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports & Analytics</h1>
        <p className="page-subtitle">Clinic performance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Weekly Revenue" value="₹1,35,000" change="+18% vs last week" changeType="positive" icon={IndianRupee} iconColor="bg-success/10 text-success" />
        <StatCard title="Total Patients" value="208" change="+12 this week" changeType="positive" icon={Users} delay={0.05} />
        <StatCard title="Avg per Patient" value="₹6,490" change="+5% increase" changeType="positive" icon={TrendingUp} iconColor="bg-info/10 text-info" delay={0.1} />
        <StatCard title="Services Done" value="47" change="This week" icon={BarChart3} iconColor="bg-warning/10 text-warning" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="data-table p-5"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Weekly Revenue</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(210, 15%, 50%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(210, 15%, 50%)" />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid hsl(210, 20%, 90%)",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.06)",
                }}
                formatter={(value: number) => [`₹${value.toLocaleString()}`, "Revenue"]}
              />
              <Bar dataKey="revenue" fill="hsl(174, 62%, 38%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="data-table p-5"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Service Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={serviceDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
              >
                {serviceDistribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid hsl(210, 20%, 90%)",
                }}
                formatter={(value: number) => [`${value}%`, "Share"]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {serviceDistribution.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="data-table p-5"
      >
        <h3 className="font-display font-semibold text-lg mb-4">Patient Trend (Monthly)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={patientTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(210, 15%, 50%)" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(210, 15%, 50%)" />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid hsl(210, 20%, 90%)",
              }}
            />
            <Line
              type="monotone"
              dataKey="patients"
              stroke="hsl(174, 62%, 38%)"
              strokeWidth={2.5}
              dot={{ fill: "hsl(174, 62%, 38%)", r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};

export default Reports;
