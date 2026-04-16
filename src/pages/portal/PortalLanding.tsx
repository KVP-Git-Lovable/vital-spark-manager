import { useNavigate } from "react-router-dom";
import { Calendar, Pill, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import clinicLogo from "@/assets/skin-clinic-logo.png";

const features = [
  {
    icon: Calendar,
    title: "Book & Track Appointments",
    description: "Schedule visits and track upcoming appointments easily",
  },
  {
    icon: Pill,
    title: "View Prescriptions",
    description: "Access your medicines and treatment history anytime",
  },
  {
    icon: ShoppingBag,
    title: "Order Medicines",
    description: "Reorder prescribed medicines delivered to your door",
  },
];

const PortalLanding = () => {
  const navigate = useNavigate();
  const goLogin = () => navigate("/portal/login");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Announcement Bar ── */}
      <div className="bg-[hsl(174,62%,30%)] text-white text-center text-xs font-medium py-2 tracking-wide">
        Welcome to The Skin Clinic Patient Portal
      </div>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(174,62%,40%)] via-[hsl(174,50%,50%)] to-[hsl(150,40%,60%)] text-white">
        {/* Decorative shapes */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute bottom-1/4 right-[10%] h-24 w-24 rounded-full border-2 border-white/20" />
        <div className="pointer-events-none absolute top-[60%] right-[35%] h-16 w-16 rounded-full bg-white/[0.07]" />

        {/* Nav */}
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <img src={clinicLogo} alt="The Skin Clinic" className="h-10 w-10 rounded-xl object-contain bg-white/20 backdrop-blur p-1" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              The Skin Clinic
            </span>
          </div>
          <Button variant="outline" className="border-white/50 bg-white/10 text-white hover:bg-white/20 backdrop-blur font-medium" onClick={goLogin}>
            Access My Portal
          </Button>
        </header>

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-14 md:pt-24 md:pb-32">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-7xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Your Skin. Your Records.{" "}
              <span className="text-white/80">Anytime.</span>
            </h1>
            <p className="mt-6 text-lg text-white/80 md:text-xl leading-relaxed">
              Access appointments, prescriptions &amp; treatments in one place.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button size="lg" className="bg-white text-[hsl(174,62%,35%)] hover:bg-white/90 font-semibold px-8 h-12 text-base" onClick={goLogin}>
                Get Started
              </Button>
              <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 gap-2 px-8 h-12 text-base font-semibold" onClick={goLogin}>
                Login <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-20">
        <div className="grid gap-8 sm:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: i * 0.12 }}
              onClick={goLogin}
              className="group cursor-pointer rounded-2xl border border-t-4 border-t-[hsl(174,62%,40%)] bg-card p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(174,62%,92%)] text-[hsl(174,62%,35%)] transition-colors group-hover:bg-[hsl(174,62%,35%)] group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              <div className="mt-4 flex items-center text-sm font-medium text-[hsl(174,62%,35%)] opacity-0 transition-opacity group-hover:opacity-100">
                Learn more <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t bg-muted/40 py-10 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground text-base">The Skin Clinic</p>
        <p className="mt-2">📞 +91 98765 43210 &nbsp;·&nbsp; ✉️ care@theskinclinic.in</p>
        <p className="mt-3 text-xs">© {new Date().getFullYear()} The Skin Clinic. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PortalLanding;
