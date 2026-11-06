import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { FOLLOWUP_KINDS, followupSendState, isFollowupMessage, type FollowupKind } from "@/lib/followupSend";
import type { NamedPatient } from "@/lib/patientName";

/**
 * The two post-treatment follow-up buttons.
 *
 * Both send an approved WhatsApp template through send-followup-whatsapp. The
 * clinic chose no time gate: either can be pressed whenever, so the receptionist
 * decides rather than the software.
 *
 * ── Why the "already sent" line reads whatsapp_conversations ──
 *
 * Not whatsapp_delivery_log, which the delivery webhook fills in afterwards
 * and would still be empty for a second press made forty seconds later. That
 * exact gap once sent a patient the same message twice, and the note above the
 * Google review button records it.
 */
export function FollowupButtons({
  patientId,
  appointmentId,
  patientName,
  patientPhone,
  patient,
}: {
  patientId: string | undefined;
  appointmentId: string | undefined;
  patientName: string;
  patientPhone: string;
  patient: NamedPatient | null | undefined;
}) {
  const [sending, setSending] = useState<FollowupKind | null>(null);
  const state = followupSendState(patientPhone, patient);

  // One query for both buttons; each picks its own messages out of it.
  const { data: sentRows = [], refetch } = useQuery({
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

  const lastSent = (kind: FollowupKind) =>
    sentRows.find((m) => isFollowupMessage(kind, m.content))?.created_at ?? null;

  const send = async (kind: FollowupKind, label: string) => {
    if (!patientId) return;
    if (!window.confirm(`Send the ${label} to ${patientName} on ${patientPhone}?`)) return;
    setSending(kind);
    try {
      const { error } = await supabase.functions.invoke("send-followup-whatsapp", {
        body: { patient_id: patientId, appointment_id: appointmentId ?? null, kind },
      });
      if (error) throw new Error(await edgeFunctionErrorMessage(error, `The ${label} could not be sent.`));
      toast.success(`${label} sent`);
      await refetch();
    } catch (e) {
      toast.error((e as Error)?.message || `The ${label} could not be sent.`);
    } finally {
      setSending(null);
    }
  };

  if (!patientId) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-2">
        {FOLLOWUP_KINDS.map(({ kind, label, short }) => {
          const when = lastSent(kind);
          return (
            <Button
              key={kind}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              data-testid={`send-followup-${kind}`}
              disabled={!state.enabled || sending !== null}
              onClick={() => send(kind, label)}
              title={state.enabled ? `Send the ${label} on WhatsApp` : state.reason}
            >
              <MessageCircle className="h-3 w-3" />
              {sending === kind ? "Sending…" : when ? `Resend ${short}` : short}
            </Button>
          );
        })}
      </div>

      {!state.enabled && <p className="text-[11px] text-muted-foreground">{state.reason}</p>}

      {state.enabled &&
        FOLLOWUP_KINDS.map(({ kind, short }) => {
          const when = lastSent(kind);
          if (!when) return null;
          return (
            <p key={kind} className="text-[11px] text-muted-foreground" data-testid={`followup-sent-${kind}`}>
              {short} sent {formatDistanceToNowStrict(new Date(when))} ago
            </p>
          );
        })}
    </div>
  );
}
