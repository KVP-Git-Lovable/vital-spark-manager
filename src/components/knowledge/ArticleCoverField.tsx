import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { KNOWLEDGE_BUCKET } from "@/lib/knowledge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadKnowledgeFile } from "@/components/knowledge/ArticleResources";

/**
 * The picture on the article's card.
 *
 * Optional by design: an article with a picture attachment already uses the
 * first of those, and one with neither gets a plain banner. This is for
 * choosing deliberately.
 *
 * It goes into the same private bucket as every other knowledge attachment -
 * knowledge imagery is clinical - so the field holds a path and signs it to
 * show the preview.
 */
export function ArticleCoverField({
  value, onChange, group, onBusyChange,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  group: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: preview } = useQuery({
    queryKey: ["knowledge-cover", value],
    enabled: !!value,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!value) return null;
      const { data, error } = await supabase.storage.from(KNOWLEDGE_BUCKET).createSignedUrl(value, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose a picture file"); return; }
    setUploading(true);
    onBusyChange?.(true);
    try {
      const resource = await uploadKnowledgeFile(file, group);
      if (!resource.path) throw new Error("The picture did not upload");
      onChange(resource.path);
      toast.success("Cover picture set");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The picture could not be uploaded");
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Cover picture</Label>
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
          {preview ? (
            <img src={preview} alt="Cover preview" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Cover picture"
              onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              {value ? "Replace" : "Upload"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange(null)}>
                <X className="h-3.5 w-3.5 mr-1.5" />Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Shown on the article card. Left empty, the card uses the article's first picture attachment.
          </p>
        </div>
      </div>
    </div>
  );
}
