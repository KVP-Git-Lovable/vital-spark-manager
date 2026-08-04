import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Navigate } from "react-router-dom";
import { AppointmentsModal } from "@/components/modals/AppointmentsModal";
import { AppointmentDetailModal } from "@/components/modals/AppointmentDetailModal";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { BackToReportBar } from "@/components/reports/BackToReportBar";
import { MicButton } from "@/components/shared/MicButton";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { staffProfile, user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const runPatientSearch = async (raw: string) => {
    const q = raw.trim().replace(/[.?!,]+$/g, "");
    if (!q) return;
    setSearchValue(q);
    const tokens = q.split(/\s+/).filter(Boolean);
    let query = supabase.from("patients").select("id, first_name, last_name").limit(5);
    if (tokens.length === 1) {
      const t = `%${tokens[0]}%`;
      query = query.or(`first_name.ilike.${t},last_name.ilike.${t}`);
    } else {
      query = query
        .ilike("first_name", `%${tokens[0]}%`)
        .ilike("last_name", `%${tokens[tokens.length - 1]}%`);
    }
    const { data, error } = await query;
    if (error) {
      toast.error("Search failed");
      return;
    }
    if (!data || data.length === 0) {
      toast.error(`No patient matched "${q}"`);
      return;
    }
    if (data.length === 1) {
      const p = data[0];
      toast.success(`Opening ${p.first_name} ${p.last_name}`);
      navigate(`/patients/${p.id}`);
    } else {
      toast(`${data.length} matches — refine your search`);
    }
  };

  // Redirect to login if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const initials = staffProfile?.initials || (user?.email?.slice(0, 2).toUpperCase() ?? "U");
  const fullName = staffProfile
    ? `${staffProfile.firstName} ${staffProfile.lastName}`.trim()
    : user?.email || "User";
  const roleName = staffProfile?.roleName;
  const email = staffProfile?.email || user?.email || "";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Modals */}
          <AppointmentsModal />
          <AppointmentDetailModal />

          <header className="h-14 md:h-16 flex items-center justify-between border-b bg-card px-3 md:px-4 gap-2 md:gap-4 shrink-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <SidebarTrigger className="shrink-0" />
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients, appointments..."
                  className="pl-9 pr-10 w-72 bg-muted border-0"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runPatientSearch(searchValue); }}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <MicButton
                    value={searchValue}
                    onChange={setSearchValue}
                    onTranscript={runPatientSearch}
                    mode="replace"
                    title="Speak patient name"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-9 md:w-9">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 h-2 w-2 rounded-full bg-destructive" />
              </Button>

              <ThemeSelector />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display font-semibold text-xs md:text-sm cursor-pointer hover:opacity-90 transition-opacity">
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-3 py-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display font-semibold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{fullName}</p>
                      {roleName && <Badge variant="secondary" className="text-xs mt-0.5">{roleName}</Badge>}
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="h-4 w-4 mr-2" />My Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLogoutOpen(true)} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-3 md:p-6 overflow-auto">
            <BackToReportBar />
            {children}
          </main>
        </div>
      </div>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to the login page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Log Out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
