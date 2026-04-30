## Goal

Rewrite `src/pages/portal/PortalLanding.tsx` so it strictly mirrors the layout, section order, and content of the uploaded reference HTML (`The Skin Clinic | Simply . Better . Skin`). Replace every Unsplash / AI placeholder currently on the page with the actual images hosted on the clinic's CDN (`theskinclinicorgin.swipepages.media`). Preserve all portal functionality — every CTA continues to route to `/portal/login`.

## Section order (matches reference HTML top → bottom)

1. **Sticky Navbar** — logo + "The Skin Clinic" wordmark · "Book An Appointment" → goes to `/portal/login` (renamed visually to "Access My Portal" per existing requirement, but keeps the navbar slot).
2. **Hero** — left: H1 "For the perfect skin you desire", subline, 5★ + "200+ 5 Star Google Rating", CTAs *Enquiry on WhatsApp* / *Call Now* / *Access My Portal*. Right: hero portrait `closeup-handsome-young-man-getting-facial-rejuvenation-therapy-health-spa-spxoq8.jpg`.
3. **Stats band** (mint gradient): `10000+ Laser Treatments`, `15000+ Satisfied Patients`, `6+ Years of Establishment`.
4. **Our Doctors** — two cards using `doctor1.webp` (Dr. Punya Suvarna, MBBS, MD, FAGE, MRCP(SCE), Dermatologist, 5+ yrs) and `doctor2.webp` (Dr. Vindhya A. Pai, Founder, MBBS MD Dermatologist, 14+ yrs).
5. **WhatsApp band** — "Have Questions? Chat With Our Expert Instantly on WhatsApp" + green WhatsApp button + dark Call button.
6. **Services We Provide** — 6 cards with the *exact* CDN images and copy from the HTML:
   - Skin Treatments → `facial.webp`
   - Laser Hair Reduction → `laser-uyv67m.webp`
   - Anti Ageing Treatment → `anti-aging-treatment-and-filler-injection.webp`
   - Pre Wedding Skin Care → `beautiful-woman-getting-beauty-treatment--1--2500.webp`
   - Fat Loss → `fat.webp`
   - Filler Treatment → `woman-with-marked-face-receiving-botox-injection-2500.webp`
7. **Before and After / Gallery** — grid of clinic tour photos: `skin-clinic-tour-13/27/28/31/32/33/41/42-btx5nw/43.jpg` (we'll use ~6 of these).
8. **Why Choose The Skin Clinic** — 4 cards using the actual icons from the site: `dermatologist.webp`, `deadline.webp` (No-Rush), `commitment.webp` (Comfortable & Confidential), `interactivity.webp` (State-of-the-Art).
9. **Achieve the skin you've always dreamed of** CTA band → Call Now + Access My Portal.
10. **Testimonials** — 4 patient quotes (Sharvari Shetty, Varsha Rani, Sagar Jogi, Sahana A) — verbatim from the HTML.
11. **Book Your Consultation in Seconds via WhatsApp** band.
12. **About Us** — two-paragraph block from the HTML.
13. **FAQ** — three Q/A items with full answers from the HTML.
14. **Footer** — Services list, "Simply. Better. Skin." tagline, Mon–Sat 10AM–8PM, 9380682287, Kadri Mangalore.
15. **Floating WhatsApp + Call buttons** (kept from current implementation).

## Images

All images are hot-linked directly from `https://theskinclinicorgin.swipepages.media/2023/{11,12}/64c3bc8f029443001063c027/<file>`. No new asset files are added; the AI-generated `portal-hero-skin.jpg`, `portal-doctor-1.jpg`, `portal-doctor-2.jpg` will simply stop being imported (left on disk, can be deleted later — they're harmless).

Every CTA — "Access My Portal", "Get Started Free" (kept on the dark CTA band), "Book An Appointment" — routes to `/portal/login` via `useNavigate`. WhatsApp / Call buttons keep their `wa.me` and `tel:` links.

## Technical notes

- Single file rewrite: `src/pages/portal/PortalLanding.tsx`.
- Keep existing palette tokens (`NAVY #1F2A44`, `NAVY_DARK #1A1F36`, `GREEN #1F8A3C`), Plus Jakarta Sans for headings, Inter for body.
- Continue using shadcn `Button` + `Accordion` and `framer-motion` for fade-ins.
- Mobile-responsive: 1-col on mobile, 2-col tablet, 3-col desktop for services/gallery; stacked hero on mobile.
- Remove imports of `portal-hero-skin.jpg`, `portal-doctor-1.jpg`, `portal-doctor-2.jpg`. Keep `clinicLogo` import.
- No backend or routing changes; no edits to other files.
