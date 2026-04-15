

## Plan: Restructure Surveys as Collapsible Sidebar Menu

### Overview
Replace the single "Surveys" sidebar link with a collapsible parent item containing two sub-items: "Survey Templates" and "All Surveys". Create a new page for viewing all survey responses.

### Step 1 — Create "All Surveys" page

New file `src/pages/AllSurveys.tsx`:
- Query `survey_responses` joined with `survey_templates(name)` and `patients(first_name, last_name)`
- Display a searchable table with columns: Date, Patient, Template, Score/Status
- Each row links to or expands the response details

### Step 2 — Add route in App.tsx

Add `<Route path="/all-surveys" element={<AllSurveys />} />` alongside the existing `/survey-templates` route.

### Step 3 — Restructure sidebar with collapsible group

In `src/components/layout/AppSidebar.tsx`:
- Remove the "Surveys" entry from `mainItems`
- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible`
- Import `ChevronDown` icon
- After rendering the main menu items, add a collapsible `SidebarMenuItem` for "Surveys" with:
  - `ClipboardCheck` icon + "Surveys" label as the trigger
  - Two nested sub-items:
    - "Survey Templates" → `/survey-templates`
    - "All Surveys" → `/all-surveys`
  - Auto-expand when either sub-route is active

### Files changed
- `src/components/layout/AppSidebar.tsx` — collapsible surveys menu
- `src/pages/AllSurveys.tsx` — new page (survey responses list)
- `src/App.tsx` — add `/all-surveys` route

