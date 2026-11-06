import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Gauge, Send, Star, User } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useRcaCase, useRcaComments } from "@/hooks/useFeedbackRca";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { npsCategory, ratingLabel } from "@/lib/feedbackScores";
import {
  RCA_CLOSED_STATUSES,
  RCA_OPENED_REASONS,
  RCA_ROOT_CAUSES,
  RCA_STATUSES,
  rcaStatusClass,
  rcaStatusLabel,
  type RcaStatus,
} from "@/lib/feedbackRca";
import { toast } from "sonner";

/**
 * One root-cause case: what the patient scored, and what the clinic found.
 *
 * The discussion below is append-only - there is no update or delete grant on
 * feedback_rca_comments for any role, so what somebody wrote after phoning a
 * patient cannot later be tidied up. The author is stamped by a database
 * trigger rather than sent from here, so a comment cannot be posted under
 * someone else's name.
 */
export default function FeedbackRcaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: rca, isLoading, error } = useRcaCase(id);
  const { data: comments = [] } = useRcaComments(id);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: staff = [] } = useQuery({
    queryKey: ["rca-assignable-staff"],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff")
        .select("id, first_name, last_name")
        .not("is_active", "is", false)
        .order("first_name");
      return (data || []).map((s) => ({
        id: s.id,
        name: [s.first_name, s.last_name].filter(Boolean).join(" ") || "Staff member",
      }));
    },
  });

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["feedback-rca"] }),
      // The patient's own record shows the case status beside the feedback.
      qc.invalidateQueries({ queryKey: ["patient-feedback", "by-patient"] }),
    ]);

  const patch = async (changes: { status?: string; assigned_to?: string | null; root_cause?: string | null }) => {
    if (!rca) return;
    const { error: err } = await supabase.from("feedback_rca").update(changes).eq("id", rca.id);
    if (err) {
      toast.error(err.message);
      return;
    }
    await refresh();
  };

  const postComment = async () => {
    if (!rca || !comment.trim()) return;
    setPosting(true);
    try {
      // author_id and author_name are deliberately not sent: the
      // feedback_rca_comment_stamp trigger fills them from the signed-in
      // staff row, so they cannot be spoofed from here.
      const { error: err } = await supabase
        .from("feedback_rca_comments")
        .insert({ rca_id: rca.id, body: comment.trim() });
      if (err) throw err;
      setComment("");
      await qc.invalidateQueries({ queryKey: ["feedback-rca", "comments", rca.id] });
      toast.success("Comment saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPosting(false);
    }
  };

  if (isLoading) return <p className="p-6 text-center text-muted-foreground">Loading case…</p>;
  if (error || !rca) {
    return (
      <div className="p-6 py-16 text-center space-y-3">
        <p className="text-destructive">{(error as Error)?.message || "This case is no longer available."}</p>
        <Button variant="outline" onClick={() => navigate("/feedback-rca")}>
          Back to Root Cause Analysis
        </Button>
      </div>
    );
  }

  const closed = RCA_CLOSED_STATUSES.includes(rca.status as RcaStatus);
  const fb = rca.feedback;
  // The patient may have edited their score since the case opened.
  const drifted = fb && (fb.nps_score !== rca.nps_score_at_open || fb.service_rating !== rca.service_rating_at_open);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/feedback-rca")}>
        <ArrowLeft className="h-4 w-4" /> Back to Root Cause Analysis
      </Button>

      <div className="max-w-4xl space-y-5">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 mt-1 shrink-0 text-destructive" />
            {fb?.patient_name || "Unnamed patient"}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={rcaStatusClass[rca.status] ?? ""}>
              {rcaStatusLabel(rca.status)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Gauge className="h-3 w-3" /> {rca.nps_score_at_open}/10 {npsCategory(rca.nps_score_at_open)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Star className="h-3 w-3" /> {rca.service_rating_at_open}/5 {ratingLabel(rca.service_rating_at_open)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {RCA_OPENED_REASONS[rca.opened_reason] ?? "Flagged"} · opened{" "}
              {format(new Date(rca.created_at), "d MMM yyyy")}
            </span>
          </div>
          {rca.patient_id && (
            <Link to={`/patients/${rca.patient_id}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> Open patient record
            </Link>
          )}
        </header>

        <section className="rounded-lg border p-4 space-y-2">
          <h2 className="font-semibold text-sm">What the patient said</h2>
          {fb?.comments?.trim() ? (
            <p className="text-sm whitespace-pre-wrap break-words">“{fb.comments.trim()}”</p>
          ) : (
            // True for 21 of the first 24 cases. Worth saying plainly rather
            // than leaving a blank space that reads like a loading failure.
            <p className="text-sm text-muted-foreground">
              They left no comment — the score is all we have, which is why this case exists.
            </p>
          )}
          {drifted && fb && (
            <p className="text-xs text-warning">
              The patient has since changed their answer to {fb.nps_score}/10 and {fb.service_rating}/5
              {fb.last_edited_by === "patient" && fb.updated_at
                ? ` on ${format(new Date(fb.updated_at), "d MMM yyyy")}`
                : ""}
              . This case stays open until someone closes it.
            </p>
          )}
        </section>

        <section className="rounded-lg border p-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Status</Label>
            <SearchableSelect
              value={rca.status}
              onChange={(status) => patch({ status })}
              options={RCA_STATUSES.map((s) => ({ id: s.value, name: s.label }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Assigned to</Label>
            <SearchableSelect
              value={rca.assigned_to || ""}
              onChange={(assigned_to) => patch({ assigned_to: assigned_to || null })}
              options={[{ id: "", name: "Nobody yet" }, ...staff]}
              placeholder="Choose someone"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Root cause</Label>
            <SearchableSelect
              value={rca.root_cause || ""}
              onChange={(root_cause) => patch({ root_cause: root_cause || null })}
              options={[{ id: "", name: "Not established yet" }, ...RCA_ROOT_CAUSES.map((c) => ({ id: c.value, name: c.label }))]}
              placeholder="What went wrong"
            />
            {closed && !rca.root_cause && (
              <p className="text-xs text-warning">
                This case is closed with no cause recorded, so it will not appear in any count of why patients
                are unhappy.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-sm">
            Discussion {comments.length > 0 && <span className="text-muted-foreground">({comments.length})</span>}
          </h2>
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing recorded yet. After speaking to the patient, write down what they said.
            </p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="border-b pb-3">
              <div className="text-xs text-muted-foreground">
                {c.author_name} · {new Date(c.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words mt-1">{c.body}</p>
            </div>
          ))}
          <div className="space-y-2">
            <Textarea
              rows={3}
              value={comment}
              placeholder="What did the patient say when you called?"
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={posting || !comment.trim()} onClick={postComment}>
                <Send className="h-4 w-4 mr-2" />
                Add to discussion
              </Button>
              {/* Said out loud, because it is unusual and it changes how
                  people write. */}
              <span className="text-xs text-muted-foreground">
                Saved permanently — comments cannot be edited or deleted.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
