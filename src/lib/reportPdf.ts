import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/currency";
import { REPORT_DATE_RANGE_OPTIONS } from "@/lib/reportDateRange";
import type { ReportColumn, ReportConfig } from "@/lib/reportsCatalog";
import type { FilterState } from "@/components/reports/ReportFilterBar";
import bundledLogo from "@/assets/skin-clinic-logo.png";

/**
 * PDF export for the report screens.
 *
 * jsPDF's built-in Helvetica is WinAnsi-encoded and has no rupee sign (U+20B9),
 * so anything drawn has to be ASCII first. The edge functions that produce the
 * invoice and prescription PDFs already settled on this: generate-prescription-pdf
 * strips non-ASCII in its own sanitize(), and generate-invoice-pdf heads its money
 * columns "Charges (Rs)". Same convention here - currency columns are headed
 * "(Rs)" and their values printed as plain grouped numbers.
 */

/** ASCII-only text, with the punctuation we actually emit mapped rather than dropped. */
export function sanitize(value: unknown): string {
  return String(value ?? "")
    .replace(/₹/g, "Rs ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ReportRow = Record<string, unknown>;

function cellValue(col: ReportColumn, row: ReportRow) {
  return col.accessor ? col.accessor(row) : row[col.key];
}

/**
 * The string form of a cell, mirroring SortableDataTable.renderCell so the PDF and
 * the table on screen never disagree. col.render returns a ReactNode and cannot be
 * used here, so those columns fall through to the raw value.
 */
export function reportCellText(col: ReportColumn, row: ReportRow): string {
  const v = cellValue(col, row);
  if (v === null || v === undefined || v === "") return "-";
  switch (col.type) {
    case "currency":
    case "number":
      return formatNumber(Number(v));
    case "date":
      try { return format(new Date(v), "dd MMM yyyy"); } catch { return String(v); }
    case "datetime":
      try { return format(new Date(v), "dd MMM yyyy h:mm a"); } catch { return String(v); }
    default:
      return String(v);
  }
}

/** Currency columns say which currency, since the values carry no symbol. */
export function reportColumnHeader(col: ReportColumn): string {
  return col.type === "currency" ? `${col.label} (Rs)` : col.label;
}

const isNumeric = (col: ReportColumn) => col.type === "currency" || col.type === "number";

/**
 * Head cells, with the alignment set on the cell itself.
 *
 * autoTable applies `columnStyles` to body cells only - jspdf.plugin.autotable.mjs
 * has `colStyles = sectionName === 'body' ? columnStyles : {}` - so a right-aligned
 * money column would otherwise get a left-aligned heading sitting over
 * right-aligned figures. Per-cell styles are merged last and do reach the head.
 */
export function pdfHeadCells(columns: ReportColumn[]) {
  return columns.map((c) => ({
    content: sanitize(reportColumnHeader(c)),
    styles: isNumeric(c) ? { halign: "right" as const } : {},
  }));
}

const presetLabel = (key?: string) =>
  REPORT_DATE_RANGE_OPTIONS.find((o) => o.key === key)?.label;

/**
 * One line describing what the reader is looking at. The concrete dates are always
 * printed next to the period name - "Current Month" means nothing once the file has
 * been emailed on.
 */
export async function describeFilters(
  report: ReportConfig,
  state: FilterState,
  dayOnly: boolean,
): Promise<string> {
  const parts: string[] = [];

  const from = state.dateFrom;
  const to = dayOnly ? from : state.dateTo;
  const dates =
    from && to
      ? from.getTime() === to.getTime()
        ? format(from, "dd MMM yyyy")
        : `${format(from, "dd MMM yyyy")} - ${format(to, "dd MMM yyyy")}`
      : "";
  const preset = dayOnly ? undefined : presetLabel(state.datePreset);
  if (dates) parts.push(preset && preset !== "Custom Date Range" ? `${preset} (${dates})` : dates);
  else if (preset) parts.push(preset);

  for (const f of report.filters) {
    const v = state.selects[f.key];
    if (!v) continue;
    if (f.type === "doctor") {
      // The select holds a staff id, not a name - resolve it, but only when set.
      const { data } = await supabase
        .from("staff")
        .select("first_name,last_name")
        .eq("id", v)
        .maybeSingle();
      const name = data ? `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() : "";
      parts.push(name || f.label);
      continue;
    }
    const option = f.options?.find((o) => o.value === v);
    parts.push(option?.label ?? v);
  }

  if (state.search.trim()) parts.push(`Search: "${state.search.trim()}"`);

  return parts.join("  -  ");
}

/** Fetch an image as a data URL, so a cross-origin logo cannot taint jsPDF's canvas. */
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface ClinicHeader {
  name: string;
  lines: string[];
  logo: string | null;
}

interface ClinicSettingsRow {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
}

async function loadClinicHeader(): Promise<ClinicHeader> {
  let clinic: ClinicSettingsRow | null = null;
  try {
    const { data } = await supabase.from("clinic_settings").select("*").limit(1).maybeSingle();
    clinic = data as ClinicSettingsRow | null;
  } catch {
    // A missing or unreadable settings row must not block the export.
  }

  // The admin-uploaded logo first, so a new upload in Settings reaches every
  // document; the bundled mark is the fallback and is always available.
  const logo =
    (clinic?.logo_url ? await toDataUrl(clinic.logo_url) : null) ?? (await toDataUrl(bundledLogo));

  const address = [clinic?.address, clinic?.city, clinic?.pincode].filter(Boolean).join(", ");
  const contact = [clinic?.phone, clinic?.email].filter(Boolean).join("  |  ");

  return {
    name: clinic?.name || "The Skin Clinic",
    lines: [address, contact, clinic?.website].filter(Boolean).map(String),
    logo,
  };
}

export interface ReportPdfArgs {
  report: ReportConfig;
  rows: ReportRow[];
  summary: { label: string; value: string }[];
  filterState: FilterState;
  dayOnly: boolean;
}

/** Assemble the document. Split from the save so the output can be inspected in tests. */
export async function buildReportPdf({ report, rows, summary, filterState, dayOnly }: ReportPdfArgs) {
  const [{ jsPDF }, { autoTable }, clinic, filterLine] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadClinicHeader(),
    describeFilters(report, filterState, dayOnly),
  ]);

  const landscape = report.columns.length > 6;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  let y = margin;

  // Header: logo left, clinic identity beside it.
  let textX = margin;
  if (clinic.logo) {
    try {
      const props = doc.getImageProperties(clinic.logo);
      const h = 42;
      const w = (props.width / props.height) * h;
      doc.addImage(clinic.logo, margin, y, w, h);
      textX = margin + w + 14;
    } catch {
      // An unreadable image degrades to the name alone, as the invoice PDF does.
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(sanitize(clinic.name), textX, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90);
  clinic.lines.forEach((line, i) => doc.text(sanitize(line), textX, y + 29 + i * 11));
  doc.setTextColor(0);

  y += Math.max(46, 29 + clinic.lines.length * 11);
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Title block.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(sanitize(report.title), margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  if (report.description) {
    doc.text(sanitize(report.description), margin, y);
    y += 12;
  }
  if (filterLine) {
    doc.text(sanitize(filterLine), margin, y);
    y += 12;
  }
  doc.text(
    sanitize(`${rows.length.toLocaleString()} record(s)  -  generated ${format(new Date(), "dd MMM yyyy h:mm a")}`),
    margin,
    y,
  );
  doc.setTextColor(0);
  y += 16;

  // Summary boxes.
  if (summary.length) {
    const gap = 10;
    const boxW = (pageWidth - margin * 2 - gap * (summary.length - 1)) / summary.length;
    const boxH = 40;
    summary.forEach((s, i) => {
      const x = margin + i * (boxW + gap);
      doc.setDrawColor(215);
      doc.roundedRect(x, y, boxW, boxH, 3, 3);
      doc.setFontSize(7.5);
      doc.setTextColor(110);
      doc.text(sanitize(s.label).toUpperCase(), x + 8, y + 14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(sanitize(s.value), x + 8, y + 31);
      doc.setFont("helvetica", "normal");
    });
    y += boxH + 16;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 34 },
    head: [pdfHeadCells(report.columns)],
    body: rows.map((r) => report.columns.map((c) => sanitize(reportCellText(c, r)))),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 250, 249] },
    columnStyles: Object.fromEntries(
      report.columns.map((c, i) => [i, isNumeric(c) ? { halign: "right" as const } : {}]),
    ),
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(
        sanitize(`${clinic.name}  -  ${report.title}`),
        margin,
        doc.internal.pageSize.getHeight() - 18,
      );
      doc.text(`Page ${data.pageNumber}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 18, { align: "right" });
      doc.setTextColor(0);
    },
  });

  return doc;
}

export async function downloadReportPdf(args: ReportPdfArgs) {
  const doc = await buildReportPdf(args);
  doc.save(`${args.report.key}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
