

## Plan: Service-to-Tax mapping in Tax Master + auto-tax in Billing

### 1. Schema migration
New table `tax_master_services` (mirrors `tax_master_products`):
```sql
CREATE TABLE public.tax_master_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_id uuid NOT NULL,
  service_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tax_id, service_id)
);
ALTER TABLE public.tax_master_services ENABLE ROW LEVEL SECURITY;
-- anon + authenticated full-access policies (matching tax_master_products pattern)
```

### 2. `src/pages/TaxMasterForm.tsx` — add Mapped Services section
- Add `ServiceLink = { service_id: string; is_active: boolean }` state `serviceLinks`, plus `originalActiveServiceIds`.
- New queries: `services` list (`id, name, price`) and `tax-service-claims` (cross-tax claim map for services), parallel to product versions.
- Build `serviceClaimMap` (excludes current tax id, only active mapping + active tax).
- Load existing `tax_master_services` in the main `existing` query (extend select to include `tax_master_services(service_id, is_active)`).
- Render a new "Mapped Services" card directly under "Mapped Products" in the right panel, with same UI: searchable Popover/Command picker (disable already-claimed services with Tooltip "Already mapped to {taxName} {rate}% — deactivate there first"), per-row Active/Inactive Switch, Remove (X).
- `performSave`: replicate all three branches (insert / version / in-place) for services — insert/delete `tax_master_services` rows alongside `tax_master_products`. No `gst_percent` write-back (services table has no tax column; tax is resolved at billing time via mapping).

### 3. `src/pages/Billing.tsx` — auto-populate tax for services
- New query `tax-master-services-active`: fetches `tax_master_services` (active mappings on active tax) joined with service id and tax id.
- Build `serviceTaxMap: Map<service_name, tax_id>` (use name because `serviceInputs` rows hold names, and the existing service master query already has `id, name, price`; cross-reference via service_id → name).
- Extend `updateServiceInput` (or the service Popover `onSelect` in line ~829): when a service is picked, if `serviceTaxMap.has(svc.name)` and current `selectedTaxId` is empty (don't override an existing pharma-driven selection unless they match), set `selectedTaxId` to the mapped tax id; else leave as-is.
- Decision rule when both a product AND a service map to different tax rates: **last selected wins** (simple, matches existing pharma behavior). Same fallback to "" (No Tax) if service has no mapping and no product mapping is active.

### 4. Files
- New migration: `tax_master_services` table + RLS policies
- Modified: `src/pages/TaxMasterForm.tsx` (parallel services section + save logic)
- Modified: `src/pages/Billing.tsx` (service→tax lookup + auto-select on service pick)

No changes to invoice schema — `invoices.tax_id/tax_rate/tax_amount` snapshot already preserves history.

