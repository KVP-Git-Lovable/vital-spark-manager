import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

interface ChartDatum {
  label: string;
  value: number;
}

interface Props {
  title: string;
  data: ChartDatum[];
  valueLabel?: string;
  orientation?: "vertical" | "horizontal";
}

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, var(--primary)))",
  "hsl(var(--chart-3, var(--primary)))",
  "hsl(var(--chart-4, var(--primary)))",
  "hsl(var(--chart-5, var(--primary)))",
];

export function ReportChart({ title, data, valueLabel = "Value", orientation = "vertical" }: Props) {
  return (
    <div className="data-table p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{valueLabel}</span>
      </div>
      {data.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
          No data to chart for current filters.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          {orientation === "horizontal" ? (
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="value" name={valueLabel} radius={[0, 4, 4, 0]}>
                {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: data.length > 6 ? 56 : 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval={0}
                angle={data.length > 6 ? -35 : 0}
                textAnchor={data.length > 6 ? "end" : "middle"}
                height={data.length > 6 ? 60 : 30}
              />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="value" name={valueLabel} radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}