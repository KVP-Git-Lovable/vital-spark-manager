import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getObjectByKey, type ReportFilter } from "@/lib/reportObjects";
import { Badge } from "@/components/ui/badge";
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

const COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 80%, 55%)",
  "hsl(152, 60%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 60%, 50%)",
  "hsl(340, 70%, 50%)",
  "hsl(200, 60%, 45%)",
];

interface Props {
  primaryObject: string;
  relatedObject: string;
  columns: string[];
  groupRows: string[];
  groupColumns: string[];
  filters: ReportFilter[];
  chartType: string;
  compact?: boolean;
}

const RECORD_ROUTES: Record<string, string> = {
  patients: "/patients",
  appointments: "/appointments",
  procedures: "/procedures",
  invoices: "/billing",
  services: "/services",
  assets: "/assets",
  pharma_products: "/pharma",
  staff: "/settings",
  vendors: "/assets",
};

export function ReportPreview({
  primaryObject,
  relatedObject,
  columns,
  groupRows,
  groupColumns,
  filters,
  chartType,
  compact,
}: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [primaryObject, relatedObject, columns, groupRows, groupColumns, filters]);

  const fetchData = async () => {
    setLoading(true);
    const primaryObj = getObjectByKey(primaryObject);
    if (!primaryObj) { setLoading(false); return; }

    const allFieldKeys = [...new Set([...columns, ...groupRows, ...groupColumns])];

    // Determine which fields we need from primary
    const primaryFieldKeys = allFieldKeys
      .filter((fk) => fk.startsWith(`${primaryObject}.`))
      .map((fk) => fk.split(".")[1]);
    if (!primaryFieldKeys.includes("id")) primaryFieldKeys.push("id");

    // If no fields selected at all, select all primary fields
    if (allFieldKeys.length === 0) {
      primaryObj.fields.forEach((f) => {
        if (!primaryFieldKeys.includes(f.key)) primaryFieldKeys.push(f.key);
      });
    }

    // Determine related object fields
    const relatedObj = relatedObject ? getObjectByKey(relatedObject) : null;
    const relatedFieldKeys = relatedObj
      ? allFieldKeys
          .filter((fk) => fk.startsWith(`${relatedObject}.`))
          .map((fk) => fk.split(".")[1])
      : [];

    // Build select string - use Supabase nested select for joins
    let selectStr = primaryFieldKeys.join(",");

    // Find the foreign key relationship
    let foreignKey = "";
    if (relatedObj && relatedObject) {
      const relation = primaryObj.relations?.find((r) => r.objectKey === relatedObject);
      if (relation) {
        foreignKey = relation.foreignKey;
        // Primary table has the FK pointing to related table
        // Use Supabase nested select: related_table(field1, field2)
        const relFields = relatedFieldKeys.length > 0 ? relatedFieldKeys : relatedObj.fields.map((f) => f.key);
        selectStr += `,${relatedObj.table}(${relFields.join(",")})`;
        // Ensure the FK column is selected
        if (!primaryFieldKeys.includes(foreignKey)) {
          selectStr = `${foreignKey},${selectStr}`;
        }
      } else {
        // Check reverse: related object might have FK to primary
        const reverseRelation = relatedObj.relations?.find((r) => r.objectKey === primaryObject);
        if (reverseRelation) {
          // Related table has FK to primary - still use nested select
          const relFields = relatedFieldKeys.length > 0 ? relatedFieldKeys : relatedObj.fields.map((f) => f.key);
          selectStr += `,${relatedObj.table}(${relFields.join(",")})`;
        }
      }
    }

    let query = supabase.from(primaryObj.table as any).select(selectStr);

    // Apply primary object filters
    filters
      .filter((f) => f.field.startsWith(`${primaryObject}.`))
      .forEach((f) => {
        const col = f.field.split(".")[1];
        switch (f.operator) {
          case "equals": query = query.eq(col, f.value); break;
          case "not_equals": query = query.neq(col, f.value); break;
          case "contains": query = query.ilike(col, `%${f.value}%`); break;
          case "gt": query = query.gt(col, f.value); break;
          case "lt": query = query.lt(col, f.value); break;
          case "gte": query = query.gte(col, f.value); break;
          case "lte": query = query.lte(col, f.value); break;
          case "is_null": query = query.is(col, null); break;
          case "is_not_null": query = query.not(col, "is", null); break;
        }
      });

    query = query.limit(500);
    const { data: result, error } = await query;

    if (error) {
      console.error("Report query error:", error);
      setData([]);
      setLoading(false);
      return;
    }

    if (!result) {
      setData([]);
      setLoading(false);
      return;
    }

    // Flatten nested related object data
    const flattenedData = (result as any[]).map((row) => {
      const flat: any = {};
      // Copy primary fields
      for (const key of Object.keys(row)) {
        if (relatedObj && key === relatedObj.table) {
          // Nested related object - flatten with prefix
          const nested = row[key];
          if (nested && typeof nested === "object" && !Array.isArray(nested)) {
            for (const nk of Object.keys(nested)) {
              flat[`__related__.${nk}`] = nested[nk];
            }
          } else if (Array.isArray(nested) && nested.length > 0) {
            // One-to-many: take first match for now
            for (const nk of Object.keys(nested[0])) {
              flat[`__related__.${nk}`] = nested[0][nk];
            }
          }
        } else {
          flat[key] = row[key];
        }
      }
      return flat;
    });

    // Apply related object filters client-side
    const relatedFilters = filters.filter((f) => relatedObject && f.field.startsWith(`${relatedObject}.`));
    let filteredData = flattenedData;
    if (relatedFilters.length > 0) {
      filteredData = flattenedData.filter((row) => {
        return relatedFilters.every((f) => {
          const col = f.field.split(".")[1];
          const val = row[`__related__.${col}`];
          const strVal = String(val ?? "");
          switch (f.operator) {
            case "equals": return strVal === f.value;
            case "not_equals": return strVal !== f.value;
            case "contains": return strVal.toLowerCase().includes(f.value.toLowerCase());
            case "gt": return Number(val) > Number(f.value);
            case "lt": return Number(val) < Number(f.value);
            case "gte": return Number(val) >= Number(f.value);
            case "lte": return Number(val) <= Number(f.value);
            case "is_null": return val === null || val === undefined;
            case "is_not_null": return val !== null && val !== undefined;
            default: return true;
          }
        });
      });
    }

    setData(filteredData);
    setLoading(false);
  };

  // Resolve a column key like "patients.first_name" to the actual data key in our flattened row
  const resolveDataKey = (fk: string): string => {
    const [objKey, fieldKey] = fk.split(".");
    if (objKey === primaryObject) return fieldKey;
    if (objKey === relatedObject) return `__related__.${fieldKey}`;
    return fieldKey;
  };

  const getFieldLabel = (fk: string) => {
    const [objKey, fieldKey] = fk.split(".");
    const obj = getObjectByKey(objKey);
    const field = obj?.fields.find((f) => f.key === fieldKey);
    if (!field) return fieldKey;
    // If we have a related object, prefix with object label for clarity
    if (relatedObject && obj) return `${obj.label} · ${field.label}`;
    return field.label;
  };

  const handleRecordClick = (record: any) => {
    const route = RECORD_ROUTES[primaryObject];
    if (route && record.id) {
      const detailPath = primaryObject === "patients" ? `${route}/${record.id}` : route;
      window.open(detailPath, "_blank");
    }
  };

  const formatVal = (val: any) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (typeof val === "number") return val.toLocaleString("en-IN");
    if (String(val).match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      } catch { return String(val); }
    }
    return String(val);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading report data...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No records found. Try adjusting your filters or selecting different fields.
      </div>
    );
  }

  // Use ALL columns (both primary and related)
  const allDisplayCols = columns.length > 0 ? columns : [];
  const groupRowFields = groupRows;
  const groupColFields = groupColumns;

  const groupField = groupRowFields.length > 0 ? resolveDataKey(groupRowFields[0]) : null;
  const groupField2 = groupRowFields.length > 1 ? resolveDataKey(groupRowFields[1]) : null;
  const groupColField = groupColFields.length > 0 ? resolveDataKey(groupColFields[0]) : null;

  const numericCols = [...columns, ...groupColumns].filter((c) => {
    const obj = getObjectByKey(c.split(".")[0]);
    return obj?.fields.find((f) => f.key === c.split(".")[1])?.type === "number";
  });

  const buildChartData = () => {
    if (!groupField) return [];
    const grouped: Record<string, any> = {};
    data.forEach((row) => {
      const key = String(row[groupField] || "N/A");
      if (!grouped[key]) grouped[key] = { name: key, count: 0 };
      grouped[key].count += 1;
      numericCols.forEach((nc) => {
        const dataKey = resolveDataKey(nc);
        grouped[key][dataKey] = (grouped[key][dataKey] || 0) + (Number(row[dataKey]) || 0);
      });
    });
    return Object.values(grouped);
  };

  // Number summary
  if (chartType === "number") {
    const total = data.length;
    const sums = numericCols.map((nc) => {
      const dataKey = resolveDataKey(nc);
      const sum = data.reduce((s, r) => s + (Number(r[dataKey]) || 0), 0);
      return { label: getFieldLabel(nc), sum };
    });
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="data-table p-4 text-center">
          <div className="text-3xl font-display font-bold text-primary">{total}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Records</div>
        </div>
        {sums.map((s) => (
          <div key={s.label} className="data-table p-4 text-center">
            <div className="text-3xl font-display font-bold text-foreground">{s.sum.toLocaleString("en-IN")}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    );
  }

  // Charts
  if (chartType !== "table" && groupField) {
    const chartData = buildChartData();
    const valueKey = numericCols.length > 0 ? resolveDataKey(numericCols[0]) : "count";
    const height = compact ? 200 : 350;

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey={valueKey} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "doughnut") {
      return (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={compact ? 40 : 60}
                outerRadius={compact ? 70 : 100}
                paddingAngle={3}
                dataKey={valueKey}
                nameKey="name"
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {chartData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey={valueKey} stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
  }

  // TABLE VIEW
  const displayCols = allDisplayCols.length > 0 ? allDisplayCols : groupRowFields;

  // If still no columns to display, show all primary object fields
  const finalDisplayCols = displayCols.length > 0
    ? displayCols
    : (getObjectByKey(primaryObject)?.fields.slice(0, 6).map((f) => `${primaryObject}.${f.key}`) || []);

  // Matrix report: group rows + group columns
  if (groupField && groupColField && chartType === "table") {
    const colValues = [...new Set(data.map((r) => String(r[groupColField] || "N/A")))].sort();
    const groupLabel = getFieldLabel(groupRowFields[0]);

    // Build nested groups for multi-level
    const grouped: Record<string, Record<string, any[]>> = {};
    data.forEach((row) => {
      const g1 = String(row[groupField] || "N/A");
      const g2 = groupField2 ? String(row[groupField2] || "N/A") : "__all__";
      if (!grouped[g1]) grouped[g1] = {};
      if (!grouped[g1][g2]) grouped[g1][g2] = [];
      grouped[g1][g2].push(row);
    });

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-border rounded overflow-hidden">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">{groupLabel}</th>
              {groupField2 && (
                <th className="text-left py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">
                  {getFieldLabel(groupRowFields[1])}
                </th>
              )}
              {colValues.map((cv) => (
                <th key={cv} className="text-center py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">{cv}</th>
              ))}
              <th className="text-center py-1.5 px-3 text-[11px] font-semibold text-primary">Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([g1Key, subGroups]) => {
              if (!groupField2) {
                const allRows = Object.values(subGroups).flat();
                return (
                  <tr key={g1Key} className="border-b border-border/50 hover:bg-accent/20">
                    <td className="py-1.5 px-3 text-xs font-medium">{g1Key}</td>
                    {colValues.map((cv) => {
                      const count = allRows.filter((r) => String(r[groupColField] || "N/A") === cv).length;
                      return <td key={cv} className="py-1.5 px-3 text-xs text-center">{count || "—"}</td>;
                    })}
                    <td className="py-1.5 px-3 text-xs text-center font-semibold text-primary">{allRows.length}</td>
                  </tr>
                );
              }
              // Multi-level
              const subEntries = Object.entries(subGroups);
              return subEntries.map(([g2Key, rows], si) => (
                <tr key={`${g1Key}-${g2Key}`} className="border-b border-border/50 hover:bg-accent/20">
                  {si === 0 ? (
                    <td rowSpan={subEntries.length} className="py-1.5 px-3 text-xs font-semibold bg-muted/20 border-r border-border/50 align-top">
                      {g1Key}
                    </td>
                  ) : null}
                  <td className="py-1.5 px-3 text-xs">{g2Key}</td>
                  {colValues.map((cv) => {
                    const count = rows.filter((r) => String(r[groupColField] || "N/A") === cv).length;
                    return <td key={cv} className="py-1.5 px-3 text-xs text-center">{count || "—"}</td>;
                  })}
                  <td className="py-1.5 px-3 text-xs text-center font-semibold text-primary">{rows.length}</td>
                </tr>
              ));
            })}
            <tr className="bg-muted/30 font-semibold">
              <td className="py-1.5 px-3 text-xs" colSpan={groupField2 ? 2 : 1}>Total</td>
              {colValues.map((cv) => {
                const count = data.filter((r) => String(r[groupColField] || "N/A") === cv).length;
                return <td key={cv} className="py-1.5 px-3 text-xs text-center">{count}</td>;
              })}
              <td className="py-1.5 px-3 text-xs text-center text-primary">{data.length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Excel-style grouped rows (no group columns)
  if (groupField && chartType === "table") {
    const groupLabel = getFieldLabel(groupRowFields[0]);

    type GroupNode = { rows: any[]; subGroups?: Record<string, GroupNode> };
    const buildGroups = (): Record<string, GroupNode> => {
      const result: Record<string, GroupNode> = {};
      data.forEach((row) => {
        const g1 = String(row[groupField] || "N/A");
        if (!result[g1]) result[g1] = { rows: [], subGroups: groupField2 ? {} : undefined };
        if (groupField2 && result[g1].subGroups) {
          const g2 = String(row[groupField2] || "N/A");
          if (!result[g1].subGroups![g2]) result[g1].subGroups![g2] = { rows: [] };
          result[g1].subGroups![g2].rows.push(row);
        }
        result[g1].rows.push(row);
      });
      return result;
    };

    const grouped = buildGroups();
    let groupCounter = 0;

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-border rounded overflow-hidden">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-1.5 px-3 text-[11px] font-semibold text-muted-foreground w-10">#</th>
              <th className="text-left py-1.5 px-3 text-[11px] font-semibold text-muted-foreground">{groupLabel}</th>
              {finalDisplayCols.map((c) => (
                <th key={c} className="text-left py-1.5 px-3 text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                  {getFieldLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([g1Key, node]) => {
              groupCounter++;
              const currentGroupNum = groupCounter;

              if (groupField2 && node.subGroups) {
                let subCounter = 0;
                const subEntries = Object.entries(node.subGroups);
                return (
                  <React.Fragment key={`g1-${g1Key}`}>
                    <tr className="bg-primary/5 border-b border-border">
                      <td className="py-1.5 px-3 text-xs font-bold text-primary">G{currentGroupNum}</td>
                      <td colSpan={finalDisplayCols.length + 1} className="py-1.5 px-3 text-xs font-semibold text-foreground">
                        {g1Key}
                        <span className="text-[9px] ml-2 text-muted-foreground">({node.rows.length})</span>
                      </td>
                    </tr>
                    {subEntries.map(([g2Key, subNode]) => {
                      subCounter++;
                      return (
                        <React.Fragment key={`g2-${g1Key}-${g2Key}`}>
                          <tr className="bg-muted/20 border-b border-border/50">
                            <td className="py-1 px-3 pl-6 text-[10px] text-muted-foreground font-medium">
                              {currentGroupNum}.{subCounter}
                            </td>
                            <td colSpan={finalDisplayCols.length + 1} className="py-1 px-3 text-[11px] font-medium text-foreground">
                              {g2Key}
                              <span className="text-[9px] ml-2 text-muted-foreground">({subNode.rows.length})</span>
                            </td>
                          </tr>
                          {subNode.rows.slice(0, compact ? 3 : 50).map((row, ri) => (
                            <tr
                              key={`row-${g1Key}-${g2Key}-${ri}`}
                              className="border-b border-border/30 hover:bg-accent/20 cursor-pointer transition-colors"
                              onClick={() => handleRecordClick(row)}
                            >
                              <td className="py-1 px-3 text-[10px] text-muted-foreground pl-10"></td>
                              <td className="py-1 px-3 text-xs text-muted-foreground"></td>
                              {finalDisplayCols.map((c) => (
                                <td key={c} className="py-1 px-3 whitespace-nowrap text-xs text-foreground">
                                  {formatVal(row[resolveDataKey(c)])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              }

              // Single-level group
              return (
                <React.Fragment key={`g1-${g1Key}`}>
                  <tr className="bg-primary/5 border-b border-border">
                    <td className="py-1.5 px-3 text-xs font-bold text-primary">G{currentGroupNum}</td>
                    <td colSpan={finalDisplayCols.length + 1} className="py-1.5 px-3 text-xs font-semibold text-foreground">
                      {g1Key}
                      <span className="text-[9px] ml-2 text-muted-foreground">({node.rows.length})</span>
                    </td>
                  </tr>
                  {node.rows.slice(0, compact ? 5 : 50).map((row, ri) => (
                    <tr
                      key={`row-${g1Key}-${ri}`}
                      className="border-b border-border/30 hover:bg-accent/20 cursor-pointer transition-colors"
                      onClick={() => handleRecordClick(row)}
                    >
                      <td className="py-1 px-3 text-[10px] text-muted-foreground"></td>
                      <td className="py-1 px-3 text-xs text-muted-foreground"></td>
                      {finalDisplayCols.map((c) => (
                        <td key={c} className="py-1 px-3 whitespace-nowrap text-xs text-foreground">
                          {formatVal(row[resolveDataKey(c)])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {node.rows.length > (compact ? 5 : 50) && (
                    <tr>
                      <td colSpan={finalDisplayCols.length + 2} className="text-xs text-muted-foreground text-center py-1">
                        +{node.rows.length - (compact ? 5 : 50)} more
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            <tr className="bg-muted/30 font-semibold">
              <td className="py-1.5 px-3 text-xs" colSpan={2}>Total</td>
              {finalDisplayCols.map((c) => (
                <td key={c} className="py-1.5 px-3 text-xs text-muted-foreground"></td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="text-xs text-muted-foreground text-center mt-2">
          {Object.keys(grouped).length} groups · {data.length} total records
        </div>
      </div>
    );
  }

  // Flat table (no grouping)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {finalDisplayCols.map((c) => (
              <th key={c} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                {getFieldLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, compact ? 10 : 100).map((row, i) => (
            <tr
              key={row.id || i}
              className="border-b border-border/50 hover:bg-accent/20 cursor-pointer transition-colors"
              onClick={() => handleRecordClick(row)}
            >
              {finalDisplayCols.map((c) => (
                <td key={c} className="py-2 px-3 whitespace-nowrap text-foreground">
                  {formatVal(row[resolveDataKey(c)])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > (compact ? 10 : 100) && (
        <p className="text-xs text-muted-foreground py-2 text-center">
          Showing {compact ? 10 : 100} of {data.length} records
        </p>
      )}
    </div>
  );
}
