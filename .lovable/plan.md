

## Plan: Post-Recurring-Appointment Billing Prompt

### What Changes

After creating recurring appointments, show a follow-up dialog asking "Would you like to create a billing plan for these appointments?" with two buttons. Clicking "Yes, Create Invoice" navigates to the Billing page with query params to pre-fill patient and service. The Billing page reads those params and auto-opens the Create Invoice dialog with fields pre-filled.

### Technical Details

**File 1: `src/pages/Appointments.tsx`**
- Add state: `showBillingPrompt` (boolean), and store `lastCreatedPatientId` / `lastCreatedService` before resetting the form.
- In `onSuccess` of `createAppointment` mutation: if `isRecurring`, set `showBillingPrompt = true` and store patient/service info instead of immediately resetting.
- Add a `<Dialog>` for the billing prompt with two buttons:
  - "Yes, Create Invoice" → navigate to `/billing?prefillPatient={id}&prefillService={name}`, close dialog.
  - "Skip" → close dialog, reset form.
- Import `useNavigate` from `react-router-dom`.

**File 2: `src/pages/Billing.tsx`**
- Import `useSearchParams` from `react-router-dom`.
- On mount, read `prefillPatient` and `prefillService` from URL params.
- If present: set `patientId` to the prefill value, set `serviceInputs[0]` to the prefill service name, auto-open the Create Invoice dialog (`setOpen(true)`), then clear the search params.
- Add a `useEffect` to handle this pre-fill logic.

### Flow
```text
Appointments: Create Recurring → Success → Billing Prompt Dialog
  ├─ [Yes, Create Invoice] → navigate("/billing?prefillPatient=xxx&prefillService=yyy")
  └─ [Skip] → close, reset form

Billing: reads URL params → opens dialog → pre-fills Patient + Service[0]
```

