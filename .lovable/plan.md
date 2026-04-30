## Goal
Replace the current dark-teal gradient PortalLanding with a faithful recreation of the clinic's external landing page (https://lp.theskinclinic.org.in/google) — light background, mint/teal accents, dark navy text — while keeping all CTAs routed to `/portal/login` so existing portal functionality is preserved.

## What changes

**File:** `src/pages/portal/PortalLanding.tsx` (full rewrite)

The existing file is the only thing being replaced. Routing (`/portal` → `PortalLanding`, `/portal/login` → `PortalLogin`) and all downstream portal logic remain untouched.

## New page structure (top to bottom)

1. **Sticky Navbar** (white, subtle shadow)
   - Left: butterfly logo + "The Skin Clinic" wordmark
   - Right: "Access My Portal" button (dark navy, white text) → `/portal/login`
   - Mobile: logo + compact "Portal" button

2. **Hero** (light grey/white background, two-column on desktop, stacked on mobile)
   - Left column:
     - H1: "For the perfect skin you desire" (dark navy, large display font)
     - Subtitle: "Find the permanent solution to your skin issues with our expert care!"
     - 5-star row + "200+ 5 Star Google Rating"
     - Primary CTA: **"Access My Portal"** (dark navy) → `/portal/login`
     - Secondary CTA: **"Get Started Free"** (mint/green) → `/portal/login`
   - Right column: hero portrait image (use a stock dermatology/skincare portrait via Unsplash URL — the original site image is copyrighted)

3. **Stats band** (mint gradient strip)
   - 10000+ Laser Treatments · 15000+ Satisfied Patients · 6+ Years of Establishment

4. **Our Doctors** (white section, two cards)
   - Dr. Punya Suvarna — MBBS, MD, FAGE, MRCP (SCE) · Dermatologist · 5+ Years Experience
   - Dr. Vindhya A. Pai — Founder · MBBS, MD Dermatologist · 14+ Years Experience
   - Generic professional placeholder portraits (Unsplash)

5. **WhatsApp / Contact band** ("Have Questions? Chat With Our Expert Instantly on WhatsApp")
   - Buttons: "Chat on WhatsApp Now" (green, opens `https://wa.me/919380682287`) and "Call Now" (`tel:9380682287`)

6. **Services We Provide** (mint gradient background, 3×2 card grid)
   Skin Treatments · Laser Hair Reduction · Anti Ageing Treatment · Pre Wedding Skin Care · Fat Loss · Filler Treatment — each with image, title, and short description copied from the source site.

7. **Before & After** (white, simple 3-image row / horizontal scroll on mobile) using neutral placeholder treatment images.

8. **Why Choose The Skin Clinic** (mint gradient, 4 feature cards with icon)
   - State-of-the-Art Facility · Comfortable & Confidential · No-Rush Appointments · Experienced Dermatologist

9. **Patient Testimonials** (white, 3–4 cards with name, 5 stars, quote) — use the testimonials from the source page (Sharvari Shetty, Varsha Rani, Sagar Jogi, Sahana A).

10. **Portal CTA banner** (dark navy, full width)
    - Title: "Access Your Patient Portal"
    - Body: "Manage appointments, view prescriptions, reorder medicines, and track your skin journey — all in one place."
    - Buttons: **"Access My Portal"** and **"Get Started Free"** → both `/portal/login`

11. **FAQ** (white, accordion using existing `@/components/ui/accordion`)
    - Are Your Treatments Safe?
    - How do I Book an Appointment?
    - Is There Any Down Time After Treatments?

12. **Footer** (light, three columns)
    - Brand + tagline "Simply. Better. Skin."
    - Quick links: Skin Treatment, Laser Hair Reduction, Hair Restoration, Pre Wedding Skin Care, Fat Loss
    - Hours (Mon–Sat 10 AM–8 PM), Phone (9380682287), Address (Kadri, Mangalore)
    - Copyright row

13. **Floating action buttons** (fixed bottom-left, like reference): black square Phone button + green WhatsApp button.

## Design tokens

- Background: white / very light grey (`#FFFFFF`, `#F7F9F8`)
- Mint section bg: soft gradient `from-[hsl(150,40%,90%)] to-[hsl(160,45%,82%)]`
- Primary text: dark navy `#1F2A44` (matches reference)
- Accent green (WhatsApp / Get Started Free): `#1F8A3C`
- Dark CTA: navy `#1A1F36`
- Headings: Plus Jakarta Sans (already loaded in `index.css`)
- Body: Inter

## CTA routing rules (all enforced)

| Button | Destination |
|---|---|
| Navbar "Access My Portal" | `/portal/login` |
| Hero "Access My Portal" | `/portal/login` |
| Hero "Get Started Free" | `/portal/login` |
| CTA banner "Access My Portal" | `/portal/login` |
| CTA banner "Get Started Free" | `/portal/login` |
| WhatsApp buttons | `https://wa.me/919380682287` (new tab) |
| Call buttons | `tel:9380682287` |

## Mobile responsiveness

- Hero: stacks (text first, image hidden or below) under `md`
- Navbar: condenses to logo + single icon-button "Portal"
- Service grid: 1 col mobile → 2 cols tablet → 3 cols desktop
- Doctors: 1 col mobile → 2 cols desktop
- Why Choose: 1 col mobile → 2 cols tablet → 4 cols desktop
- Testimonials: horizontal snap-scroll on mobile, 3-col grid on desktop
- Floating call/WhatsApp FABs visible on all sizes

## Things kept intact

- Route `/portal` still renders `PortalLanding` (no router changes)
- `/portal/login` and downstream portal pages, auth, bot, surveys — untouched
- `clinicLogo` asset import retained for navbar
- No backend, schema, or edge-function changes

## Out of scope

- No new images uploaded to `src/assets/` — use Unsplash URLs for doctor/hero/treatment placeholders. If you'd prefer the actual clinic photos, upload them after approval and I'll swap the URLs.
- No changes to PortalLogin page styling.
