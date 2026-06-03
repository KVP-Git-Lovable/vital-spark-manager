## Prescription PDF Refinements

Three small changes to `supabase/functions/generate-prescription-pdf/index.ts`:

### 1. Teal section headings
Replace the blue `blueHead` color used for "Prescription", "Symptoms", "Diagnosis", "Procedure Details" with teal `#1D9E75` (rgb 0.114, 0.620, 0.459). The divider line under the title stays as-is (or also switched to teal for consistency — will match heading color).

### 2. Two-column body layout
The code already splits left (Prescription) vs right (Symptoms/Diagnosis/Procedure Details). I'll verify column widths and gutter against the reference PDF and tighten if needed so:
- Left col: Prescription only (full height)
- Right col: Symptoms → Diagnosis → Procedure Details stacked

No structural change expected beyond confirming spacing matches reference.

### 3. White preview background
The "dark background around the PDF preview" is from the in-app PDF viewer wrapper, not the PDF itself. I'll locate the preview component (likely the procedure detail sheet's PDF iframe/object wrapper) and ensure its container uses a white/light background (`bg-background` or `bg-white`) instead of the dark surface it currently sits on.

### Files
- `supabase/functions/generate-prescription-pdf/index.ts` — color change, layout verification
- Whichever component renders the prescription PDF preview (to be located during build) — background fix

No DB or schema changes.
