import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AllSurveys() {
  const [search, setSearch] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<any>(null);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["all-survey-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*, survey_templates(name, questions), patients(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = responses.filter((r: any) => {
    const q = search.toLowerCase();
    const patientName = r.patients
      ? `${r.patients.first_name} ${r.patients.last_name}`.toLowerCase()
      : "";
    const templateName = r.survey_templates?.name?.toLowerCase() || "";
    return patientName.includes(q) || templateName.includes(q);
  });

  const statusColor = (status: string | null) => {
    if (status === "approved") return "default";
    if (status === "rejected") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Surveys</h1>
          <p className="text-muted-foreground">Survey responses across all patients</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by patient or template…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviewed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No survey responses found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r: any) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedResponse(r)}
                >
                  <TableCell>
                    {format(new Date(r.created_at), "dd MMM yyyy, hh:mm a")}
                  </TableCell>
                  <TableCell>
                    {r.patients
                      ? `${r.patients.first_name} ${r.patients.last_name}`
                      : "—"}
                  </TableCell>
                  <TableCell>{r.survey_templates?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(r.dr_status)}>
                      {r.dr_status || "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.reviewed_at ? format(new Date(r.reviewed_at), "dd MMM yyyy") : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
                    <Badge variant={statusColor(selectedResponse.dr_status)}>
                      {selectedResponse.dr_status || "Pending"}
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
