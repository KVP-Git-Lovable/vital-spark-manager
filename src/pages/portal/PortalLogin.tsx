import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Phone, Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PortalLogin = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    setLoading(true);
    try {
      // Find patient by phone number (skip OTP for now)
      const cleanInput = phone.replace(/\D/g, "").slice(-10);
      
      const { data: patients, error } = await supabase
        .from("patients")
        .select("id, first_name, last_name, phone")
        .limit(100);

      if (error) {
        toast.error("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Find matching patient by phone
      const patient = patients?.find(p => {
        const cleanStored = p.phone?.replace(/\D/g, "").slice(-10);
        return cleanStored === cleanInput;
      });

      if (!patient) {
        toast.error("Phone number not found. Please contact the clinic.");
        setLoading(false);
        return;
      }

      // Store session in localStorage (simplified - no OTP)
      const session = {
        patientId: patient.id,
        sessionToken: crypto.randomUUID(),
        patientName: `${patient.first_name} ${patient.last_name}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      localStorage.setItem("portal_session", JSON.stringify(session));

      toast.success(`Welcome, ${session.patientName}!`);
      navigate("/portal/dashboard");
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(174,62%,95%)] via-[hsl(210,20%,98%)] to-[hsl(174,40%,92%)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
            <Heart className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            DermaCare Portal
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Access your health records securely
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-card rounded-2xl shadow-xl border p-6 space-y-5">
          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-primary" /> Phone Number
            </Label>
            <Input
              className="mt-2 h-12 text-base"
              placeholder="Enter your registered phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
          </div>

          <Button
            className="w-full h-12 text-base gap-2"
            onClick={handleLogin}
            disabled={loading || !phone}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Access Portal <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Enter your registered phone number to access your health records.
        </p>
      </motion.div>
    </div>
  );
};

export default PortalLogin;
