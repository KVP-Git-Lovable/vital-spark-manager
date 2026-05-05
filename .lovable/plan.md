# Campaigns Module

A new marketing Campaigns module to track ad/outreach campaigns, link patients to them, and measure ROI.

## 1. Database changes

New tables (with RLS enabled, `authenticated` full access — matching existing module patterns):

**`campaigns`**
- `id` uuid PK
- `name` text not null
- `type` text not null — values: `Google Ads`, `Meta Ads`, `WhatsApp`, `Email`, `Other`
- `status` text not null default `Planning` — `Planning` / `Active` / `Completed`
- `start_date` date, `end_date` date
- `budget` numeric default 0
- `amount_spent` numeric default 0
- `target_audience` text
- `goals` text (description / goals)
- `created_at`, `updated_at` timestamptz, with `update_updated_at_column` trigger

**`campaign_updates`** (for Notes & Updates timeline)
- `id` uuid PK
- `campaign_id` uuid FK → campaigns(id) on delete cascade
- `note` text not null
- `created_by` text (display name; optional)
- `created_at` timestamptz default now()

**`patients` table change**
- Add `campaign_id` uuid nullable, FK → campaigns(id) on delete set null. This is the "Source → Campaign" link. We keep the existing `source` text column as-is; `campaign_id` is the structured link used by the module.

## 2. Sidebar

Edit `src/components/layout/AppSidebar.tsx`: add `{ title: "Campaigns", url: "/campaigns", icon: Megaphone, moduleKey: "campaigns" }` to `mainItems`, positioned between **Report Builder** and **Surveys** (Surveys is the collapsible block right after `mainItems`).

Add route in `src/App.tsx`:
- `/campaigns` → `Campaigns` list (wrapped in `ProtectedRoute moduleKey="campaigns"`)
- `/campaigns/:id` → `CampaignDetail`

`ProtectedRoute` already permits access when no permission record exists, so no user_management seeding is required to make it work, but admins will see it by default (`isAdmin` short-circuits).

## 3. Campaigns list page — `src/pages/Campaigns.tsx`

Mint/teal styled page matching Vendors / Procedures conventions:
- Header with title + "New Campaign" button
- Search box (by name) + Type filter + Status filter
- Table columns: Name, Type (badge), Start/End Date, Budget (₹), Status (color-coded badge), actions (edit/delete)
- Click row → navigate to `/campaigns/:id`
- "New Campaign" opens a Dialog form (name, type select, status select, start/end date pickers, budget, target audience, goals textarea)

## 4. Campaign detail page — `src/pages/CampaignDetail.tsx`

Header: campaign name, type badge, status badge, back button, edit button.

Tabs (using shadcn Tabs):

**Overview** — read-only card grid: Name, Type, Status, Budget, Duration (start → end, computed days), Target Audience, Goals/Description. Edit button opens the same dialog used on the list page.

**Spend & ROI** — editable card:
- Total Budget ₹ (from `campaigns.budget`)
- Amount Spent ₹ (editable inline; updates `campaigns.amount_spent`)
- New Patients acquired — auto-counted: `patients` where `campaign_id = :id`
- Revenue generated ₹ — auto-summed: `invoices.total_amount` joined via `patient_id` for those patients (sum of paid + pending; we'll use `total_amount`)
- ROI % — computed client-side: `((revenue - spent) / spent) * 100`, displayed with color (green if positive)
- Stat cards reuse `StatCard` component

**Linked Patients** — list of patients with `campaign_id = :id`:
- Table: Name, Phone, Joined date, Source field
- "Link Patient" button → searchable patient combobox (reuse `PatientCombobox`) → sets that patient's `campaign_id`
- "Unlink" action sets `campaign_id` to null

**Notes & Updates** — timeline:
- Textarea + "Add Update" button → inserts row into `campaign_updates`
- List sorted desc by `created_at`, each entry as a card with timestamp

## 5. Patient form — campaign source field

Edit `src/components/patients/PatientFormSheet.tsx`:
- Add a "Campaign" select (dropdown of all campaigns) below the existing Source field
- Stores into `patients.campaign_id`
- Shown regardless of source value (independent structured link)

## 6. Dashboard widget

Edit `src/pages/Index.tsx`: add a `StatCard` (or two) near the existing top-row stat cards:
- **Active Campaigns** — count of `campaigns` where `status = 'Active'`
- **Campaign Spend (This Month)** — sum of `amount_spent` for campaigns whose `start_date` or `end_date` overlaps the current month. (Simpler MVP: sum `amount_spent` for all `Active` campaigns.) We'll use the simpler "sum amount_spent for Active campaigns" since spend isn't time-bucketed in the schema.

Both cards are clickable → navigate to `/campaigns`.

## 7. Memory update

Add a new memory file `mem://features/campaigns` describing the module and update `mem://index.md` to reference it.

## Out of scope

- No external API integration (Google/Meta Ads pulls) — spend is entered manually.
- No per-day spend history table — single `amount_spent` field on the campaign.
