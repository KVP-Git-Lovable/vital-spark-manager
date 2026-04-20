// Helper to render product unit display consistently across the app.
// Reads new fields (base_unit, sub_unit, conversion_value) with fallback
// to legacy fields (unit, qty_per_unit) so existing data renders correctly.
export function formatProductUnit(product: any): string {
  if (!product) return "";
  const base = product.base_unit || product.unit || "";
  const sub = product.sub_unit || "";
  const conv = Number(product.conversion_value ?? product.qty_per_unit ?? 1) || 1;
  if (!base) return "";
  if (sub && conv > 1) return `${base} (${conv} ${sub})`;
  return base;
}
