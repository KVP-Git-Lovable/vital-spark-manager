import { useNavigate } from "react-router-dom";
import { Heart, Calendar, Pill, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

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
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(174,62%,40%)] via-[hsl(174,50%,50%)] to-[hsl(150,40%,60%)] text-white">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/3 h-32 w-32 rounded-full bg-white/5" />

        {/* Nav */}
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <Heart className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              DermaCare
            </span>
          </div>
          <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20 backdrop-blur" onClick={goLogin}>
            Access My Portal
          </Button>
        </header>

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-12 md:pt-20 md:pb-28">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Your Skin. Your Records.{" "}
              <span className="text-white/80">Anytime.</span>
            </h1>
            <p className="mt-5 text-lg text-white/80 md:text-xl">
              Access appointments, prescriptions &amp; treatments in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" className="bg-white text-[hsl(174,62%,35%)] hover:bg-white/90 font-semibold" onClick={goLogin}>
                Get Started
              </Button>
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 gap-2" onClick={goLogin}>
                Login <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="mx-auto -mt-12 max-w-5xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: i * 0.12 }}
              onClick={goLogin}
              className="group cursor-pointer rounded-2xl border bg-card p-7 shadow-sm transition-shadow duration-300 hover:shadow-xl"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(174,62%,92%)] text-[hsl(174,62%,35%)] transition-colors group-hover:bg-[hsl(174,62%,35%)] group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {f.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t bg-muted/40 py-8 text-center text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">The Skin Clinic</p>
        <p className="mt-1">📞 +91 98765 43210 &nbsp;·&nbsp; ✉️ care@theskinclinic.in</p>
        <p className="mt-2">© {new Date().getFullYear()} The Skin Clinic. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PortalLanding;
