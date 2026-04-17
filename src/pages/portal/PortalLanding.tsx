import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Pill,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Star,
  Sparkles,
  LogIn,
  Search,
  PackageCheck,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import clinicLogo from "@/assets/skin-clinic-logo.png";

const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

const features = [
  {
    icon: Calendar,
    title: "Book & Track Appointments",
    description: "Schedule visits, get reminders, and track upcoming appointments seamlessly.",
    accent: "from-[hsl(174,62%,40%)] to-[hsl(160,55%,45%)]",
  },
  {
    icon: Pill,
    title: "View Prescriptions",
    description: "Access your medicines and complete treatment history anytime, anywhere.",
    accent: "from-[hsl(174,62%,40%)] to-[hsl(190,60%,45%)]",
  },
  {
    icon: ShoppingBag,
    title: "Order Medicines",
    description: "Reorder prescribed medicines with home delivery to your doorstep.",
    accent: "from-[hsl(160,55%,45%)] to-[hsl(174,62%,40%)]",
  },
];

const stats = [
  { value: "24/7", label: "Portal Access" },
  { value: "Secure", label: "HIPAA-ready" },
  { value: "Instant", label: "Reorders" },
  { value: "All-in-One", label: "Your Records" },
];

const steps = [
  { icon: LogIn, title: "Login Securely", desc: "Sign in with your phone or email." },
  { icon: Search, title: "Browse Records", desc: "Appointments, prescriptions, photos." },
  { icon: PackageCheck, title: "Order & Track", desc: "Reorder medicines, track delivery." },
];

const PortalLanding = () => {
  const navigate = useNavigate();
  const goLogin = () => navigate("/portal/login");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Announcement Bar ── */}
      <div className="bg-[hsl(174,70%,22%)] text-white text-center text-xs font-medium py-2 tracking-wide flex items-center justify-center gap-2">
        <Sparkles className="h-3.5 w-3.5" />
        Welcome to The Skin Clinic Patient Portal — Your skin journey, simplified.
      </div>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(174,70%,28%)] via-[hsl(170,60%,38%)] to-[hsl(155,50%,52%)] text-white">
        {/* Grain overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        {/* Decorative shapes */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[hsl(160,80%,60%)]/20 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-white/5" />

        {/* Nav */}
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <img
              src={clinicLogo}
              alt="The Skin Clinic"
              className="h-11 w-11 rounded-xl object-contain bg-white/95 backdrop-blur p-1.5 shadow-lg"
            />
            <span className="text-lg font-bold tracking-tight" style={heading}>
              The Skin Clinic
            </span>
          </div>
          <Button
            onClick={goLogin}
            className="bg-white text-[hsl(174,70%,28%)] hover:bg-white/90 font-semibold shadow-lg shadow-black/10 h-10 px-5"
          >
            Access My Portal <ArrowRight className="h-4 w-4" />
          </Button>
        </header>

        {/* Content */}
        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-12 gap-12 items-center px-6 pb-24 pt-10 md:pt-16 lg:pt-20 lg:pb-32">
          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur border border-white/25 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-6">
              <span className="h-2 w-2 rounded-full bg-[hsl(140,80%,65%)] animate-pulse" />
              The Skin Clinic Patient Portal
            </div>
            <h1
              className="text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl lg:text-8xl"
              style={heading}
            >
              Your Skin.<br />
              Your Records.<br />
              <span className="bg-gradient-to-r from-white via-[hsl(140,90%,85%)] to-[hsl(160,80%,75%)] bg-clip-text text-transparent">
                Anytime.
              </span>
            </h1>
            <p className="mt-7 text-lg text-white/85 md:text-xl leading-relaxed max-w-xl">
              Manage appointments, prescriptions, and treatments — all in one premium, secure portal designed for you.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                size="lg"
                onClick={goLogin}
                className="bg-white text-[hsl(174,70%,28%)] hover:bg-white/90 font-bold px-8 h-14 text-base shadow-xl shadow-black/20 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
              >
                Get Started Free
              </Button>
              <Button
                size="lg"
                onClick={goLogin}
                className="bg-[hsl(174,80%,18%)] text-white hover:bg-[hsl(174,80%,14%)] border-2 border-white/40 font-bold px-8 h-14 text-base gap-2 shadow-xl shadow-black/20 hover:-translate-y-0.5 transition-all"
              >
                Login <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Trust strip */}
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/85">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[hsl(140,80%,75%)]" />
                <span>Secure & private</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[hsl(140,80%,75%)]" />
                <span>24/7 access</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[hsl(140,80%,75%)]" />
                <span>All your records, one place</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Floating UI mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="hidden lg:block lg:col-span-5 relative"
          >
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-8 bg-gradient-to-br from-white/20 via-white/5 to-transparent blur-2xl rounded-[3rem]" />

              {/* Main card */}
              <div className="relative rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl shadow-black/30 p-6 border border-white/40 text-foreground">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Patient Portal</p>
                    <p className="font-bold text-base" style={heading}>Your dashboard preview</p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[hsl(174,62%,40%)] to-[hsl(160,55%,45%)] flex items-center justify-center text-white shadow-md">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>

                {/* Next appointment placeholder */}
                <div className="rounded-2xl bg-gradient-to-br from-[hsl(174,62%,95%)] to-[hsl(160,55%,93%)] p-4 border border-[hsl(174,62%,85%)]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(174,70%,28%)] uppercase tracking-wider mb-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Your Next Appointment
                  </div>
                  <p className="font-bold text-foreground" style={heading}>Login to view</p>
                  <p className="text-sm text-muted-foreground mt-0.5">See upcoming visits & reminders</p>
                </div>

                {/* Prescription placeholder */}
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Active Prescriptions</p>
                  {[0, 1].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[hsl(174,62%,40%)] to-[hsl(160,55%,45%)] flex items-center justify-center">
                        <Pill className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">Login to view</p>
                        <p className="text-xs text-muted-foreground truncate">Your medicines & dosage</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mini info tile */}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-[hsl(174,70%,28%)] to-[hsl(160,55%,40%)] p-3 text-white">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">Your Skin Journey</p>
                    <p className="text-base font-bold" style={heading}>Track progress over time</p>
                  </div>
                  <Sparkles className="h-6 w-6 opacity-90" />
                </div>
              </div>

              {/* Floating chip */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="absolute -left-6 top-20 bg-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2.5 border border-white/60"
              >
                <div className="h-9 w-9 rounded-full bg-[hsl(140,70%,90%)] flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-[hsl(140,70%,40%)]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Secure & Private</p>
                  <p className="text-[10px] text-muted-foreground">Your data stays yours</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute -right-4 -bottom-4 bg-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2.5 border border-white/60"
              >
                <div className="h-9 w-9 rounded-full bg-[hsl(174,62%,92%)] flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[hsl(174,70%,28%)]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">24/7 Access</p>
                  <p className="text-[10px] text-muted-foreground">Anytime, anywhere</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Stats band */}
        <div className="relative z-10 border-t border-white/15 bg-black/10 backdrop-blur">
          <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 px-6 py-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center md:border-r border-white/15 last:border-r-0 py-2">
                <div className="text-2xl md:text-3xl font-extrabold" style={heading}>{s.value}</div>
                <div className="text-xs uppercase tracking-wider text-white/75 font-medium mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <p className="text-xs uppercase tracking-widest font-bold text-[hsl(174,70%,28%)] mb-3">Features</p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground" style={heading}>
            Everything you need, in one place
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            A premium experience built for modern skincare patients.
          </p>
        </motion.div>

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              onClick={goLogin}
              className="group cursor-pointer relative rounded-3xl bg-card p-8 shadow-lg shadow-[hsl(174,30%,80%)]/20 border border-border/60 transition-all duration-300 hover:shadow-2xl hover:shadow-[hsl(174,62%,40%)]/20 hover:-translate-y-2 overflow-hidden"
            >
              {/* Gradient top bar */}
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${f.accent}`} />
              {/* Subtle bg blob */}
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[hsl(174,62%,95%)] opacity-0 group-hover:opacity-100 transition-opacity blur-2xl" />

              <div className="relative">
                <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${f.accent} text-white shadow-lg shadow-[hsl(174,62%,40%)]/30 group-hover:scale-110 transition-transform`}>
                  <f.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground" style={heading}>
                  {f.title}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                <div className="mt-5 flex items-center text-sm font-semibold text-[hsl(174,70%,28%)] gap-1.5 group-hover:gap-3 transition-all">
                  Learn more <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-gradient-to-b from-[hsl(174,40%,97%)] to-background py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs uppercase tracking-widest font-bold text-[hsl(174,70%,28%)] mb-3">How it works</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground" style={heading}>
              Get started in 3 simple steps
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-[hsl(174,62%,60%)] to-transparent" />

            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center"
              >
                <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl shadow-[hsl(174,62%,40%)]/15 border border-[hsl(174,62%,85%)]">
                  <s.icon className="h-8 w-8 text-[hsl(174,70%,28%)]" />
                  <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-gradient-to-br from-[hsl(174,70%,28%)] to-[hsl(160,55%,40%)] text-white text-xs font-bold flex items-center justify-center shadow-lg">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground" style={heading}>{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(174,70%,22%)] via-[hsl(170,60%,32%)] to-[hsl(155,55%,40%)] p-12 md:p-16 text-center text-white shadow-2xl"
        >
          {/* Grain */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
          <div className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-[hsl(140,70%,60%)]/20 blur-3xl" />

          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight" style={heading}>
              Ready to take control of your skin health?
            </h2>
            <p className="mt-5 text-white/85 text-lg max-w-2xl mx-auto">
              Manage your skincare journey with The Skin Clinic Portal — appointments, prescriptions, and orders in one place.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                onClick={goLogin}
                className="bg-white text-[hsl(174,70%,28%)] hover:bg-white/90 font-bold px-8 h-14 text-base shadow-xl"
              >
                Get Started Free
              </Button>
              <Button
                size="lg"
                onClick={goLogin}
                className="bg-[hsl(174,80%,15%)] text-white hover:bg-[hsl(174,80%,12%)] border-2 border-white/40 font-bold px-8 h-14 text-base gap-2"
              >
                Login <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t bg-muted/40">
        <div className="mx-auto max-w-7xl px-6 py-12 grid gap-10 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={clinicLogo} alt="The Skin Clinic" className="h-10 w-10 rounded-xl object-contain bg-white p-1 shadow-sm" />
              <span className="text-base font-bold text-foreground" style={heading}>The Skin Clinic</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Premium dermatology and skincare services with a modern patient experience.
            </p>
          </div>
          <div className="md:text-right space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 md:justify-end">
              <Phone className="h-4 w-4 text-[hsl(174,70%,28%)]" /> +91 98765 43210
            </div>
            <div className="flex items-center gap-2 md:justify-end">
              <Mail className="h-4 w-4 text-[hsl(174,70%,28%)]" /> care@theskinclinic.in
            </div>
            <div className="flex items-center gap-2 md:justify-end">
              <MapPin className="h-4 w-4 text-[hsl(174,70%,28%)]" /> Hyderabad, India
            </div>
          </div>
        </div>
        <div className="border-t py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} The Skin Clinic. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default PortalLanding;
