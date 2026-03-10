import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import { ReportList } from "@/components/reports/ReportList";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import type { SavedReport } from "@/lib/reportObjects";

const ReportConfigurator = () => {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<SavedReport | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_reports")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Failed to load reports");
    } else {
      setReports(
        (data || []).map((r: any) => ({
          ...r,
          columns: r.columns || [],
          group_rows: r.group_rows || [],
          group_columns: r.group_columns || [],
          filters: r.filters || [],
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleNew = () => {
    setActiveReport(null);
    setIsBuilderOpen(true);
  };

  const handleEdit = (report: SavedReport) => {
    setActiveReport(report);
    setIsBuilderOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("saved_reports").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete report");
    } else {
      toast.success("Report deleted");
      fetchReports();
    }
  };

  const handleSave = async (report: SavedReport) => {
    const payload = {
      name: report.name,
      description: report.description || null,
      primary_object: report.primary_object,
      related_object: report.related_object || null,
      columns: report.columns as any,
      group_rows: report.group_rows as any,
      group_columns: report.group_columns as any,
      filters: report.filters as any,
      chart_type: report.chart_type,
    };

    if (report.id) {
      const { error } = await supabase
        .from("saved_reports")
        .update(payload)
        .eq("id", report.id);
      if (error) {
        toast.error("Failed to update report");
        return;
      }
      toast.success("Report updated");
    } else {
      const { error } = await supabase.from("saved_reports").insert(payload);
      if (error) {
        toast.error("Failed to save report");
        return;
      }
      toast.success("Report saved");
    }
    setIsBuilderOpen(false);
    fetchReports();
  };

  if (isBuilderOpen) {
    return (
      <ReportBuilder
        initial={activeReport}
        onSave={handleSave}
        onClose={() => setIsBuilderOpen(false)}
      />
    );
  }

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Report Configurator</h1>
          <p className="page-subtitle">Build, save and manage custom reports</p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" /> New Report
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
          <FileBarChart className="h-16 w-16 opacity-30" />
          <p>No reports yet. Create your first report.</p>
          <Button onClick={handleNew} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" /> Create Report
          </Button>
        </div>
      ) : (
        <ReportList reports={reports} onEdit={handleEdit} onDelete={handleDelete} onRun={handleEdit} />
      )}
    </div>
  );
};

export default ReportConfigurator;
