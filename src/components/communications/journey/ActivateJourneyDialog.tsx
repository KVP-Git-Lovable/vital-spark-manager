import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { parseCanvas } from "@/lib/comms/journeyGraph";
import { audienceSummary, invokeJourneyActions, type Journey } from "@/lib/comms/journeys";
import { summarizeSchedule } from "@/lib/comms/schedule";
import { JOURNEY_SCHEDULER_ENABLED, JOURNEY_SCHEDULER_OFF_NOTICE } from "@/lib/comms/journeyScheduler";

type Preview = { total: number; without_phone: number };

export function ActivateJourneyDialog({
  journey,
  onOpenChange,
}: {
  journey: Journey | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (!journey) return;
    invokeJourneyActions<Preview>({ action: "audience-preview", audience_config: journey.audience_config })
      .then(setPreview)
      .catch((e: Error) => setPreviewError(e.message));
  }, [journey]);

  const activate = useMutation({
    mutationFn: () => invokeJourneyActions<{ enrolled?: number }>({ action: "activate", journey_id: journey!.id }),
    onSuccess: (r) => {
      toast.success(r.enrolled !== undefined ? `Journey activated — ${r.enrolled} patients enrolled` : "Journey activated");
      qc.invalidateQueries({ queryKey: ["comms-journeys"] });
      qc.invalidateQueries({ queryKey: ["comms-journey", journey?.id] });
      qc.invalidateQueries({ queryKey: ["comms-journey-stats"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const messages = journey ? parseCanvas(journey.canvas_data).nodes.filter((n) => n.type === "message") : [];
  const marketing = messages.some((m) => m.data.template_category === "MARKETING");

  return (
    <AlertDialog open={!!journey} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Activate "{journey?.name}"?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                {JOURNEY_SCHEDULER_ENABLED
                  ? "Activating enrolls the audience and starts sending real WhatsApp messages"
                  : "Activating enrolls the audience"}
                {journey?.schedule ? ` according to the schedule (${summarizeSchedule(journey.schedule)}).` : " right away."}
              </p>
              <p>Audience: {audienceSummary(journey?.audience_config ?? null)}</p>
              <p className="font-medium text-foreground">
                {previewError ? previewError : preview ? `${preview.total} patient${preview.total === 1 ? "" : "s"} will be enrolled` : "Counting audience…"}
              </p>
              <p>{messages.length} WhatsApp template step{messages.length === 1 ? "" : "s"}.</p>
              {!JOURNEY_SCHEDULER_ENABLED && (
                <p className="flex gap-2 rounded-md bg-warning/10 p-2 text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {JOURNEY_SCHEDULER_OFF_NOTICE}
                </p>
              )}
              {marketing && (
                <p className="flex gap-2 rounded-md bg-warning/10 p-2 text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  This journey uses MARKETING templates. There is no opt-out list yet, so every patient in the audience will receive them.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={!preview || activate.isPending} onClick={() => activate.mutate()}>
            {activate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Activate
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
