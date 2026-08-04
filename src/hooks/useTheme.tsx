import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type ThemeType = "amber" | "blue-black" | "light-pink";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "amber",
  setTheme: async () => {},
  loading: true,
});

export const useTheme = () => useContext(ThemeContext);

const themeVariables: Record<ThemeType, Record<string, string>> = {
  "amber": {
    "--sidebar-background": "210 20% 45%",
    "--sidebar-foreground": "210 15% 95%",
    "--sidebar-accent": "210 20% 35%",
    "--sidebar-accent-foreground": "210 15% 95%",
    "--primary": "39 89% 47%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(135deg, #ff9f43 0%, #1f1f1f 100%)",
  },
  "blue-black": {
    "--sidebar-background": "210 30% 12%",
    "--sidebar-foreground": "210 15% 80%",
    "--sidebar-accent": "210 25% 18%",
    "--sidebar-accent-foreground": "210 15% 90%",
    "--primary": "174 62% 38%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(135deg, #174e66 0%, #000000 100%)",
  },
  "light-pink": {
    "--sidebar-background": "210 20% 45%",
    "--sidebar-foreground": "210 15% 95%",
    "--sidebar-accent": "210 20% 35%",
    "--sidebar-accent-foreground": "210 15% 95%",
    "--primary": "323 84% 53%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(135deg, #ff69b4 0%, #9333ea 100%)",
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>("amber");
  const [loading, setLoading] = useState(true);
  const { staffProfile, user } = useAuth();

  useEffect(() => {
    const loadTheme = async () => {
      if (!user || !staffProfile) {
        setThemeState("amber");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("staff")
          .select("theme_preference")
          .eq("id", staffProfile.id)
          .maybeSingle();

        if (error) throw error;

        if (data && data.theme_preference) {
          setThemeState(data.theme_preference as ThemeType);
          applyTheme(data.theme_preference as ThemeType);
        } else {
          setThemeState("amber");
          applyTheme("amber");
        }
      } catch (error) {
        console.error("Failed to load theme:", error);
        setThemeState("amber");
        applyTheme("amber");
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [user, staffProfile]);

  const applyTheme = (themeType: ThemeType) => {
    const variables = themeVariables[themeType];
    Object.entries(variables).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  };

  const setTheme = async (newTheme: ThemeType) => {
    if (!staffProfile) {
      toast.error("User profile not found");
      return;
    }

    try {
      const { error } = await supabase
        .from("staff")
        .update({ theme_preference: newTheme })
        .eq("id", staffProfile.id);

      if (error) throw error;

      setThemeState(newTheme);
      applyTheme(newTheme);
      toast.success(`Theme changed to ${newTheme.replace('-', ' ')}`);
    } catch (error) {
      console.error("Failed to update theme:", error);
      toast.error("Failed to update theme");
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}
