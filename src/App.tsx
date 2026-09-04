import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ModalProvider } from "@/hooks/useModal";
import { AppLayout } from "@/components/layout/AppLayout";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { ReactNode, Suspense, lazy } from "react";
import { useCurrencySettings } from "@/lib/currency";

// Every page is its own lazy-loaded chunk instead of one large upfront
// bundle - the browser only downloads the page currently being visited.
const Index = lazy(() => import("./pages/Index"));
const Patients = lazy(() => import("./pages/Patients"));
const PatientDetail = lazy(() => import("./pages/PatientDetail"));
const Appointments = lazy(() => import("./pages/Appointments"));
const AppointmentDetail = lazy(() => import("./pages/AppointmentDetail"));
const Services = lazy(() => import("./pages/Services"));
const Billing = lazy(() => import("./pages/Billing"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportView = lazy(() => import("./pages/ReportView"));
const ReportConfigurator = lazy(() => import("./pages/ReportConfigurator"));
const Dashboards = lazy(() => import("./pages/Dashboards"));
const DashboardView = lazy(() => import("./pages/DashboardView"));
const Procedures = lazy(() => import("./pages/Procedures"));
const ProcedureNew = lazy(() => import("./pages/ProcedureNew"));
const Pharma = lazy(() => import("./pages/Pharma"));
const Photos = lazy(() => import("./pages/Photos"));
const LeaveManagement = lazy(() => import("./pages/LeaveManagement"));
const Assets = lazy(() => import("./pages/Assets"));
const Settings = lazy(() => import("./pages/Settings"));
const TaxMasterForm = lazy(() => import("./pages/TaxMasterForm"));
const TaxMasterDetail = lazy(() => import("./pages/TaxMasterDetail"));
const Orders = lazy(() => import("./pages/Orders"));
const TaxMaster = lazy(() => import("./pages/TaxMaster"));
const Expenses = lazy(() => import("./pages/Expenses"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const StaffDetail = lazy(() => import("./pages/StaffDetail"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const PortalLanding = lazy(() => import("./pages/portal/PortalLanding"));
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const Portal = lazy(() => import("./pages/portal/Portal"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ShopHome = lazy(() => import("./pages/shop/ShopHome"));
const ShopProduct = lazy(() => import("./pages/shop/ShopProduct"));
const ShopCart = lazy(() => import("./pages/shop/ShopCart"));
const ShopCheckout = lazy(() => import("./pages/shop/ShopCheckout"));
const ShopOrders = lazy(() => import("./pages/shop/ShopOrders"));
const Website = lazy(() => import("./pages/Website"));
const Landing = lazy(() => import("./pages/clinic/Landing"));
const ProblemAreas = lazy(() => import("./pages/ProblemAreas"));
const DuplicateManagement = lazy(() => import("./pages/DuplicateManagement"));
const SurveyTemplates = lazy(() => import("./pages/SurveyTemplates"));
const SurveyTemplateDetail = lazy(() => import("./pages/SurveyTemplateDetail"));
const AllSurveys = lazy(() => import("./pages/AllSurveys"));
const SurveyResponseDetail = lazy(() => import("./pages/SurveyResponseDetail"));
const SurveyResponseEdit = lazy(() => import("./pages/SurveyResponseEdit"));
const SurveyNew = lazy(() => import("./pages/SurveyNew"));
const Vendors = lazy(() => import("./pages/Vendors"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const HistoryTracking = lazy(() => import("./pages/admin/HistoryTracking"));
const CurrencyBilling = lazy(() => import("./pages/admin/CurrencyBilling"));
const UnitMaster = lazy(() => import("./pages/UnitMaster"));
const ValidationRules = lazy(() => import("./pages/ValidationRules"));
const ValidationRuleBuilder = lazy(() => import("./pages/ValidationRuleBuilder"));
const CustomFields = lazy(() => import("./pages/CustomFields"));
const Admin = lazy(() => import("./pages/Admin"));
const TrashPage = lazy(() => import("./pages/Trash"));
const TrashAdmin = lazy(() => import("./pages/TrashAdmin"));
const CategoryMaster = lazy(() => import("./pages/CategoryMaster"));
const Profile = lazy(() => import("./pages/Profile"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      networkMode: "always",
    },
    mutations: {
      retry: 1,
      networkMode: "always",
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error("Query failed:", query.queryKey, error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error("Mutation failed:", mutation.options.mutationKey, error);
    },
  }),
});

/** Loads admin currency settings once so every amount formats consistently. */
function CurrencyLoader() {
  useCurrencySettings();
  return null;
}

/** Shown briefly while a lazy-loaded page chunk downloads. */
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

/** Admin-only routes (user & profile management). */
function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  return isAdmin ? <>{children}</> : <AccessDenied />;
}

function ProtectedRoute({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const { isAdmin, permissions, loading, session } = useAuth();
  if (loading) return null;
  // Without a session every query reaches the database as "anon", which the
  // grants deny - send the user to sign in instead of rendering empty panels.
  if (!session) return <Navigate to="/login" replace />;
  if (isAdmin) return <>{children}</>;
  if (permissions[moduleKey]?.can_view) return <>{children}</>;
  // If no permissions loaded at all (no staff profile / not logged in as staff), allow access
  if (Object.keys(permissions).length === 0) return <>{children}</>;
  return <AccessDenied />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ThemeProvider>
          <ModalProvider>
          <BrowserRouter>
            <Toaster />
            <Sonner />
            <InstallBanner />
            <CurrencyLoader />
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Marketing website */}
            <Route path="/website" element={<Website />} />
            <Route path="/clinic" element={<Landing />} />

            {/* Auth pages */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Public Shop — own layout */}
            <Route path="/shop" element={<ShopLayout />}>
              <Route index element={<ShopHome />} />
              <Route path="product/:id" element={<ShopProduct />} />
              <Route path="cart" element={<ShopCart />} />
              <Route path="checkout" element={<ShopCheckout />} />
              <Route path="orders" element={<ShopOrders />} />
            </Route>

            {/* Patient Portal — outside clinic layout */}
            <Route path="/portal" element={<PortalLanding />} />
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/dashboard" element={<Portal />} />
            <Route path="/portal/dashboard/:tab" element={<Portal />} />
            <Route path="/portal/:tab" element={<Portal />} />

            {/* Clinic app — inside sidebar layout */}
            <Route
              path="*"
              element={
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<ProtectedRoute moduleKey="dashboard"><Index /></ProtectedRoute>} />
                    <Route path="/patients" element={<ProtectedRoute moduleKey="patients"><Patients /></ProtectedRoute>} />
                    <Route path="/patients/:id" element={<ProtectedRoute moduleKey="patients"><PatientDetail /></ProtectedRoute>} />
                    <Route path="/leave" element={<ProtectedRoute moduleKey="leave"><LeaveManagement /></ProtectedRoute>} />
                    <Route path="/appointments" element={<ProtectedRoute moduleKey="appointments"><Appointments /></ProtectedRoute>} />
                    <Route path="/appointments/:id" element={<ProtectedRoute moduleKey="appointments"><AppointmentDetail /></ProtectedRoute>} />
                    <Route path="/services" element={<ProtectedRoute moduleKey="services"><Services /></ProtectedRoute>} />
                    <Route path="/billing" element={<ProtectedRoute moduleKey="billing"><Billing /></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute moduleKey="reports"><Reports /></ProtectedRoute>} />
                    <Route path="/reports/:key" element={<ProtectedRoute moduleKey="reports"><ReportView /></ProtectedRoute>} />
                    <Route path="/report-builder" element={<ProtectedRoute moduleKey="report_builder"><ReportConfigurator /></ProtectedRoute>} />
                    <Route path="/dashboards" element={<ProtectedRoute moduleKey="reports"><Dashboards /></ProtectedRoute>} />
                    <Route path="/dashboards/:id" element={<ProtectedRoute moduleKey="reports"><DashboardView /></ProtectedRoute>} />
                    <Route path="/campaigns" element={<ProtectedRoute moduleKey="campaigns"><Campaigns /></ProtectedRoute>} />
                    <Route path="/campaigns/:id" element={<ProtectedRoute moduleKey="campaigns"><CampaignDetail /></ProtectedRoute>} />
                    <Route path="/procedures" element={<ProtectedRoute moduleKey="procedures"><Procedures /></ProtectedRoute>} />
                    <Route path="/procedures/new" element={<ProtectedRoute moduleKey="procedures"><ProcedureNew /></ProtectedRoute>} />
                    <Route path="/pharma" element={<ProtectedRoute moduleKey="pharmacy"><Pharma /></ProtectedRoute>} />
                    <Route path="/photos" element={<ProtectedRoute moduleKey="photos"><Photos /></ProtectedRoute>} />
                    <Route path="/assets" element={<ProtectedRoute moduleKey="assets"><Assets /></ProtectedRoute>} />
                    <Route path="/orders" element={<ProtectedRoute moduleKey="portal_orders"><Orders /></ProtectedRoute>} />
                    <Route path="/expenses" element={<ProtectedRoute moduleKey="expenses"><Expenses /></ProtectedRoute>} />
                    <Route path="/staff" element={<ProtectedRoute moduleKey="staff"><StaffManagement /></ProtectedRoute>} />
                    <Route path="/staff/:id" element={<ProtectedRoute moduleKey="staff"><StaffDetail /></ProtectedRoute>} />
                    <Route path="/problem-areas" element={<ProtectedRoute moduleKey="problem_areas"><ProblemAreas /></ProtectedRoute>} />
                    <Route path="/survey-templates" element={<ProtectedRoute moduleKey="surveys"><SurveyTemplates /></ProtectedRoute>} />
                    <Route path="/survey-templates/:id" element={<ProtectedRoute moduleKey="surveys"><SurveyTemplateDetail /></ProtectedRoute>} />
                    <Route path="/all-surveys" element={<ProtectedRoute moduleKey="surveys"><AllSurveys /></ProtectedRoute>} />
                    <Route path="/surveys/new" element={<ProtectedRoute moduleKey="surveys"><SurveyNew /></ProtectedRoute>} />
                    <Route path="/surveys/:id" element={<ProtectedRoute moduleKey="surveys"><SurveyResponseDetail /></ProtectedRoute>} />
                    <Route path="/surveys/:id/edit" element={<ProtectedRoute moduleKey="surveys"><SurveyResponseEdit /></ProtectedRoute>} />
                    <Route path="/vendors" element={<ProtectedRoute moduleKey="vendors"><Vendors /></ProtectedRoute>} />
                    <Route path="/unit-master" element={<ProtectedRoute moduleKey="unit_master"><UnitMaster /></ProtectedRoute>} />
                    <Route path="/Unit-master" element={<Navigate to="/unit-master" replace />} />
                    <Route path="/category-master" element={<ProtectedRoute moduleKey="category_master"><CategoryMaster /></ProtectedRoute>} />
                    <Route path="/tax-master" element={<ProtectedRoute moduleKey="settings"><TaxMaster /></ProtectedRoute>} />
                    <Route path="/tax-master/:id" element={<ProtectedRoute moduleKey="settings"><TaxMasterDetail /></ProtectedRoute>} />
                    <Route path="/user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
                    <Route path="/validation-rules" element={<ProtectedRoute moduleKey="settings"><ValidationRules /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute moduleKey="settings"><Admin /></ProtectedRoute>} />
                    <Route path="/trash" element={<TrashPage />} />
                    <Route path="/admin/history-tracking" element={<ProtectedRoute moduleKey="settings"><HistoryTracking /></ProtectedRoute>} />
                    <Route path="/admin/currency" element={<ProtectedRoute moduleKey="settings"><CurrencyBilling /></ProtectedRoute>} />
                    <Route path="/admin/trash" element={<ProtectedRoute moduleKey="settings"><TrashAdmin /></ProtectedRoute>} />
                    <Route path="/validation-rules/:id" element={<ProtectedRoute moduleKey="settings"><ValidationRuleBuilder /></ProtectedRoute>} />
                    <Route path="/duplicate-management" element={<ProtectedRoute moduleKey="settings"><DuplicateManagement /></ProtectedRoute>} />
                    <Route path="/custom-fields" element={<ProtectedRoute moduleKey="settings"><CustomFields /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute moduleKey="settings"><Settings /></ProtectedRoute>} />
                    <Route path="/settings/tax-master/new" element={<ProtectedRoute moduleKey="settings"><TaxMasterForm /></ProtectedRoute>} />
                    <Route path="/settings/tax-master/:id" element={<ProtectedRoute moduleKey="settings"><TaxMasterForm /></ProtectedRoute>} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              }
            />
          </Routes>
          </Suspense>
          </BrowserRouter>
        </ModalProvider>
        </ThemeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
