import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Phone, KeyRound, Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PortalLogin = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !otp.trim()) {
      toast.error("Please enter your phone number and OTP");
      return;
    }

    setLoading(true);
    try {
      // Find valid OTP token
      const { data: token, error } = await supabase
        .from("patient_portal_tokens")
        .select("*, patients(first_name, last_name, phone)")
        .eq("otp_code", otp.trim())
        .eq("is_used", false)
        .gte("expires_at", new Date().toISOString())
        .limit(1)
        .single();

      if (error || !token) {
        toast.error("Invalid or expired OTP. Please contact the clinic.");
        setLoading(false);
        return;
      }

      // Verify phone matches
      const patientPhone = (token as any).patients?.phone;
      const cleanInput = phone.replace(/\D/g, "").slice(-10);
      const cleanStored = patientPhone?.replace(/\D/g, "").slice(-10);

      if (cleanInput !== cleanStored) {
        toast.error("Phone number doesn't match our records");
        setLoading(false);
        return;
      }

      // Mark OTP as used
      await supabase
        .from("patient_portal_tokens")
        .update({ is_used: true })
        .eq("id", token.id);

      // Store session in localStorage
      const session = {
        patientId: token.patient_id,
        sessionToken: token.session_token,
        patientName: `${(token as any).patients?.first_name} ${(token as any).patients?.last_name}`,
        expiresAt: token.expires_at,
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

          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-primary" /> Access Code (OTP)
            </Label>
            <Input
              className="mt-2 h-12 text-base text-center tracking-[0.5em] font-mono"
              placeholder="• • • • • •"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter the 6-digit code shared by your clinic
            </p>
          </div>

          <Button
            className="w-full h-12 text-base gap-2"
            onClick={handleLogin}
            disabled={loading || !phone || otp.length < 6}
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
          Don't have an access code? Contact your clinic to get one.
        </p>
      </motion.div>
    </div>
  );
};

export default PortalLogin;
