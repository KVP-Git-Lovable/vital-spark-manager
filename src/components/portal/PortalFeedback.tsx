import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, MessageSquareHeart, Pencil, Star } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { portalRequest } from "@/lib/portalApi";
import { npsCategory, ratingLabel } from "@/lib/feedbackScores";

/**
 * A patient's own feedback, and a way to put it right.
 *
 * Feedback is recorded by the clinic while the patient is in front of them,
 * and until now the patient never saw it again and could not change it. When
 * somebody tapped the wrong number - which has happened - the only remedy was
 * a database migration that deleted the row, because the table allows one
 * piece of feedback per visit and there is no Trash behind it.
 *
 * So this screen reads and edits; it never creates. The clinic still records
 * feedback at the visit.
 *
 * Nothing here is destructive: an edit is a new version, and the answers it
 * replaces are kept in patient_feedback_revisions by a database trigger. The
 * scores and the wording are the same helpers the clinic's own screen uses, so
 * a patient and a doctor read the same words for the same number.
 */

interface PortalFeedbackRow {
  id: string;
  appointment_id: string | null;
  nps_score: number | null;
  service_rating: number | null;
  comments: string | null;
  created_at: string;
  updated_at: string | null;
  last_edited_by: string | null;
  appointment: {
    id: string;
    start_time: string | null;
    service: string | null;
    doctor_name: string | null;
    reason_for_consultation: string | null;
  } | null;
}

const NPS_SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The same three bands, and the same colours, as the clinic's Feedback tab. */
function npsColor(score: number): string {
  if (score <= 6) return "bg-destructive text-destructive-foreground";
  if (score <= 8) return "bg-yellow-500 text-white";
  return "bg-green-600 text-white";
}

function visitLabel(row: PortalFeedbackRow): string {
  const when = row.appointment?.start_time;
  const service = row.appointment?.service || row.appointment?.reason_for_consultation;
  const date = when ? format(new Date(when), "d MMM yyyy") : null;
  if (date && service) return `${service} · ${date}`;
  if (date) return `Visit on ${date}`;
  if (service) return service;
  return "Your visit";
}

export default function PortalFeedback({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PortalFeedbackRow | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comments, setComments] = useState("");

  const { data: feedback = [], isLoading, isError, refetch } = useQuery<PortalFeedbackRow[]>({
    queryKey: ["portal-feedback", patientId],
    queryFn: async () => (await portalRequest<PortalFeedbackRow[]>("feedback")) || [],
    enabled: !!patientId,
    retry: 1,
    throwOnError: false,
  });

  useEffect(() => {
    if (!editing) return;
    setNps(editing.nps_score);
    setRating(editing.service_rating);
    setComments(editing.comments || "");
  }, [editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await portalRequest("update_feedback", {
        id: editing.id,
        npsScore: nps,
        serviceRating: rating,
        comments: comments.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-feedback", patientId] });
      setEditing(null);
      toast.success("Your feedback has been updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-card rounded-xl border p-6 text-sm text-muted-foreground text-center space-y-3">
        <p>We couldn't load your feedback right now.</p>
        <button type="button" className="text-primary font-medium underline" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-bold text-lg mb-1">Your Feedback</h2>
        <p className="text-xs text-muted-foreground mb-3">
          What you told us about your visits. If anything is not what you meant, you can change it.
        </p>

        {feedback.length === 0 ? (
          <div className="bg-card rounded-xl border p-6 text-sm text-muted-foreground text-center">
            <MessageSquareHeart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            You have not given us any feedback yet.
          </div>
        ) : (
          <div className="space-y-2">
            {feedback.map((row) => (
              <div key={row.id} className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{visitLabel(row)}</p>
                    {row.appointment?.doctor_name && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {row.appointment.doctor_name}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    onClick={() => setEditing(row)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {row.nps_score !== null && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold ${npsColor(row.nps_score)}`}
                      >
                        {row.nps_score}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {npsCategory(row.nps_score)}
                      </Badge>
                    </div>
                  )}
                  {row.service_rating !== null && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-4 w-4 ${
                            s <= (row.service_rating ?? 0)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">
                        {ratingLabel(row.service_rating)}
                      </span>
                    </div>
                  )}
                </div>

                {row.comments && (
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {row.comments}
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground">
                  {row.updated_at
                    ? `Updated ${format(new Date(row.updated_at), "d MMM yyyy")}`
                    : `Given ${format(new Date(row.created_at), "d MMM yyyy")}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Change your feedback</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <p className="text-xs text-muted-foreground">{visitLabel(editing)}</p>

              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  How likely are you to recommend us to a friend or colleague?
                </Label>
                <div className="flex gap-1 flex-wrap">
                  {NPS_SCORES.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNps(i)}
                      className={`h-8 w-8 rounded-md text-xs font-semibold border transition-all ${
                        nps === i
                          ? npsColor(i)
                          : "bg-background hover:bg-accent text-foreground border-border"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                  <span>Not at all likely</span>
                  <span>Extremely likely</span>
                </div>
                {nps !== null && (
                  <Badge variant="outline" className="text-xs">
                    {npsCategory(nps)}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  How would you rate the overall quality of service?
                </Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 transition-transform hover:scale-110"
                      aria-label={`${s} star${s === 1 ? "" : "s"}`}
                    >
                      <Star
                        className={`h-7 w-7 ${
                          rating !== null && s <= rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/30 hover:text-yellow-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating !== null && (
                  <p className="text-xs text-muted-foreground">{ratingLabel(rating)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Any comments or suggestions?</Label>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Tell us in your own words…"
                  rows={3}
                  maxLength={2000}
                  className="text-sm"
                />
              </div>

              <p className="text-[10px] text-muted-foreground">
                Your clinic keeps a record of what you said before, so nothing is lost.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditing(null)}
                  disabled={save.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => save.mutate()}
                  disabled={save.isPending || nps === null || rating === null}
                >
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
