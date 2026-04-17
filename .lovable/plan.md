

## Plan

### 1. Landing page not loading on clinic.quickapp.ai/portal
The code at `src/pages/portal/PortalLanding.tsx` already contains the new redesigned landing page (hero, stats band, features, how-it-works, testimonial, CTA band). The screenshot shows the old "DermaCare Portal" phone-login UI — meaning the **published build on the custom domain is stale**. Action: after the changes below, the user needs to **Publish** again from the top-right of Lovable. No code change is required to make the route render — `<Route path="/portal" element={<PortalLanding />} />` is already correct in `App.tsx`.

### 2. Remove dummy data from `PortalLanding.tsx`
The hero's right-side mockup currently shows fake patient data: "Priya Sharma", "Acne Follow-up · Dr. Mehta", "Tretinoin 0.025%", "Vitamin C Serum", "Order Delivered 2 hours ago", "4.9 Rating · From 2.4k reviews", and a fake testimonial from "Ananya Kapoor".

Changes:
- **Hero mockup card**: Replace the "Priya Sharma" personalised card with a **generic, label-style preview** (no names, no real-looking prescriptions). E.g. show abstract section labels: "Your Next Appointment", "Your Active Prescriptions" with empty/placeholder rows ("Login to view") and a generic "Skin Score" tile labelled as illustrative.
- **Floating chips** ("Order Delivered 2 hours ago", "4.9 Rating From 2.4k reviews"): replace with neutral feature chips ("Secure & Private", "24/7 Access").
- **Stats band** (10k+, 50k+, 4.9★, 24/7): keep only `24/7 Access` and `Secure` style neutral indicators (remove fabricated patient/prescription counts).
- **Testimonial section "Ananya Kapoor"**: remove the entire testimonial section (no real testimonial yet).

### 3. Hardcode portal URL to `https://clinic.quickapp.ai/portal`
In `src/pages/PatientDetail.tsx` (lines ~370–386), the portal access code panel uses `${window.location.origin}/portal` — when staff are on the preview/staging URL this generates the wrong link. Replace both occurrences with the hardcoded constant `https://clinic.quickapp.ai/portal`.

### Files modified
- `src/pages/portal/PortalLanding.tsx` — remove all dummy/personal data, keep premium look with generic content
- `src/pages/PatientDetail.tsx` — hardcode portal URL in 2 places (display + clipboard copy)

### After implementation
The user should click **Publish** in Lovable to push the new landing page to `clinic.quickapp.ai`.

