import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ClipboardCheck, ChevronDown, Filter, X } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "pending_review", label: "⏳ Pending Review", variant: "outline" as const },
  { value: "reviewed", label: "👁 Reviewed", variant: "secondary" as const },
  { value: "approved", label: "✅ Approved", variant: "default" as const },
];

function getStatusDisplay(status: string | null) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

export default function AllSurveys() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedResponse, setSelectedResponse] = useState<any>(null);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["all-survey-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*, survey_templates(name, questions), patients(id, first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Get unique template names for filter
  const templateNames = [...new Set(responses.map((r: any) => r.survey_templates?.name).filter(Boolean))].sort();

  // Filter logic
  const filtered = responses.filter((r: any) => {
    const q = search.toLowerCase();
    const patientName = r.patients ? `${r.patients.first_name} ${r.patients.last_name}`.toLowerCase() : "";
    const templateName = r.survey_templates?.name?.toLowerCase() || "";
    if (q && !patientName.includes(q) && !templateName.includes(q)) return false;

    if (statusFilter !== "all" && (r.dr_status || "pending_review") !== statusFilter) return false;

    if (templateFilter !== "all" && r.survey_templates?.name !== templateFilter) return false;

    if (dateFilter !== "all") {
      const created = new Date(r.created_at);
      const now = new Date();
      if (dateFilter === "today" && created < startOfDay(now)) return false;
      if (dateFilter === "7days" && created < startOfDay(subDays(now, 7))) return false;
      if (dateFilter === "30days" && created < startOfDay(subDays(now, 30))) return false;
    }

    return true;
  });

  const handleStatusChange = async (response: any, newStatus: string) => {
    const { error } = await supabase.from("survey_responses").update({ dr_status: newStatus }).eq("id", response.id);
    if (error) { toast.error(error.message); return; }

    // Auto-create prescriptions when approved
    if (newStatus === "approved") {
      const aiRec = response.ai_recommendation as any;
      const aiProducts = (aiRec?.products || []) as any[];
      if (aiProducts.length > 0) {
        const rxEntries = aiProducts.map((p: any) => ({
          procedure_id: null,
          survey_response_id: response.id,
          medicine_name: p.product_name || p.name || "Unknown",
          dosage: p.dosage || null,
          frequency: p.frequency || null,
          duration: p.duration || null,
          quantity: p.quantity || 1,
          instructions: p.advice || p.instructions || null,
          product_id: p.product_id || null,
        }));
        const { error: rxError } = await supabase.from("prescriptions").insert(rxEntries);
        if (rxError) {
          toast.error("Approved but failed to create Rx: " + rxError.message);
        } else {
          toast.success(`Approved — ${rxEntries.length} medicine(s) added to Rx`);
        }
      } else {
        toast.success("Status set to Approved");
      }
      // Invalidate patient prescriptions
      if (response.patients?.id) {
        queryClient.invalidateQueries({ queryKey: ["patient-prescriptions", response.patients.id] });
      }
    } else {
      toast.success(`Status set to ${getStatusDisplay(newStatus).label}`);
    }

    // Bidirectional sync: invalidate both global and patient-specific queries
    queryClient.invalidateQueries({ queryKey: ["all-survey-responses"] });
    if (response.patients?.id) {
      queryClient.invalidateQueries({ queryKey: ["patient-surveys", response.patients.id] });
    }
  };

  const hasActiveFilters = statusFilter !== "all" || templateFilter !== "all" || dateFilter !== "all" || search;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTemplateFilter("all");
    setDateFilter("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Surveys</h1>
          <p className="text-muted-foreground">Survey responses across all patients</p>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-xs">
            <X className="h-3.5 w-3.5" /> Clear Filters
          </Button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center p-3 rounded-lg border bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="relative flex-1 min-w-[180px] max-w-[250px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search patient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Time</SelectItem>
            <SelectItem value="today" className="text-xs">Today</SelectItem>
            <SelectItem value="7days" className="text-xs">Last 7 Days</SelectItem>
            <SelectItem value="30days" className="text-xs">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className="h-8 text-xs w-[180px]">
            <SelectValue placeholder="Template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Templates</SelectItem>
            {templateNames.map(t => (
              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Patient Name</TableHead>
              <TableHead>Survey Template</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No survey responses found</TableCell>
              </TableRow>
            ) : (
              filtered.map((r: any) => {
                const status = getStatusDisplay(r.dr_status);
                return (
                  <TableRow key={r.id}>
                    <TableCell
                      className="cursor-pointer"
                      onClick={() => setSelectedResponse(r)}
                    >
                      {format(new Date(r.created_at), "dd MMM yyyy, hh:mm a")}
                    </TableCell>
                    <TableCell>
                      {r.patients ? (
                        <Link
                          to={`/patients/${r.patients.id}`}
                          className="text-primary hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.patients.first_name} {r.patients.last_name}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer"
                      onClick={() => setSelectedResponse(r)}
                    >
                      {r.survey_templates?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant={status.variant}
                            size="sm"
                            className="h-7 text-xs gap-1"
                          >
                            {status.label}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {STATUS_OPTIONS.map(opt => (
                            <DropdownMenuItem
                              key={opt.value}
                              className="text-xs"
                              onClick={() => handleStatusChange(r, opt.value)}
                            >
                              {opt.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Survey Response
            </DialogTitle>
          </DialogHeader>
          {selectedResponse && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Patient</p>
                    <p className="font-medium">
                      {selectedResponse.patients
                        ? `${selectedResponse.patients.first_name} ${selectedResponse.patients.last_name}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Template</p>
                    <p className="font-medium">{selectedResponse.survey_templates?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {format(new Date(selectedResponse.created_at), "dd MMM yyyy, hh:mm a")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={getStatusDisplay(selectedResponse.dr_status).variant}>
                      {getStatusDisplay(selectedResponse.dr_status).label}
                    </Badge>
                  </div>
                </div>

                {selectedResponse.dr_notes && (
                  <div>
                    <p className="text-muted-foreground text-sm">Doctor Notes</p>
                    <p className="text-sm mt-1">{selectedResponse.dr_notes}</p>
                  </div>
                )}

                <div>
                  <p className="font-medium mb-2">Answers</p>
                  <div className="space-y-3">
                    {(() => {
                      const questions = selectedResponse.survey_templates?.questions as any[] || [];
                      const answers = selectedResponse.answers as Record<string, any> || {};
                      return Object.entries(answers).map(([qId, answer], idx) => {
                        const q = questions.find((qq: any) => qq.id === qId);
                        return (
                          <div key={qId} className="bg-muted/50 rounded-lg p-3">
                            <p className="text-sm font-medium">
                              {q?.question_text || `Question ${idx + 1}`}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {typeof answer === "object" ? JSON.stringify(answer) : String(answer)}
                            </p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {selectedResponse.ai_recommendation && (
                  <div>
                    <p className="font-medium mb-1">AI Recommendation</p>
                    <p className="text-sm text-muted-foreground">
                      {typeof selectedResponse.ai_recommendation === "object"
                        ? JSON.stringify(selectedResponse.ai_recommendation, null, 2)
                        : String(selectedResponse.ai_recommendation)}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
