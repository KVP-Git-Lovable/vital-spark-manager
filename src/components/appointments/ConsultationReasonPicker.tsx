import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export const AESTHETIC_REASONS = [
  "Acne", "Pigmentation", "Anti Aging", "Undereye Dark Circles", "Lip Darkening",
  "Sagging of Face", "Neck Rejuvenation", "Hair Loss", "Dandruff", "Hair Growth",
  "Routine Skin Checkup / Glow", "Uneven Skin Tone", "Bridal", "Others",
];

export const CLINICAL_REASONS = [
  "Itching", "Fungal Infection", "Rashes", "White Patch", "Swelling", "Dry Skin", "Others",
];

export const CONSULTATION_TYPES = ["None", "Aesthetic", "Clinical", "Aesthetic & Clinical"] as const;
export type ConsultationType = typeof CONSULTATION_TYPES[number];

const OTHER_AESTHETIC = "Others (Aesthetic)";
const OTHER_CLINICAL = "Others (Clinical)";

function buildTag(group: "aesthetic" | "clinical", reason: string) {
  if (reason === "Others") {
    return group === "aesthetic" ? OTHER_AESTHETIC : OTHER_CLINICAL;
  }
  return reason;
}

interface Props {
  consultationType: ConsultationType | "";
  setConsultationType?: (v: ConsultationType) => void;
  onConsultationTypeChange?: (v: ConsultationType) => void;
  reasons?: string[];
  consultationReasons?: string[];
  setReasons?: (r: string[]) => void;
  onConsultationReasonsChange?: (r: string[]) => void;
  othersAestheticText: string;
  setOthersAestheticText: (v: string) => void;
  othersClinicalText: string;
  setOthersClinicalText: (v: string) => void;
}

export function ConsultationReasonPicker({
  consultationType,
  setConsultationType,
  onConsultationTypeChange,
  reasons: reasonsProp,
  consultationReasons,
  setReasons: setReasonsProp,
  onConsultationReasonsChange,
  othersAestheticText,
  setOthersAestheticText,
  othersClinicalText,
  setOthersClinicalText,
}: Props) {
  const reasons = reasonsProp ?? consultationReasons ?? [];
  const setReasons = setReasonsProp ?? onConsultationReasonsChange ?? (() => {});
  const setType = setConsultationType ?? onConsultationTypeChange ?? (() => {});

  const toggle = (group: "aesthetic" | "clinical", reason: string) => {
    const tag = buildTag(group, reason);
    if (reasons.includes(tag)) {
      setReasons(reasons.filter((r) => r !== tag));
    } else {
      setReasons([...reasons, tag]);
    }
  };

  const showAesthetic = consultationType === "Aesthetic" || consultationType === "Aesthetic & Clinical";
  const showClinical = consultationType === "Clinical" || consultationType === "Aesthetic & Clinical";

  const renderGroup = (
    title: string,
    group: "aesthetic" | "clinical",
    options: string[],
    othersValue: string,
    setOthers: (v: string) => void,
  ) => {
    const otherTag = group === "aesthetic" ? OTHER_AESTHETIC : OTHER_CLINICAL;
    const othersSelected = reasons.includes(otherTag);
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const tag = buildTag(group, opt);
            const active = reasons.includes(tag);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(group, opt)}
                className={cn(
                  "px-2.5 py-1 rounded-full border text-xs transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-input",
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {othersSelected && (
          <Input
            value={othersValue}
            onChange={(e) => setOthers(e.target.value)}
            placeholder={`Specify ${title.toLowerCase()} concern...`}
            className="mt-1.5"
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Reason for Consultation</Label>
        <Select value={consultationType || "None"} onValueChange={(v) => setType(v as ConsultationType)}>
          <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {CONSULTATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {showAesthetic && renderGroup("Aesthetic", "aesthetic", AESTHETIC_REASONS, othersAestheticText, setOthersAestheticText)}
      {showClinical && renderGroup("Clinical", "clinical", CLINICAL_REASONS, othersClinicalText, setOthersClinicalText)}

      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {reasons.map((r) => (
            <Badge key={r} variant="secondary" className="gap-1 pr-1">
              {r}
              <button
                type="button"
                onClick={() => setReasons(reasons.filter((x) => x !== r))}
                className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                aria-label={`Remove ${r}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function buildConsultationReasonsForSave(
  reasons: string[],
  othersAestheticText: string,
  othersClinicalText: string,
): string[] {
  return reasons.map((r) => {
    if (r === OTHER_AESTHETIC) return othersAestheticText.trim() ? `Others (Aesthetic): ${othersAestheticText.trim()}` : OTHER_AESTHETIC;
    if (r === OTHER_CLINICAL) return othersClinicalText.trim() ? `Others (Clinical): ${othersClinicalText.trim()}` : OTHER_CLINICAL;
    return r;
  });
}