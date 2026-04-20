
## Plan: Update Portal Landing footer contact details

### File
`src/pages/portal/PortalLanding.tsx` (footer block, lines 419–429)

### Changes
Replace the three existing contact rows with four rows using the new details, keeping the same icon + spacing pattern (`flex items-center gap-2 md:justify-end`, mint icon color):

- **Clock** icon → `Mon – Sat: 10 AM to 8 PM`
- **Phone** icon → `096201 23030`
- **MapPin** icon → `Kadri, Mangalore`

Remove the email row (`care@theskinclinic.in`) since it wasn't included in the new details. Old phone (`+91 98765 43210`) and location (`Hyderabad, India`) are removed.

Add `Clock` to the existing `lucide-react` import (Phone, Mail, MapPin already imported — `Mail` import will be removed if no longer used elsewhere in the file; will verify and clean).

### Result
Footer right column shows three clean rows: Working Hours, Phone, Location — consistent icon+text alignment with current design.
