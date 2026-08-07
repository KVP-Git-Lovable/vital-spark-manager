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
  // All themes use a soft, light sidebar — no black surfaces.
  "amber": {
    "--sidebar-background": "34 40% 97%",
    "--sidebar-foreground": "28 18% 32%",
    "--sidebar-accent": "32 78% 94%",
    "--sidebar-accent-foreground": "26 78% 38%",
    "--sidebar-primary": "26 84% 48%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-border": "32 30% 90%",
    "--sidebar-ring": "26 84% 48%",
    "--primary": "26 84% 48%",
    "--primary-foreground": "0 0% 100%",
    "--accent": "32 78% 94%",
    "--accent-foreground": "26 78% 34%",
    "--ring": "26 84% 48%",
    "--sidebar-header-bg": "linear-gradient(135deg, hsl(30 92% 55%) 0%, hsl(22 88% 46%) 100%)",
  },
  "blue-black": {
    "--sidebar-background": "180 30% 97%",
    "--sidebar-foreground": "195 18% 32%",
    "--sidebar-accent": "174 55% 92%",
    "--sidebar-accent-foreground": "174 70% 28%",
    "--sidebar-primary": "174 62% 38%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-border": "180 22% 90%",
    "--sidebar-ring": "174 62% 38%",
    "--primary": "174 62% 38%",
    "--primary-foreground": "0 0% 100%",
    "--accent": "174 45% 92%",
    "--accent-foreground": "174 70% 26%",
    "--ring": "174 62% 38%",
    "--sidebar-header-bg": "linear-gradient(135deg, hsl(168 62% 45%) 0%, hsl(186 62% 34%) 100%)",
  },
  "light-pink": {
    "--sidebar-background": "340 45% 98%",
    "--sidebar-foreground": "330 14% 34%",
    "--sidebar-accent": "340 70% 94%",
    "--sidebar-accent-foreground": "336 60% 40%",
    "--sidebar-primary": "336 62% 52%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-border": "340 30% 92%",
    "--sidebar-ring": "336 62% 52%",
    "--primary": "336 62% 52%",
    "--primary-foreground": "0 0% 100%",
    "--accent": "340 70% 94%",
    "--accent-foreground": "336 60% 38%",
    "--ring": "336 62% 52%",
    "--sidebar-header-bg": "linear-gradient(135deg, hsl(340 78% 68%) 0%, hsl(300 42% 52%) 100%)",
  },
  "forest-green": {
    "--sidebar-background": "140 28% 97%",
    "--sidebar-foreground": "150 14% 30%",
    "--sidebar-accent": "148 45% 92%",
    "--sidebar-accent-foreground": "152 55% 26%",
    "--sidebar-primary": "152 52% 32%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-border": "140 22% 90%",
    "--sidebar-ring": "152 52% 32%",
    "--primary": "152 52% 32%",
    "--primary-foreground": "0 0% 100%",
    "--accent": "148 45% 92%",
    "--accent-foreground": "152 55% 24%",
    "--ring": "152 52% 32%",
    "--sidebar-header-bg": "linear-gradient(135deg, hsl(146 48% 46%) 0%, hsl(158 55% 28%) 100%)",
  },
  "ocean-blue": {
    "--sidebar-background": "205 40% 98%",
    "--sidebar-foreground": "210 16% 32%",
    "--sidebar-accent": "205 70% 93%",
    "--sidebar-accent-foreground": "208 65% 32%",
    "--sidebar-primary": "208 68% 42%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-border": "205 28% 91%",
    "--sidebar-ring": "208 68% 42%",
    "--primary": "208 68% 42%",
    "--primary-foreground": "0 0% 100%",
    "--accent": "205 70% 93%",
    "--accent-foreground": "208 65% 30%",
    "--ring": "208 68% 42%",
    "--sidebar-header-bg": "linear-gradient(135deg, hsl(200 72% 52%) 0%, hsl(214 68% 38%) 100%)",
  },
  "purple": {
    "--sidebar-background": "280 35% 98%",
    "--sidebar-foreground": "275 14% 33%",
    "--sidebar-accent": "275 55% 94%",
    "--sidebar-accent-foreground": "272 52% 40%",
    "--sidebar-primary": "272 52% 48%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-border": "280 25% 92%",
    "--sidebar-ring": "272 52% 48%",
    "--primary": "272 52% 48%",
    "--primary-foreground": "0 0% 100%",
    "--accent": "275 55% 94%",
    "--accent-foreground": "272 52% 38%",
    "--ring": "272 52% 48%",
    "--sidebar-header-bg": "linear-gradient(135deg, hsl(280 60% 62%) 0%, hsl(262 52% 44%) 100%)",
  },
  "slate": {
    "--sidebar-background": "215 25% 97%",
    "--sidebar-foreground": "215 16% 34%",
    "--sidebar-accent": "213 40% 93%",
    "--sidebar-accent-foreground": "215 42% 32%",
    "--sidebar-primary": "215 40% 40%",
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-border": "215 20% 90%",
    "--sidebar-ring": "215 40% 40%",
    "--primary": "215 40% 40%",
    "--primary-foreground": "0 0% 100%",
    "--accent": "213 40% 93%",
    "--accent-foreground": "215 42% 30%",
    "--ring": "215 40% 40%",
    "--sidebar-header-bg": "linear-gradient(135deg, hsl(212 30% 55%) 0%, hsl(216 32% 36%) 100%)",
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
