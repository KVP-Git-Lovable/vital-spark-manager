

## Plan: Portal Branding, UI Fix, and Premium Redesign

### What Changes

1. **Branding update** — Replace "DermaCare" with "The Skin Clinic" in PortalLanding, PortalLogin, and PatientDetail (clipboard text)
2. **Logo** — Copy uploaded clinic logo to `src/assets/skin-clinic-logo.png`, use it in both landing and login pages instead of the Heart icon
3. **Fix overlapping cards** — Remove the `-mt-12` negative margin on the feature cards section; add proper spacing (`pt-16 pb-20`)
4. **Premium redesign of PortalLanding.tsx**:
   - Add thin teal announcement bar at the very top: "Welcome to The Skin Clinic Patient Portal"
   - Hero: larger text (6xl→7xl on lg), more abstract decorative shapes on right, more padding bottom to prevent overlap
   - Feature cards: teal top border (`border-t-4 border-[hsl(174,62%,40%)]`), icon in colored circle, ArrowRight on each card
   - Login outline button: explicit white border, more visible
   - More whitespace throughout
5. **PortalLogin.tsx** — Replace "DermaCare Portal" with "The Skin Clinic", swap Heart icon for clinic logo image
6. **PatientDetail.tsx** — Change clipboard text from "DermaCare portal" to "The Skin Clinic portal"

### Files Modified
- `src/assets/skin-clinic-logo.png` — copy from upload
- `src/pages/portal/PortalLanding.tsx` — full redesign
- `src/pages/portal/PortalLogin.tsx` — branding update
- `src/pages/PatientDetail.tsx` — line 375 clipboard text

### No routing changes needed
Portal URLs are already `/portal`, `/portal/login`, `/portal/dashboard` — all correct.

