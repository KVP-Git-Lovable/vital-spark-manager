import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * On phones the table collapses into stacked label/value cards.
 * Each cell gets a `data-label` derived from its column header so the
 * stacked layout stays readable without horizontal scrolling.
 */
function useStackedLabels(tableRef: React.RefObject<HTMLTableElement>) {
  React.useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const sync = () => {
      const headers = Array.from(table.querySelectorAll("thead th")).map(
        (th) => (th as HTMLElement).innerText.trim(),
      );
      if (!headers.length) return;
      table.querySelectorAll("tbody tr").forEach((tr) => {
        Array.from(tr.children).forEach((cell, i) => {
          const el = cell as HTMLElement;
          if (el.getAttribute("colspan")) {
            el.removeAttribute("data-label");
            return;
          }
          el.setAttribute("data-label", headers[i] ?? "");
        });
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [tableRef]);
}

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTableElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTableElement);
    useStackedLabels(innerRef);
    return (
      <div className="table-scroll relative w-full overflow-x-auto">
        <table
          ref={innerRef}
          className={cn("responsive-table w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-11 whitespace-nowrap px-2 text-left align-middle text-xs font-medium text-muted-foreground sm:h-12 sm:px-4 sm:text-sm [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("px-2 py-3 align-middle sm:p-4 [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
