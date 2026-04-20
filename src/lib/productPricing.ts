// Resolve product pricing from the latest active inventory batch.
// Falls back to legacy product-level prices when no batch exists.

export interface InventoryRow {
  product_id: string;
  quantity: number;
  expiry_date: string;
  received_date?: string;
  mrp?: number;
  selling_price?: number;
}

export interface ResolvedPrice {
  mrp: number;
  sellingPrice: number;
  subUnitPrice: number | null;
  subUnit: string | null;
  hasBatch: boolean;
}

export function getActiveBatchPrice(product: any, inventoryRows: InventoryRow[] = []): ResolvedPrice {
  const today = new Date().toISOString().slice(0, 10);
  const batches = inventoryRows
    .filter(r => r.product_id === product?.id && Number(r.quantity) > 0 && r.expiry_date >= today)
    .sort((a, b) => (b.received_date || "").localeCompare(a.received_date || ""));

  const latest = batches[0];
  const baseMrp = latest && Number(latest.mrp) > 0 ? Number(latest.mrp) : Number(product?.mrp ?? 0);
  const baseSp = latest && Number(latest.selling_price) > 0
    ? Number(latest.selling_price)
    : Number(product?.selling_price ?? baseMrp);

  const conv = Number(product?.conversion_value ?? product?.qty_per_unit ?? 1) || 1;
  const sub = product?.sub_unit || null;
  const subUnitPrice = sub && conv > 1 ? baseSp / conv : null;

  return {
    mrp: baseMrp,
    sellingPrice: baseSp,
    subUnitPrice,
    subUnit: sub,
    hasBatch: !!latest,
  };
}
