import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  patientId: string | null;
  patientName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  patientId: null,
  patientName: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPatientProfile = async (u: User) => {
    // Find patient linked to this auth user
    const { data } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("auth_user_id", u.id)
      .maybeSingle();

    if (data) {
      setPatientId(data.id);
      setPatientName(`${data.first_name} ${data.last_name}`);
      return;
    }

    // Try to link by email match
    const email = u.email;
    if (email) {
      const { data: byEmail } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("email", email)
        .is("auth_user_id", null)
        .maybeSingle();

      if (byEmail) {
        await supabase
          .from("patients")
          .update({ auth_user_id: u.id })
          .eq("id", byEmail.id);
        setPatientId(byEmail.id);
        setPatientName(`${byEmail.first_name} ${byEmail.last_name}`);
        return;
      }
    }

    // Create new patient record
    const meta = u.user_metadata || {};
    const firstName = meta.first_name || email?.split("@")[0] || "User";
    const lastName = meta.last_name || "";
    const { data: newPatient } = await supabase
      .from("patients")
      .insert({
        first_name: firstName,
        last_name: lastName || ".",
        email: email,
        phone: meta.phone || null,
        auth_user_id: u.id,
      })
      .select("id, first_name, last_name")
      .single();

    if (newPatient) {
      setPatientId(newPatient.id);
      setPatientName(`${newPatient.first_name} ${newPatient.last_name}`);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          await loadPatientProfile(sess.user);
        } else {
          setPatientId(null);
          setPatientName(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadPatientProfile(s.user).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setPatientId(null);
    setPatientName(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, patientId, patientName, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
