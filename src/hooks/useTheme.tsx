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
    "--sidebar-background": "30 60% 45%",
    "--sidebar-foreground": "210 15% 95%",
    "--sidebar-accent": "30 60% 35%",
    "--sidebar-accent-foreground": "210 15% 95%",
    "--primary": "39 89% 47%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(135deg, #ff9f43 0%, #d97706 100%)",
  },
  "blue-black": {
    "--sidebar-background": "210 30% 12%",
    "--sidebar-foreground": "210 15% 80%",
    "--sidebar-accent": "210 25% 18%",
    "--sidebar-accent-foreground": "210 15% 90%",
    "--primary": "174 62% 38%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(135deg, #0d9488 0%, #000000 100%)",
  },
  "light-pink": {
    "--sidebar-background": "280 50% 50%",
    "--sidebar-foreground": "210 15% 95%",
    "--sidebar-accent": "280 50% 40%",
    "--sidebar-accent-foreground": "210 15% 95%",
    "--primary": "330 81% 60%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(135deg, #ec4899 0%, #a855f7 100%)",
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
        applyTheme("amber");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("staff")
          .select("theme_preference")
          .eq("id", staffProfile.id)
          .maybeSingle();

        // Silently handle column doesn't exist error during migration period
        if (error && error.message.includes("column")) {
          console.warn("theme_preference column not yet available, using default theme");
          setThemeState("amber");
          applyTheme("amber");
        } else if (error) {
          throw error;
        } else if (data && data.theme_preference) {
          setThemeState(data.theme_preference as ThemeType);
          applyTheme(data.theme_preference as ThemeType);
        } else {
          setThemeState("amber");
          applyTheme("amber");
        }
      } catch (error) {
        console.warn("Failed to load theme (will use default):", error);
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
      // Always apply theme immediately on client
      setThemeState(newTheme);
      applyTheme(newTheme);
      toast.success(`Theme changed to ${newTheme.replace('-', ' ')}`);

      // Try to save to database, but don't fail if column doesn't exist yet
      const { error } = await supabase
        .from("staff")
        .update({ theme_preference: newTheme })
        .eq("id", staffProfile.id);

      // Silently handle column doesn't exist error during migration period
      if (error && !error.message.includes("column")) {
        console.warn("Theme save failed (will be available after migration):", error);
      }
    } catch (error) {
      console.warn("Failed to save theme preference:", error);
      // Theme is already applied on client, so don't show error
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}
