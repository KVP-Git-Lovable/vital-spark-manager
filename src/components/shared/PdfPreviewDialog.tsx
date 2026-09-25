import { useRef } from "react";
import { Loader2, Download, FileText, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * A PDF shown in the page, because opening one in a tab does not survive
 * contact with the clinic's browsers.
 *
 * What was measured there, across the prescription and the invoice: opening
 * a tab works, writing a placeholder document into it works - staff could
 * read "Preparing the invoice..." - and then navigating that tab to the
 * finished PDF never completes. A blob: address came back with
 * ERR_BLOCKED_BY_CLIENT, which is an extension refusing it; an https one
 * simply hung on the placeholder. Navigation is the step that fails, so
 * nothing here navigates.
 *
 * Open in new tab remains as a button. A click on it is the user's own
 * gesture on a plain link, which is the one form of this that is never
 * interfered with - and it is a choice, not something to sit and wait on.
 */
export interface PdfPreviewDialogProps {
  /**
   * The document's pages, already drawn (see renderPdf.ts). Preferred over
   * `url`, because showing these asks the browser to load nothing.
   */
  pages?: string[] | null;
  open: boolean;
  onClose: () => void;
  title: string;
  /** Message shown while the document is being built. */
  preparing: string;
  /** An https address for the finished PDF. */
  url?: string | null;
  /** A document we built ourselves, shown when there is no PDF to point at. */
  html?: string | null;
  error?: string | null;
  onRetry?: () => void;
  onDownload?: () => void;
  downloading?: boolean;
}

export function PdfPreviewDialog({
  open, onClose, title, preparing, pages, url, html, error, onRetry, onDownload, downloading,
}: PdfPreviewDialogProps) {
  const printFrame = useRef<HTMLIFrameElement | null>(null);

  const printPages = () => {
    // The drawn pages are printed from a frame carrying them as its own
    // document, via srcdoc. No window is opened and nothing is navigated to,
    // which are the two things that get blocked.
    const frame = printFrame.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  const print = () => {
    const frame = document.getElementById("pdf-preview-frame") as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  // One image per sheet, sized to fit inside the sheet. A full-width image
  // could be a hair taller than the printable area (paper size, rounding),
  // spilling onto an extra blank sheet; and a break after the last page added
  // another. Each page is boxed to the sheet height and only breaks between.
  const printableDoc = (pages ?? [])
    .map(
      (src, i, all) =>
        `<div class="pg"${i < all.length - 1 ? ' style="break-after:page;page-break-after:always"' : ""}><img src="${src}" /></div>`,
    )
    .join("");

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div
          className="bg-muted/40 rounded-lg overflow-hidden flex items-center justify-center"
          style={{ minHeight: 400 }}
        >
          {error ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              {onRetry && (
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          ) : pages && pages.length > 0 ? (
            <div className="w-full h-[70vh] overflow-auto bg-muted/40 p-3 space-y-3">
              {pages.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`${title} — page ${i + 1}`}
                  className="w-full shadow-sm bg-white"
                />
              ))}
              <iframe
                ref={printFrame}
                title="print"
                aria-hidden="true"
                tabIndex={-1}
                className="hidden"
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}html,body{margin:0;padding:0}.pg{height:99vh;overflow:hidden;display:flex;align-items:flex-start;justify-content:center;break-inside:avoid;page-break-inside:avoid}.pg img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}</style></head><body>${printableDoc}</body></html>`}
              />
            </div>
          ) : html ? (
            // srcdoc, not a written-to window: the document travels with the
            // frame rather than being navigated to.
            <iframe id="pdf-preview-frame" srcDoc={html} title={title} className="w-full h-[70vh] bg-white" />
          ) : url ? (
            // <object> rather than <iframe> so that a browser which will not
            // display a PDF in place renders the children instead of a
            // broken-document icon.
            <object id="pdf-preview-frame" data={url} type="application/pdf" className="w-full h-[70vh]">
              <div className="p-8 text-center space-y-3">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  This browser will not display the document inside the app. It is ready — open it in
                  a tab or download it.
                </p>
              </div>
            </object>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {preparing}
            </div>
          )}
        </div>

        {((pages && pages.length > 0) || url || html) && !error && (
          <div className="flex justify-end gap-2">
            {pages && pages.length > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={printPages}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            ) : html ? (
              <Button type="button" variant="outline" size="sm" onClick={print}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
              >
                Open in new tab
              </Button>
            )}
            {onDownload && (
              <Button type="button" variant="outline" size="sm" onClick={onDownload} disabled={downloading}>
                <Download className="h-4 w-4 mr-1" /> Download
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
