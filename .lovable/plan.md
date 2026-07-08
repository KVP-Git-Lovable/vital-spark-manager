# The Skin Clinic — Premium Landing Page Plan

Build a fresh, world-class marketing landing page for "The Skin Clinic" that lives alongside the existing app. Reference https://theskinclinic-org-in-web.vercel.app/ for content only; visuals will be completely new.

## Route & entry points

- New public route: `/clinic` (kept separate so the existing `/` clinic dashboard stays untouched). If the user later wants it at the root domain, we swap Index for the new page.
- Existing `/website` marketing page is left as-is (it's the SaaS product page).
- Top-nav **Login** → `/portal/login` (existing Patient Portal).
- **Book Appointment** CTA → `/portal/login?next=/portal/appointments` (portal handles auth then booking).
- Route added inside `App.tsx` at the top level (outside `AppLayout`) so it renders full-bleed.

## Page structure (one file, section components)

`src/pages/clinic/Landing.tsx` composes these sections from `src/components/clinic/*`:

1. `TopNav` — sticky glassmorphic bar, blur-on-scroll, section anchors (Home, About, Treatments, Doctors, Before & After, Stories, Videos, FAQs, Contact), Login + Book Appointment buttons, mobile drawer.
2. `Hero` — full-bleed background (video slot with poster image fallback), gradient overlay, animated headline, dual CTA (Book / Explore Treatments), scroll cue, floating stat chips.
3. `TrustBar` — animated logo/rating strip (Google, Practo, JustDial placeholders).
4. `AboutSection` — split layout, clinic story, mission pillars, subtle parallax image.
5. `StatsCounter` — animated count-up (patients treated, years, procedures, Google rating) using Framer Motion `useInView`.
6. `TreatmentsShowcase` — grid of premium cards (icon + image + hover tilt/lift), categories: Skin, Hair, Laser, Aesthetic, Anti-Aging, Body.
7. `DoctorsSection` — elegant profile cards with photo, credentials, specialization, hover reveal of bio.
8. `BeforeAfterGallery` — draggable slider comparison component (custom, no extra deps) with case selector.
9. `TestimonialsCarousel` — auto-advancing carousel with quotes, patient names, star ratings, avatars.
10. `GoogleReviewsSection` — Google-branded review cards, aggregate rating, "View all on Google" link.
11. `InstagramGallery` — masonry-style image grid with hover overlays and IG icon.
12. `VideoReels` — horizontally scrolling YouTube Shorts cards. Data-driven from a `youtubeShorts` array (seeded with the two provided links: `BOHwC9WgrRk`, `CiCE_ZQEOB8`); adding more later is one array entry. Cards lazy-load thumbnails and open a lightbox modal that embeds the YouTube iframe.
13. `BlogTips` — 3-column article cards (title, excerpt, read-time, image).
14. `ContactSection` — 2-column: enquiry form (name, phone, email, concern, message) + Google Maps embed, plus WhatsApp / phone / email / hours tiles.
15. `Footer` — quick links, social icons, address, copyright.

## Design system

- Palette: white base, primary teal (existing `--primary`), emerald secondary, subtle gold accent (new token `--gold: 42 65% 55%`), deep charcoal text. All new colors added as HSL tokens in `index.css` and `tailwind.config.ts` — no hardcoded colors.
- Typography: keep Plus Jakarta Sans display + Inter body (already loaded). Larger scale for landing headlines (`text-6xl`/`text-7xl` on desktop).
- Effects: glassmorphism (`backdrop-blur` + translucent white), soft gradient meshes, layered shadows (new `--shadow-luxe`), 24px radius on marquee cards.
- Motion: Framer Motion (already installed) — fade/slide-in on scroll, stagger children, hover scale/tilt, marquee scroll, count-up stats, animated gradient blobs.
- Loading: route-level fade transition; images use `loading="lazy"` and blurred placeholders.

## Content & assets

- Copy adapted from the reference site (treatments list, doctor names, contact info) rewritten to fit the new layout — no scraping of their design.
- Placeholder imagery: generate 6–8 premium photos (hero, treatment cards, doctors, IG tiles) with `imagegen` at build time; each swappable via the section's data array without touching layout.
- YouTube: seeded with the 2 provided IDs; component accepts any number.
- Before/After: 4 placeholder pairs, easy to replace.

## SEO & performance

- `react-helmet-async` for per-page `<title>`, meta description, canonical, og:*, and `MedicalBusiness` JSON-LD (name, address, phone, hours, aggregateRating).
- Semantic sections, single H1 in Hero, alt text on all images, lazy loading, responsive `srcSet` where images are large.
- Video reels use thumbnail-first pattern (no iframe until click) to keep TTI fast.

## Technical notes

- Files: `src/pages/clinic/Landing.tsx`, `src/components/clinic/*.tsx` (~15 small files), `src/components/clinic/data.ts` (arrays for treatments, doctors, testimonials, reviews, IG, videos, blog).
- No backend changes. Enquiry form posts to a new lightweight `contact_enquiries` table? — **not in scope for this plan**; the form will show a success toast and log payload. We can wire it to Lovable Cloud in a follow-up if you want persistence.
- `App.tsx`: add `<Route path="/clinic/*" element={<Landing />} />` above the catch-all AppLayout route, and wrap the app in `HelmetProvider` in `main.tsx`.
- No changes to existing pages, auth, or portal.

## Out of scope (ask if wanted)

- Making `/` (root) show this landing page instead of the clinic dashboard.
- Persisting contact form submissions to the database.
- Real Google Reviews API integration (uses curated static reviews for now).
- Custom video uploads / non-YouTube hosting.
