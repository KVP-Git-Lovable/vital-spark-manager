import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Receipt,
  BarChart3,
  Settings,
  ClipboardList,
  Pill,
  Camera,
  CalendarDays,
  Package,
  FileBarChart,
  ShoppingBag,
  Wallet,
  UserCog,
  AlertCircle,
  ClipboardCheck,
  Building2,
  Ruler,
  Tags,
  ChevronDown,
  FileText,
  ListChecks,
  ShieldCheck,
  Megaphone,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import skinClinicLogo from "@/assets/skin-clinic-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, moduleKey: "dashboard" },
  { title: "Patients", url: "/patients", icon: Users, moduleKey: "patients" },
  { title: "Appointments", url: "/appointments", icon: Calendar, moduleKey: "appointments" },
  { title: "Procedures", url: "/procedures", icon: ClipboardList, moduleKey: "procedures" },
  { title: "Photos", url: "/photos", icon: Camera, moduleKey: "photos" },
  { title: "Pharmacy", url: "/pharma", icon: Pill, moduleKey: "pharmacy" },
  { title: "Billing", url: "/billing", icon: Receipt, moduleKey: "billing" },
  { title: "Leave", url: "/leave", icon: CalendarDays, moduleKey: "leave" },
  { title: "Assets", url: "/assets", icon: Package, moduleKey: "assets" },
  { title: "Portal Orders", url: "/orders", icon: ShoppingBag, moduleKey: "portal_orders" },
  { title: "Expenses", url: "/expenses", icon: Wallet, moduleKey: "expenses" },
  { title: "Staff", url: "/staff", icon: UserCog, moduleKey: "staff" },
  { title: "Problem Areas", url: "/problem-areas", icon: AlertCircle, moduleKey: "problem_areas" },
  { title: "Reports", url: "/reports", icon: BarChart3, moduleKey: "reports" },
  { title: "Report Builder", url: "/report-builder", icon: FileBarChart, moduleKey: "report_builder" },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone, moduleKey: "campaigns" },
];

const surveySubItems = [
  { title: "Survey Templates", url: "/survey-templates", icon: FileText },
  { title: "All Surveys", url: "/all-surveys", icon: ListChecks },
];

const masterDataItems = [
  { title: "Service Master", url: "/services", icon: Stethoscope, moduleKey: "services" },
  { title: "Vendor Master", url: "/vendors", icon: Building2, moduleKey: "vendors" },
  { title: "Category Master", url: "/category-master", icon: Tags, moduleKey: "category_master" },
  { title: "User Management", url: "/user-management", icon: ShieldCheck, moduleKey: "user_management" },
];

const settingsItems = [
  { title: "Settings", url: "/settings", icon: Settings, moduleKey: "settings" },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { isAdmin, permissions } = useAuth();

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [currentPath, isMobile, setOpenMobile]);

  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const canView = (moduleKey: string) => {
    if (isAdmin) return true;
    return permissions[moduleKey]?.can_view ?? false;
  };

  const filteredMain = mainItems.filter((i) => canView(i.moduleKey));
  const filteredMaster = masterDataItems.filter((i) => canView(i.moduleKey));
  const showSurveys = canView("surveys");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={skinClinicLogo} alt="The Skin Clinic" className="h-9 w-9 rounded-lg shrink-0 object-contain" />
          {!collapsed && (
            <div>
              <h2 className="font-display text-sm font-bold text-sidebar-accent-foreground">
                The Skin Clinic
              </h2>
              <p className="text-xs text-sidebar-foreground">Clinic Manager</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {showSurveys && (
                <Collapsible
                  defaultOpen={currentPath.startsWith("/survey-templates") || currentPath.startsWith("/all-surveys")}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Surveys"
                        isActive={currentPath.startsWith("/survey-templates") || currentPath.startsWith("/all-surveys")}
                      >
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        {!collapsed && <span>Surveys</span>}
                        {!collapsed && (
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {surveySubItems.map((sub) => (
                          <SidebarMenuSubItem key={sub.url}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive(sub.url)}
                            >
                              <Link to={sub.url}>
                                <sub.icon className="mr-2 h-3.5 w-3.5" />
                                <span>{sub.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredMaster.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Master Data</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMaster.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.filter((i) => canView(i.moduleKey)).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
