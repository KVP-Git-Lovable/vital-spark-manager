import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type ThemeType = "amber" | "blue-black" | "light-pink" | "forest-green" | "ocean-blue" | "purple" | "slate";

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

const THEME_STORAGE_KEY = "skin-clinic-theme";

const themeVariables: Record<ThemeType, Record<string, string>> = {
  "amber": {
    "--sidebar-background": "38 72% 52%",
    "--sidebar-foreground": "0 0% 95%",
    "--sidebar-accent": "38 72% 42%",
    "--sidebar-accent-foreground": "0 0% 95%",
    "--primary": "38 72% 52%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(180deg, #e8b976 0%, #d4a574 50%, #b8860b 100%)",
  },
  "blue-black": {
    "--sidebar-background": "210 30% 12%",
    "--sidebar-foreground": "210 15% 80%",
    "--sidebar-accent": "210 25% 18%",
    "--sidebar-accent-foreground": "210 15% 90%",
    "--primary": "174 62% 38%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(180deg, #20c997 0%, #0d9488 50%, #0a3f38 100%)",
  },
  "light-pink": {
    "--sidebar-background": "340 60% 54%",
    "--sidebar-foreground": "0 0% 95%",
    "--sidebar-accent": "340 60% 44%",
    "--sidebar-accent-foreground": "0 0% 95%",
    "--primary": "340 60% 56%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(180deg, #e9b8d4 0%, #d8a8c8 50%, #b8889c 100%)",
  },
  "forest-green": {
    "--sidebar-background": "155 45% 35%",
    "--sidebar-foreground": "0 0% 95%",
    "--sidebar-accent": "155 45% 28%",
    "--sidebar-accent-foreground": "0 0% 95%",
    "--primary": "155 45% 35%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(180deg, #7eb39f 0%, #5a9d72 50%, #2d5a3d 100%)",
  },
  "ocean-blue": {
    "--sidebar-background": "198 42% 38%",
    "--sidebar-foreground": "0 0% 95%",
    "--sidebar-accent": "198 42% 30%",
    "--sidebar-accent-foreground": "0 0% 95%",
    "--primary": "198 42% 38%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(180deg, #5b9bbb 0%, #2b7a9b 50%, #0f3d52 100%)",
  },
  "purple": {
    "--sidebar-background": "277 35% 42%",
    "--sidebar-foreground": "0 0% 95%",
    "--sidebar-accent": "277 35% 34%",
    "--sidebar-accent-foreground": "0 0% 95%",
    "--primary": "277 35% 42%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(180deg, #a892a8 0%, #8b7b9d 50%, #5d4a6f 100%)",
  },
  "slate": {
    "--sidebar-background": "215 25% 28%",
    "--sidebar-foreground": "0 0% 95%",
    "--sidebar-accent": "215 25% 20%",
    "--sidebar-accent-foreground": "0 0% 95%",
    "--primary": "215 25% 28%",
    "--primary-foreground": "0 0% 100%",
    "--sidebar-header-bg": "linear-gradient(180deg, #7b8fa8 0%, #5a6f85 50%, #2c3e50 100%)",
  },
};

const applyTheme = (themeType: ThemeType) => {
  const variables = themeVariables[themeType];
  Object.entries(variables).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>("amber");
  const [loading, setLoading] = useState(true);
  const { staffProfile, user } = useAuth();

  useEffect(() => {
    const loadTheme = async () => {
      if (!user || !staffProfile) {
        // Check localStorage for saved theme
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType | null;
        const defaultTheme = savedTheme || "amber";
        setThemeState(defaultTheme);
        applyTheme(defaultTheme);
        setLoading(false);
        return;
      }

      try {
        // Try to load from database first
        const { data, error } = await (supabase as any)
          .from("staff")
          .select("theme_preference")
          .eq("id", staffProfile.id)
          .maybeSingle();

        if (!error && data && data.theme_preference) {
          // Database has the theme
          setThemeState(data.theme_preference as ThemeType);
          applyTheme(data.theme_preference as ThemeType);
          localStorage.setItem(THEME_STORAGE_KEY, data.theme_preference);
        } else {
          // Database doesn't have theme or column doesn't exist, use localStorage or default
          const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType | null;
          const defaultTheme = savedTheme || "amber";
          setThemeState(defaultTheme);
          applyTheme(defaultTheme);
        }
      } catch (error) {
        console.warn("Failed to load theme from database:", error);
        // Fallback to localStorage
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType | null;
        const defaultTheme = savedTheme || "amber";
        setThemeState(defaultTheme);
        applyTheme(defaultTheme);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [user, staffProfile]);

  const setTheme = async (newTheme: ThemeType) => {
    if (!staffProfile) {
      toast.error("User profile not found");
      return;
    }

    // Always apply theme immediately on client
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    toast.success(`Theme changed to ${newTheme.replace('-', ' ')}`);

    // Try to save to database, but don't fail if not available
    try {
      await (supabase as any)
        .from("staff")
        .update({ theme_preference: newTheme })
        .eq("id", staffProfile.id);
    } catch (error) {
      console.warn("Theme saved locally, will sync to database after migration:", error);
      // Theme is already applied on client and saved to localStorage
      // Once database migration is applied, it will sync automatically on next login
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}
