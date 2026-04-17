

## Plan: Premium Portal Landing Page Redesign

### Issues from screenshot
1. **Login button invisible** — uses `border-white/50 bg-white/10 text-white` on light teal background → low contrast, text barely readable
2. Layout feels basic — empty right side, decorative blobs too subtle, no imagery
3. Feature cards below fold are plain
4. URL is long preview URL

### Changes

**1. `src/pages/portal/PortalLanding.tsx` — full redesign**

**Hero fixes:**
- **Login button**: Solid white background with teal text (mirror Get Started but as outline/ghost variant with strong border) — OR make Get Started solid white + Login as solid darker teal (`bg-[hsl(174,70%,25%)]`) with white text & white border. Both clearly visible.
- **Heading**: Larger (`text-5xl md:text-7xl lg:text-8xl`), tighter tracking, gradient text accent on "Anytime"
- **Add hero visual**: Right-side floating UI mockup card showing a sample appointment/prescription preview (glassmorphism card with mock content) to fill empty space
- **Trust strip**: Below CTAs add small row "Trusted by 10,000+ patients · HIPAA-ready · 24/7 access" with check icons
- **Stronger gradient**: Deeper teal-to-emerald with subtle noise/grain overlay

**Feature cards section:**
- Add section heading "Everything you need, in one place"
- Cards: gradient border-top, larger icons in gradient circles, hover lift + glow shadow, subtle background pattern
- Add a 4th value-prop row OR stats band (10k+ patients, 50k+ prescriptions, 4.9★ rating)

**New sections to add:**
- **"How it works" 3-step strip** (Login → Browse → Order) with numbered circles
- **Testimonial card** — single patient quote with avatar (stock-style)
- **Final CTA band** — gradient background, "Ready to take control of your skin health?" + button

**Footer:** Slightly richer — 2-column layout (contact left, quick links right), brand strip on top

**2. Custom domain note**
The project already has custom domain `https://clinic.quickapp.ai` configured (visible in project URLs). Portal will be accessible at `https://clinic.quickapp.ai/portal`. No code change needed — just inform user.

### Files modified
- `src/pages/portal/PortalLanding.tsx` (full rewrite)

### Technical notes
- Keep mint/teal palette per brand memory
- Plus Jakarta Sans for headings (already in use)
- Framer Motion already imported — extend animations to new sections
- All icons from lucide-react
- No new dependencies

