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
  Tags,
  ChevronDown,
  FileText,
  ListChecks,
  ShieldCheck,
  SlidersHorizontal,
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
  SidebarTrigger,
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
  { title: "Assets", url: "/assets", icon: Package, moduleKey: "assets" },
  { title: "Portal Orders", url: "/orders", icon: ShoppingBag, moduleKey: "portal_orders" },
  { title: "Expenses", url: "/expenses", icon: Wallet, moduleKey: "expenses" },
  { title: "Reports", url: "/reports", icon: BarChart3, moduleKey: "reports" },
  { title: "Report Builder", url: "/report-builder", icon: FileBarChart, moduleKey: "report_builder" },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone, moduleKey: "campaigns" },
];

const employeesSubItems = [
  { title: "Staff", url: "/staff", icon: UserCog },
  { title: "Leave", url: "/leave", icon: CalendarDays },
];

const surveySubItems = [
  { title: "Survey Templates", url: "/survey-templates", icon: FileText },
  { title: "All Surveys", url: "/all-surveys", icon: ListChecks },
];

const masterDataItems = [
  { title: "Service Master", url: "/services", icon: Stethoscope, moduleKey: "services" },
  { title: "Vendor Master", url: "/vendors", icon: Building2, moduleKey: "vendors" },
  { title: "Category Master", url: "/category-master", icon: Tags, moduleKey: "category_master" },
  { title: "Problem Areas", url: "/problem-areas", icon: AlertCircle, moduleKey: "problem_areas" },
];

const settingsItems = [
  { title: "Settings", url: "/settings", icon: Settings, moduleKey: "settings" },
];

const adminSubItems = [
  { title: "Validation Rules", url: "/validation-rules", icon: ShieldCheck },
  { title: "Custom Fields", url: "/custom-fields", icon: SlidersHorizontal },
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
    // Allow viewing if explicitly allowed OR if no permissions are set (new users)
    return permissions[moduleKey]?.can_view ?? (Object.keys(permissions).length === 0);
  };

  const filteredMain = mainItems.filter((i) => canView(i.moduleKey));
  const filteredMaster = masterDataItems.filter((i) => canView(i.moduleKey));
  const showSurveys = canView("surveys");
  const showEmployees = canView("staff") || canView("leave");

  const employeesPaths = ["/staff", "/leave"];
  const adminPaths = ["/admin", ...adminSubItems.map((i) => i.url)];
  const showAdmin = canView("settings");
  const masterPaths = [...masterDataItems.map((i) => i.url), ...adminPaths];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 theme-header">
        <div className={collapsed ? "flex items-center justify-center" : "flex items-center gap-2"}>
          {!collapsed && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/95 shadow-sm ring-1 ring-black/5">
              <img src={skinClinicLogo} alt="The Skin Clinic" className="h-7 w-7 object-contain" />
            </span>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-sm font-bold leading-tight drop-shadow-sm truncate">
                The Skin Clinic
              </h2>
              <p className="text-xs opacity-90 leading-tight">Clinic Manager</p>
            </div>
          )}
          <SidebarTrigger
            className="h-8 w-8 shrink-0 hover:bg-white/20"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {(
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
                  )}
                </SidebarMenuItem>
              ))}

              {showEmployees && (
                <Collapsible
                  defaultOpen={employeesPaths.some((p) => currentPath.startsWith(p))}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Employees"
                        isActive={employeesPaths.some((p) => currentPath.startsWith(p))}
                      >
                        <UserCog className="mr-2 h-4 w-4" />
                        {!collapsed && <span>Employees</span>}
                        {!collapsed && (
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {employeesSubItems
                          .filter((sub) => canView(sub.url === "/staff" ? "staff" : "leave"))
                          .map((sub) => (
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

              {canView("user_management") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/user-management")}>
                    <NavLink
                      to="/user-management"
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      {!collapsed && <span>User Management</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(filteredMaster.length > 0 || showAdmin) && (
          <SidebarGroup>
            <SidebarGroupLabel>Master Data</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible
                  defaultOpen={masterPaths.some((p) => currentPath.startsWith(p))}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Master Data"
                        isActive={masterPaths.some((p) => currentPath.startsWith(p))}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        {!collapsed && <span>Master Data</span>}
                        {!collapsed && (
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {filteredMaster.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive(item.url)}
                            >
                              <Link to={item.url}>
                                <item.icon className="mr-2 h-3.5 w-3.5" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                        {showAdmin && (
                          <>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={currentPath === "/admin"}>
                                <Link to="/admin">
                                  <Settings className="mr-2 h-3.5 w-3.5" />
                                  <span>Admin</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            {adminSubItems.map((item) => (
                              <SidebarMenuSubItem key={item.title} className="pl-3">
                                <SidebarMenuSubButton asChild isActive={isActive(item.url)}>
                                  <Link to={item.url}>
                                    <item.icon className="mr-2 h-3.5 w-3.5" />
                                    <span>{item.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
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
