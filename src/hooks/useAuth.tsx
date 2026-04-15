import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

interface StaffProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  roleName: string | null;
  roleId: string | null;
  initials: string;
}

type PermMap = Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  patientId: string | null;
  patientName: string | null;
  staffProfile: StaffProfile | null;
  permissions: PermMap;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  patientId: null,
  patientName: null,
  staffProfile: null,
  permissions: {},
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function getInitials(first: string, last: string, email?: string | null): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "U";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [permissions, setPermissions] = useState<PermMap>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadPatientProfile = async (u: User) => {
    const { data, error } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("auth_user_id", u.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      setPatientId(data.id);
      setPatientName(`${data.first_name} ${data.last_name}`);
      return;
    }

    const email = u.email;
    if (email) {
      const { data: byEmail } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("email", email)
        .is("auth_user_id", null)
        .maybeSingle();

      if (byEmail) {
        const { error: updateError } = await supabase
          .from("patients")
          .update({ auth_user_id: u.id })
          .eq("id", byEmail.id);
        if (updateError) throw updateError;
        setPatientId(byEmail.id);
        setPatientName(`${byEmail.first_name} ${byEmail.last_name}`);
        return;
      }
    }

    // Don't auto-create patient for staff users
  };

  const loadStaffProfile = async (u: User) => {
    const { data: staffData } = await supabase
      .from("staff")
      .select("id, first_name, last_name, email, phone, role_id, user_roles_config(id, name)")
      .eq("auth_user_id", u.id)
      .maybeSingle();

    if (!staffData) {
      setStaffProfile(null);
      setPermissions({});
      setIsAdmin(false);
      return;
    }

    const role = staffData.user_roles_config as any;
    const roleName = role?.name || null;
    const profile: StaffProfile = {
      id: staffData.id,
      firstName: staffData.first_name,
      lastName: staffData.last_name,
      email: staffData.email,
      phone: staffData.phone,
      roleName,
      roleId: staffData.role_id,
      initials: getInitials(staffData.first_name, staffData.last_name, staffData.email),
    };
    setStaffProfile(profile);

    const admin = roleName?.toLowerCase() === "admin";
    setIsAdmin(admin);

    if (admin) {
      // Admin has full access
      setPermissions({});
      return;
    }

    if (staffData.role_id) {
      const { data: perms } = await supabase
        .from("role_module_permissions")
        .select("module_key, can_view, can_create, can_edit, can_delete")
        .eq("role_id", staffData.role_id);

      if (perms) {
        const map: PermMap = {};
        perms.forEach((p: any) => {
          map[p.module_key] = { can_view: p.can_view, can_create: p.can_create ?? false, can_edit: p.can_edit, can_delete: p.can_delete ?? false };
        });
        setPermissions(map);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const clearAll = () => {
      if (!isMounted) return;
      setPatientId(null);
      setPatientName(null);
      setStaffProfile(null);
      setPermissions({});
      setIsAdmin(false);
    };

    const syncSessionState = async (sess: Session | null) => {
      if (!isMounted) return;

      setSession(sess);
      setUser(sess?.user ?? null);

      if (!sess?.user) {
        clearAll();
        setLoading(false);
        return;
      }

      try {
        await Promise.all([
          loadPatientProfile(sess.user).catch(console.error),
          loadStaffProfile(sess.user).catch(console.error),
        ]);
      } catch (error) {
        console.error("Failed to load profiles:", error);
        clearAll();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      window.setTimeout(() => {
        void syncSessionState(sess);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      void syncSessionState(s);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setPatientId(null);
    setPatientName(null);
    setStaffProfile(null);
    setPermissions({});
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, patientId, patientName, staffProfile, permissions, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
