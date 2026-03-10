import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 md:h-16 flex items-center justify-between border-b bg-card px-3 md:px-4 gap-2 md:gap-4 shrink-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <SidebarTrigger className="shrink-0" />
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients, appointments..."
                  className="pl-9 w-72 bg-muted border-0"
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-9 md:w-9">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                <span className="absolute top-1 right-1 md:top-1.5 md:right-1.5 h-2 w-2 rounded-full bg-destructive" />
              </Button>
              <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display font-semibold text-xs md:text-sm">
                DC
              </div>
            </div>
          </header>
          <main className="flex-1 p-3 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
