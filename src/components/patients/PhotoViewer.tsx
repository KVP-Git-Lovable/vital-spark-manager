import { useCallback, useEffect, useState } from "react";
import { displayDate } from "@/lib/dateInput";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, ImageOff } from "lucide-react";

export interface ViewablePhoto {
  id: string;
  photo_url: string;
  taken_at?: string | null;
  procedures?: { service_name?: string | null } | null;
}

interface PhotoViewerProps {
  photos: ViewablePhoto[];
  /** Index of the photo to show; null closes the viewer. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  patientName?: string;
}

/**
 * Full-size viewer for a patient's photos.
 *
 * The grid crops its thumbnails to a tidy square (object-cover), which is fine
 * for picking one out and wrong for looking at one: a lesion at the edge of the
 * frame is simply not in the thumbnail. Here the image is contained, never
 * cropped, and never enlarged past its natural size - an upscaled clinical
 * photo invents detail that was never captured.
 *
 * Opening one photo opens the set: staff compare a site across visits, so the
 * arrow keys and the on-screen chevrons step through the same list the grid
 * shows, in the same order.
 */
export function PhotoViewer({ photos, index, onIndexChange, patientName }: PhotoViewerProps) {
  const [failed, setFailed] = useState(false);
  const open = index !== null && index >= 0 && index < photos.length;
  const photo = open ? photos[index] : null;

  const step = useCallback(
    (delta: number) => {
      if (index === null || photos.length === 0) return;
      // Wraps, so the last photo's "next" is the first - with a handful of
      // photos that is friendlier than a dead-ended button.
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, photos.length, onIndexChange],
  );

  // A new photo deserves a fresh attempt at loading, even if the last one 404'd.
  useEffect(() => setFailed(false), [photo?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  if (!photo) return null;

  const takenAt = photo.taken_at ? new Date(photo.taken_at) : null;
  const caption = [
    photo.procedures?.service_name,
    takenAt && !Number.isNaN(takenAt.getTime()) ? displayDate(takenAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      {/* The dialog's own close button is dark-on-dark over a photo, so it gets a
          translucent chip here - it sits on the image, not on the card. */}
      <DialogContent
        className="max-w-5xl w-[calc(100%-1.5rem)] p-0 gap-0 overflow-hidden
                   [&>button]:right-3 [&>button]:top-3 [&>button]:rounded-full [&>button]:bg-black/50
                   [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-black/70"
      >
        {/* Radix needs an accessible title; the caption below carries it visually. */}
        <DialogTitle className="sr-only">
          {patientName ? `Photo of ${patientName}` : "Patient photo"}
          {caption ? ` — ${caption}` : ""}
        </DialogTitle>

        <div className="relative flex items-center justify-center bg-black/95 min-h-[50vh]">
          {failed ? (
            <div className="flex flex-col items-center gap-2 py-24 text-white/70">
              <ImageOff className="h-8 w-8" />
              <span className="text-sm">This photo could not be loaded.</span>
            </div>
          ) : (
            <img
              src={photo.photo_url}
              alt={caption || "Patient photo"}
              // Contained and never upscaled - see the note above.
              className="max-h-[80vh] max-w-full w-auto object-contain"
              onError={() => setFailed(true)}
            />
          )}

          {photos.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full opacity-80 hover:opacity-100"
                onClick={() => step(-1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full opacity-80 hover:opacity-100"
                onClick={() => step(1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{caption || "Photo"}</p>
            {photos.length > 1 && (
              <p className="text-xs text-muted-foreground">
                {(index ?? 0) + 1} of {photos.length}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
            {/* Opens in a new tab rather than forcing a download: the photos are
                served from another origin, where the download attribute is
                ignored, and a silently-ignored button is worse than a new tab. */}
            <a href={photo.photo_url} target="_blank" rel="noreferrer">
              <Download className="h-3.5 w-3.5" /> Open original
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PhotoViewer;
