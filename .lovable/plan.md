

## Plan: Filter Survey Template Dropdown to Active + Approved Only

### Problem
The "Select template" dropdown in the Surveys tab fetches templates filtered only by `is_active = true`, but does not filter by `approval_status = 'approved'`. This means draft and pending-approval templates appear in the dropdown.

### Change — Single file: `src/pages/PatientDetail.tsx`

**Line ~212**: Add `.eq("approval_status", "approved")` to the existing query chain:

```typescript
// Before
.from("survey_templates").select("id, name").eq("is_active", true).order("name");

// After
.from("survey_templates").select("id, name").eq("is_active", true).eq("approval_status", "approved").order("name");
```

One-line change. No other files affected.

