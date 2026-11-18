import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SurveyQuestionImage from "@/components/portal/SurveyQuestionImage";
import { illustrationFor } from "@/lib/surveyIllustration";
import {
  QUESTIONS_PER_PAGE_MAX, QUESTIONS_PER_PAGE_MIN, maxChoicesCeiling, questionsPerPage,
} from "@/lib/surveyQuestionConfig";

/**
 * Everything the clinic says about a survey question.
 *
 * Before this, a question was its text, its type and its choices, and the
 * picture above it in the portal was chosen by keyword-matching that text
 * against 37 pictures bundled into the build. The clinic could not pick one,
 * and rewording a question changed its picture by accident.
 *
 * One component, rendered both on Admin > Patient Portal (where the clinic
 * asked for it) and in the Questions tab of the template dialog, so the two
 * cannot drift into disagreeing about what a question is.
 */

export const SURVEY_IMAGE_BUCKET = "survey-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface EditableQuestion {
  id?: string;
  question_text: string;
  question_type: string;
  options: string[];
  ideal_answer?: unknown;
  sort_order: number;
  image_url?: string | null;
  help_text?: string;
  is_required?: boolean;
  max_choices?: number | null;
  max_length?: number | null;
  is_active?: boolean;
}

const TYPES = [
  { value: "text", label: "Free text" },
  { value: "single_choice", label: "Choose one" },
  { value: "multi_choice", label: "Choose several" },
  { value: "scale", label: "A score out of ten" },
];

const isChoice = (t: string) => t === "single_choice" || t === "multi_choice";

export function SurveyQuestionsEditor({
  questions, onChange, perPage, onPerPageChange, disabled,
}: {
  questions: EditableQuestion[];
  onChange: (next: EditableQuestion[]) => void;
  perPage: number;
  onPerPageChange: (next: number) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const update = (i: number, patch: Partial<EditableQuestion>) =>
    onChange(questions.map((q, n) => (n === i ? { ...q, ...patch } : q)));

  const move = (i: number, by: number) => {
    const to = i + by;
    if (to < 0 || to >= questions.length) return;
    const next = [...questions];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next.map((q, n) => ({ ...q, sort_order: n })));
  };

  const add = () =>
    onChange([...questions, {
      question_text: "", question_type: "text", options: [], ideal_answer: {},
      sort_order: questions.length, image_url: null, help_text: "",
      is_required: true, max_choices: null, max_length: null, is_active: true,
    }]);

  /**
   * Removing a saved question would take its answers with it, so a question
   * that has ever been saved is retired instead. Only a draft nobody has
   * answered is actually dropped.
   */
  const remove = (i: number) => {
    const q = questions[i];
    if (q.id) {
      update(i, { is_active: false });
      toast.success("Retired. It is no longer asked, and past answers are kept.");
      return;
    }
    onChange(questions.filter((_, n) => n !== i).map((x, n) => ({ ...x, sort_order: n })));
  };

  const upload = async (i: number, file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("That is not an image."); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error("Images must be under 5 MB."); return; }
    setUploading(i);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(SURVEY_IMAGE_BUCKET).upload(path, file, {
        cacheControl: "3600", upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(SURVEY_IMAGE_BUCKET).getPublicUrl(path);
      update(i, { image_url: data.publicUrl });
      toast.success("Picture added. Save the template to keep it.");
    } catch (e) {
      toast.error((e as Error).message || "Upload failed.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border p-3">
        <div className="space-y-1">
          <Label className="text-sm">Questions on one page</Label>
          <p className="text-xs text-muted-foreground">
            How many a patient answers before tapping Next. One at a time is how it reads today.
          </p>
        </div>
        <Select
          value={String(questionsPerPage(perPage))}
          onValueChange={(v) => onPerPageChange(questionsPerPage(Number(v)))}
          disabled={disabled}
        >
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: QUESTIONS_PER_PAGE_MAX - QUESTIONS_PER_PAGE_MIN + 1 }, (_, n) => n + QUESTIONS_PER_PAGE_MIN)
              .map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No questions yet. Add the first one below.
        </p>
      )}

      {questions.map((q, i) => {
        const retired = q.is_active === false;
        const choice = isChoice(q.question_type);
        return (
          <div
            key={q.id ?? `draft-${i}`}
            className={`rounded-lg border p-4 space-y-3 ${retired ? "opacity-60 bg-muted/30" : "bg-muted/20"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Q{i + 1}{retired && " — retired, not asked"}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up"
                        disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down"
                        disabled={disabled || i === questions.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                {retired ? (
                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                          disabled={disabled} onClick={() => update(i, { is_active: true })}>
                    Ask again
                  </Button>
                ) : (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          aria-label="Retire question" disabled={disabled} onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <Input
              value={q.question_text}
              placeholder="What are you asking?"
              disabled={disabled}
              onChange={(e) => update(i, { question_text: e.target.value })}
            />

            <Textarea
              value={q.help_text ?? ""}
              placeholder="Help text under the question (optional)"
              rows={2}
              disabled={disabled}
              onChange={(e) => update(i, { help_text: e.target.value })}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Select value={q.question_type} disabled={disabled}
                      onValueChange={(v) => update(i, { question_type: v, max_choices: null })}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Switch id={`req-${i}`} checked={q.is_required ?? true} disabled={disabled}
                        onCheckedChange={(v) => update(i, { is_required: v })} />
                <Label htmlFor={`req-${i}`} className="text-sm">Must be answered</Label>
              </div>

              {q.question_type === "multi_choice" && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">At most</Label>
                  <Input
                    type="number" className="w-20" min={1} max={maxChoicesCeiling({ id: q.id ?? "draft", question_type: q.question_type, options: q.options })}
                    value={q.max_choices ?? ""} placeholder="any" disabled={disabled}
                    onChange={(e) => update(i, {
                      max_choices: e.target.value === "" ? null : Number(e.target.value),
                    })}
                  />
                </div>
              )}

              {q.question_type === "text" && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Characters</Label>
                  <Input
                    type="number" className="w-24" min={1} max={5000}
                    value={q.max_length ?? ""} placeholder="any" disabled={disabled}
                    onChange={(e) => update(i, {
                      max_length: e.target.value === "" ? null : Number(e.target.value),
                    })}
                  />
                </div>
              )}
            </div>

            {choice && (
              <Input
                value={q.options.join(", ")}
                placeholder="The choices, separated by commas"
                disabled={disabled}
                onChange={(e) => update(i, {
                  options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                })}
              />
            )}

            {/* The picture. Without one the portal shows the illustration it
                has always shown, so this says which, rather than leaving the
                clinic to guess what a patient sees. */}
            <div className="flex items-start gap-3 border-t pt-3">
              <div className="w-32 shrink-0">
                {q.image_url ? (
                  <img src={q.image_url} alt="" className="h-20 w-32 rounded-lg object-cover" />
                ) : (
                  <SurveyQuestionImage
                    name={illustrationFor(q.question_text, q.question_type)}
                    className="h-20"
                  />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {q.image_url
                    ? "Your picture."
                    : "No picture chosen, so the portal shows this one, picked from the question's wording."}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { fileInputs.current[i] = el; }}
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void upload(i, file);
                    }}
                  />
                  <Button size="sm" variant="outline" disabled={disabled || uploading === i}
                          onClick={() => fileInputs.current[i]?.click()}>
                    {uploading === i
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Uploading…</>
                      : <><ImagePlus className="h-3.5 w-3.5 mr-1" /> {q.image_url ? "Replace" : "Upload"}</>}
                  </Button>
                  {q.image_url && (
                    <Button size="sm" variant="ghost" disabled={disabled}
                            onClick={() => update(i, { image_url: null })}>
                      <X className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <Button variant="outline" className="w-full" disabled={disabled} onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Add a question
      </Button>
    </div>
  );
}
