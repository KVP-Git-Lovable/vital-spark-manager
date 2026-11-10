import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FOLLOWUP_KINDS,
  followupContactNotice,
  followupMessage,
  followupShareState,
  isFollowupMessage,
  type FollowupKind,
} from "@/lib/followupSend";
import type { NamedPatient } from "@/lib/patientName";

/**
 * The two post-treatment follow-up buttons.
 *
 * Each opens WhatsApp Web with this patient's number and the clinic's wording
 * already typed; a staff member presses send. They used to send themselves
 * through send-followup-whatsapp, until the clinic deleted the two approved
 * Meta templates on 10 Nov 2026 - src/lib/followupSend.ts has the full story.
 *
 * ── Three rules in here that are not negotiable ──
 *
 * They are lifted wholesale from the Google review button, which arrived at
 * them the hard way, and breaking any one of them puts the blocked-page back
 * in front of the front desk:
 *
 *  1. web.whatsapp.com, never wa.me. wa.me redirects through
 *     api.whatsapp.com, which refuses to be framed and shows
 *     "api.whatsapp.com is blocked / ERR_BLOCKED_BY_RESPONSE". That decision
 *     lives in whatsappShareUrl and must not be re-made here.
 *  2. window.open with a real URL and NO "noopener" in the features string.
 *     The spec makes window.open return null whenever noopener is set, even
 *     on success, so the blocked-popup fallback would fire on every good
 *     click. The opener is disowned by hand instead.
 *  3. NEVER a confirm(), alert() or prompt() between the click and
 *     window.open. The new tab takes focus, and Chrome silently ignores a
 *     dialog asked for by a background tab - it returns false and nothing
 *     happens. Anything to ask is asked BEFORE, by the AlertDialog below.
 */
export function FollowupButtons({
  patientId,
  appointmentId,
  patientPhone,
  patient,
}: {
  patientId: string | undefined;
  appointmentId: string | undefined;
  patientPhone: string;
  patient: NamedPatient | null | undefined;
}) {
  const [confirming, setConfirming] = useState<FollowupKind | null>(null);

  /** Follow-ups that really went out through the old template sender. */
  const { data: sentRows = [] } = useQuery({
    queryKey: ["followups-sent", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("content, created_at")
        .eq("patient_id", patientId!)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(40);
      return data || [];
    },
  });

  /**
   * Follow-ups a staff member opened WhatsApp for.
   *
   * `as never`: the table arrives with this change's migration and the
   * generated Supabase types are only regenerated on sync, so until then the
   * table is real and the types do not know it. Same shape as the
   * google_review_opens query a few hundred lines up.
   */
  const { data: openRows = [], refetch: refetchOpens } = useQuery({
    queryKey: ["followups-opened", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("followup_opens" as never)
        .select("kind, opened_at")
        .eq("patient_id", patientId!)
        .order("opened_at", { ascending: false })
        .limit(40);
      return (data as unknown as { kind: string; opened_at: string }[]) || [];
    },
  });

  const lastSent = (kind: FollowupKind) =>
    sentRows.find((m) => isFollowupMessage(kind, m.content))?.created_at ?? null;
  const lastOpened = (kind: FollowupKind) =>
    openRows.find((r) => r.kind === kind)?.opened_at ?? null;
  const noticeFor = (kind: FollowupKind) => followupContactNotice(lastSent(kind), lastOpened(kind));

  /**
   * Record that WhatsApp was opened for this follow-up.
   *
   * Deliberately NOT awaited, and the click never waits on it: the tab is
   * already open by the time this runs, and an await anywhere in that path
   * would spend the click's permission to open a tab at all. Best-effort, so
   * a failed insert costs the notice next time and nothing else.
   */
  const recordOpen = (kind: FollowupKind) => {
    if (!patientId) return;
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        await supabase.from("followup_opens" as never).insert({
          patient_id: patientId,
          appointment_id: appointmentId ?? null,
          kind,
          opened_by: auth?.user?.id ?? null,
        } as never);
        void refetchOpens();
      } catch {
        // Silent on purpose: WhatsApp is already open in the other tab and a
        // toast about bookkeeping would land on a screen nobody is reading.
      }
    })();
  };

  const openNow = (kind: FollowupKind) => {
    const state = followupShareState(patientPhone, patient, kind);
    if (!state.enabled || !state.url) return;
    const win = window.open(state.url, "_blank");
    if (!win) {
      const message = followupMessage(kind, patient);
      toast.message("Your browser blocked the WhatsApp tab", {
        description: "Copy the message, then paste it into the patient's WhatsApp chat.",
        action: {
          label: "Copy message",
          onClick: () => {
            navigator.clipboard.writeText(message).then(
              () => toast.success("Message copied"),
              () => toast.error("Could not copy - your browser blocked the clipboard."),
            );
          },
        },
        duration: 20000,
      });
      return;
    }
    win.opener = null;
    recordOpen(kind);
  };

  /**
   * Sending a second time is worth a question; a first send is not. The
   * dialog's own button is a fresh user gesture, so opening from there works
   * exactly as a first press does.
   */
  const press = (kind: FollowupKind) => {
    if (noticeFor(kind)) {
      setConfirming(kind);
      return;
    }
    openNow(kind);
  };

  if (!patientId) return null;

  const blocked = followupShareState(patientPhone, patient, "24h");

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-2">
        {FOLLOWUP_KINDS.map(({ kind, short }) => {
          const notice = noticeFor(kind);
          return (
            <Button
              key={kind}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              data-testid={`send-followup-${kind}`}
              disabled={!blocked.enabled}
              onClick={() => press(kind)}
              title={blocked.enabled ? `Open WhatsApp with the ${short} ready` : blocked.reason}
            >
              <MessageCircle className="h-3 w-3" />
              {notice ? `Send ${short} again` : short}
            </Button>
          );
        })}
      </div>

      {!blocked.enabled && <p className="text-[11px] text-muted-foreground">{blocked.reason}</p>}

      {blocked.enabled &&
        FOLLOWUP_KINDS.map(({ kind, short }) => {
          const notice = noticeFor(kind);
          if (!notice) return null;
          return (
            <p key={kind} className="text-[11px] text-muted-foreground" data-testid={`followup-sent-${kind}`}>
              {short}: {notice}
            </p>
          );
        })}

      {/* Asked before anything opens - see rule 3 above for why that order is
          not negotiable. */}
      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this follow-up again?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming ? noticeFor(confirming) : ""}. Sending again is fine if the first one did
              not reach them — but a patient who gets the same message twice usually just received
              it late.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-followup-again"
              onClick={() => {
                const kind = confirming;
                setConfirming(null);
                if (kind) openNow(kind);
              }}
            >
              Open WhatsApp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
