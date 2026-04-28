## Customer Portal Branding Updates

Replace "DermaCare" with "The Skin Clinic" and swap the heart icon for the clinic logo across the patient portal.

### Changes

**1. `src/pages/portal/Portal.tsx` (header)**
- Remove `Heart` from `lucide-react` imports.
- Import the existing logo: `import clinicLogo from "@/assets/skin-clinic-logo.png";`
- Replace `<Heart className="h-6 w-6" />` with `<img src={clinicLogo} alt="The Skin Clinic" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" />` (white background chip so the green/black logo reads on the teal gradient header).
- Change header label `DermaCare` → `The Skin Clinic`.

**2. `src/components/portal/PortalBot.tsx` (AI assistant)**
- Header title `DermaCare AI` → `The Skin Clinic AI`.
- Welcome message: `I'm your DermaCare AI assistant` → `I'm your Skin Clinic AI assistant`.
- Sparkles icon in the bot avatar is left as-is (it's the AI bot identity, not the clinic logo).

### Out of scope
- `src/pages/Website.tsx` mentions DermaCare but is the marketing/admin site, not the customer portal — left untouched.
- PortalLogin already uses the clinic logo and "The Skin Clinic" branding — no change needed.