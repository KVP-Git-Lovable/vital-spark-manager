

## Plan: Portal Landing Page + Login Route Refactor

### What Changes

1. Create a new `PortalLanding.tsx` page at `/portal` with hero section, feature cards, and footer
2. Move existing phone login form to `/portal/login` 
3. Update routing in `App.tsx`

### Technical Details

**File 1: `src/pages/portal/PortalLanding.tsx`** (new)
- Hero section with full-width teal-to-mint gradient, clinic logo + name top-left, "Access My Portal" button top-right
- Large headline + subheadline with two CTA buttons linking to `/portal/login`
- Decorative SVG pattern/circles on right side of hero
- 3 feature cards (Appointments, Prescriptions, Order Medicines) with icons, hover shadow lift, teal accents, click navigates to `/portal/login`
- Smooth scroll fade-in animations using framer-motion
- Footer with clinic name, phone, email, copyright
- Fully mobile responsive

**File 2: `src/App.tsx`**
- Import `PortalLanding`
- Change `/portal` route from `<PortalLogin />` to `<PortalLanding />`
- Add new route `/portal/login` → `<PortalLogin />`

**File 3: `src/pages/portal/PortalLogin.tsx`**
- No logic changes needed — it already works standalone
- Optionally add a "← Back to Portal" link at the bottom

### Flow
```text
/portal          → PortalLanding (hero + features + footer)
/portal/login    → PortalLogin (existing phone login form)
/portal/dashboard → Portal (existing dashboard)
```

