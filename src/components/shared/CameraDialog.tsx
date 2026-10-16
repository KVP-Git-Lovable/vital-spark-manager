import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cameraConstraints, frameAspectRatio } from "@/lib/cameraStream";
import { useIsMobile } from "@/hooks/use-mobile";

interface CameraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  /**
   * Keep shooting without leaving the camera.
   *
   * On a phone each upload takes a few seconds, and the camera closed after
   * every shot - so photographing four areas meant opening it, shooting,
   * waiting and starting again, four times, with the patient sitting there.
   * With this on, a shot joins a strip along the bottom, the view comes
   * straight back, and Done hands the whole set over at once.
   *
   * Off by default: the other three screens that use this camera - patient
   * attachments, the prescription scanner, the patient page - want exactly one
   * picture, and nothing about them changes.
   */
  multiple?: boolean;
  /** Called instead of onCapture when `multiple` is on. */
  onCaptureMany?: (files: File[]) => void;
  title?: string;
}

/** How much of the screen the live view may take, leaving the shutter on it. */
const FRAME_MAX_HEIGHT = "68vh";

export function CameraDialog({ open, onOpenChange, onCapture, multiple = false, onCaptureMany, title = "Take Photo" }: CameraDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileFallbackRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  /** The shots taken so far in this session, when `multiple` is on. */
  const [shots, setShots] = useState<{ file: File; url: string }[]>([]);
  /**
   * The shape of the live picture, once the camera has reported it.
   *
   * Null until then, and again whenever the camera is switched, so the front
   * camera is measured rather than being shown in the back camera's shape.
   */
  const [frameRatio, setFrameRatio] = useState<number | null>(null);
  /**
   * A phone gets the camera full-screen with the controls over the picture.
   *
   * Not decoration. A phone camera sends a 9:16 picture, and a dialog that
   * stacks a title, the frame and a button row leaves the frame about 280 of
   * a 370px-wide screen once its height is capped - the clinic reported that,
   * correctly, as still narrow. There is no arrangement of a stacked layout
   * that fits an upright picture across the width of an upright screen. Over
   * the whole screen, with the controls floating on top of it the way every
   * camera app does it, there is: the picture is as wide as the phone.
   */
  const isMobile = useIsMobile();

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startStream = async (mode: "environment" | "user") => {
    setError(null);
    setStarting(true);
    stopStream();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser");
      }
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(mode));
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in your browser."
          : err?.message || "Could not access camera";
      setError(msg);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (open && !capturedFile) {
      startStream(facingMode);
    }
    if (!open) {
      stopStream();
      setCapturedFile(null);
      setPreviewUrl(null);
      setError(null);
      setShots((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.url));
        return [];
      });
      setFrameRatio(null);
    }
    return () => {
      if (!open) stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode]);

  useEffect(() => () => stopStream(), []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      toast.error("Camera not ready yet");
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        if (multiple) {
          // The stream is deliberately left running: stopping and restarting
          // it between shots is the couple of seconds that made this slow.
          setShots((prev) => [...prev, { file, url: URL.createObjectURL(blob) }]);
          return;
        }
        setCapturedFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        stopStream();
      },
      "image/jpeg",
      0.9
    );
  };

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedFile(null);
    setPreviewUrl(null);
    startStream(facingMode);
  };

  const handleUse = () => {
    if (capturedFile) {
      onCapture(capturedFile);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setCapturedFile(null);
      setPreviewUrl(null);
      onOpenChange(false);
    }
  };

  const handleSwitchCamera = () => {
    // The two cameras need not have the same shape, so the frame is measured
    // again rather than keeping the one it already has.
    setFrameRatio(null);
    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
  };

  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      if (multiple) {
        // Joins the strip and the camera stays open, so a phone whose live
        // camera will not start can still build a set - take one, take
        // another, then Done. It used to hand back a single photo and close,
        // which is why "capture multiple photos" was nowhere to be seen on a
        // phone while it worked on the desktop.
        setShots((prev) => [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
      } else {
        onCapture(files[0]);
        onOpenChange(false);
      }
    }
    e.target.value = "";
  };

  const removeShot = (index: number) =>
    setShots((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });

  const handleDone = () => {
    if (!shots.length) return;
    onCaptureMany?.(shots.map((s) => s.file));
    // The urls are revoked by the close effect, after the files have gone.
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isMobile
            ? "w-screen max-w-none h-[100dvh] max-h-[100dvh] gap-0 p-0 sm:p-0 rounded-none border-0 overflow-hidden bg-black text-white [&>button]:z-20 [&>button]:text-white"
            : "max-w-3xl p-0 overflow-hidden"
        }
      >
        {/* `contents` on a desktop: the wrapper disappears from the layout and
            the dialog is exactly what it was. On a phone it becomes the
            full-screen column everything else is positioned against. */}
        <div className={isMobile ? "absolute inset-0 flex flex-col bg-black" : "contents"}>
        <DialogHeader
          className={
            isMobile
              ? "absolute inset-x-0 top-0 z-10 px-4 pt-4 pb-10 bg-gradient-to-b from-black/70 to-transparent"
              : "px-4 pt-4"
          }
        >
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        {/* The frame takes the shape of the camera, rather than imposing one.
            A fixed shape is wrong on one device or the other: a 4:3 box cut
            the sides off a desktop webcam - reported as not being able to
            take a wide photo - and a 16:9 box left a phone held upright as a
            narrow strip between two black bars. The picture itself was never
            cropped either way (the capture draws videoWidth x videoHeight);
            only the view of it was.

            maxWidth is what removes the bars: capping the height alone would
            leave the box wider than the picture and letterbox it again. Until
            the camera reports its size, the classes guess by device - upright
            on a phone, wide on a desktop. */}
        <div
          data-testid="camera-frame"
          className={
            isMobile
              ? "relative flex-1 min-h-0 w-full bg-black flex items-center justify-center"
              : `relative bg-black mx-auto w-full flex items-center justify-center ${frameRatio ? "" : "aspect-video"}`
          }
          style={
            isMobile
              ? undefined
              : {
                  aspectRatio: frameRatio ?? undefined,
                  maxHeight: FRAME_MAX_HEIGHT,
                  maxWidth: frameRatio ? `calc(${FRAME_MAX_HEIGHT} * ${frameRatio})` : undefined,
                }
          }
        >
          {error ? (
            <div className="text-center p-6 text-white space-y-3">
              <Camera className="h-10 w-10 mx-auto opacity-60" />
              <p className="text-sm">{error}</p>
              {multiple && (
                <p className="text-xs opacity-80">
                  You can still take them one at a time from the phone&apos;s own camera — they will be
                  collected here and sent together.
                </p>
              )}
              <input
                ref={fileFallbackRef}
                type="file"
                accept="image/*"
                multiple={multiple}
                className="hidden"
                onChange={handleFallbackFile}
              />
              <Button variant="secondary" size="sm" onClick={() => fileFallbackRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1.5" /> Choose from device
              </Button>
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Captured" className="w-full h-full object-contain" />
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                muted
                onLoadedMetadata={(e) =>
                  setFrameRatio(frameAspectRatio(e.currentTarget.videoWidth, e.currentTarget.videoHeight))
                }
              />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                  Starting camera…
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* What has been taken so far, so the doctor can see the set growing
            and drop a bad shot before any of it is sent. */}
        <div className={isMobile ? "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/60 to-transparent" : "contents"}>
        {multiple && shots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
            {shots.map((shot, i) => (
              <div key={shot.url} className="relative shrink-0">
                <img src={shot.url} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-md object-cover border" />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-background border p-0.5 shadow-sm"
                  onClick={() => removeShot(i)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={`flex items-center justify-between gap-2 p-4 ${isMobile ? "" : "bg-card"}`}>
          {multiple ? (
            /* Three cells rather than one row: on a 320px phone the old row -
               Cancel, switch, a 56px shutter and "Done (n)" - was wider than
               the dialog, and justify-between pushed Done off the edge, which
               is the one control the whole thing hangs on. The shutter stays
               centred and the two ends shrink. */
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Button variant="ghost" size="sm" className="justify-self-start px-2" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Cancel</span>
              </Button>
              <div className="flex items-center gap-2">
                {!error && (
                  <Button variant="outline" size="icon" onClick={handleSwitchCamera} title="Switch camera">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="lg"
                  onClick={handleCapture}
                  disabled={!!error || starting}
                  className="rounded-full h-14 w-14 p-0 shrink-0"
                  title="Take photo"
                  aria-label="Take photo"
                >
                  <Camera className="h-6 w-6" />
                </Button>
              </div>
              {/* Always here, counting, so it is clear more than one can be
                  taken before anything is sent. */}
              <Button size="sm" className="justify-self-end px-2.5" onClick={handleDone} disabled={shots.length === 0}>
                <Check className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Done</span>
                <span className="ml-1">({shots.length})</span>
              </Button>
            </div>
          ) : previewUrl ? (
            <>
              <Button variant="outline" size="sm" onClick={handleRetake}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Retake
              </Button>
              <Button size="sm" onClick={handleUse}>
                <Check className="h-4 w-4 mr-1.5" /> Use Photo
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-1.5" /> Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSwitchCamera}
                  disabled={!!error}
                  title="Switch camera"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="lg" onClick={handleCapture} disabled={!!error || starting} className="rounded-full h-14 w-14 p-0">
                  <Camera className="h-6 w-6" />
                </Button>
              </div>
            </>
          )}
        </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
