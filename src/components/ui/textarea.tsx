import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-input/80 bg-background/60 px-3 py-2 text-sm shadow-sm backdrop-blur-sm ring-offset-background transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-muted-foreground hover:border-primary/25 hover:bg-background/75 focus-visible:border-primary/45 focus-visible:bg-background/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:shadow-[var(--shadow-control)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none motion-reduce:transition-none",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
