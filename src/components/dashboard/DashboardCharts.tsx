import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Completed: "hsl(152, 60%, 40%)",
  Scheduled: "hsl(210, 80%, 55%)",
  "In Progress": "hsl(38, 92%, 50%)",
  "No Show": "hsl(0, 72%, 51%)",
  Cancelled: "hsl(0, 60%, 60%)",
};

const BAR_COLORS = [
  "hsl(174, 62%, 38%)", "hsl(210, 80%, 55%)", "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)", "hsl(280, 60%, 55%)", "hsl(0, 72%, 51%)",
];

interface ChartData {
  appointmentStatus: { name: string; value: number }[];
  appointmentsByDr: { name: string; value: number }[];
  billingByDr: { name: string; value: number }[];
  revenueByDate: { date: string; revenue: number }[];
}

interface Props {
  data: ChartData;
  onChartClick: (type: string, payload?: any) => void;
}

export function DashboardCharts({ data, onChartClick }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Appointment Status Pie */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onChartClick("appointment_status")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Appointment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.appointmentStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.appointmentStatus}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={3} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {data.appointmentStatus.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "hsl(210, 15%, 50%)"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Appointments by Dr */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onChartClick("appointments_by_dr")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Appointments by Staff</CardTitle>
          </CardHeader>
          <CardContent>
            {data.appointmentsByDr.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.appointmentsByDr}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Appointments" radius={[4, 4, 0, 0]}>
                    {data.appointmentsByDr.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Billing by Dr */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onChartClick("billing_by_dr")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Billing by Staff (₹)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.billingByDr.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.billingByDr}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Revenue"]} />
                  <Bar dataKey="value" name="Revenue" radius={[4, 4, 0, 0]}>
                    {data.billingByDr.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Revenue by Date */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onChartClick("revenue_by_date")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue Trend (₹)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByDate.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.revenueByDate}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(174, 62%, 38%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
